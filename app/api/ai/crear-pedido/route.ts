import { z } from "zod";
import { eq } from "drizzle-orm";
import { withBridge, audit, logEvent, logOrderAttempt, updateOrderAttempt } from "@/lib/ai/bridge";
import { sendMetaPurchase } from "@/lib/meta-capi";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { getProducts } from "@/lib/ai/data";
import { createOrder, parsePlainItems } from "@/lib/ai/orders";
import { pushOrderToShopify } from "@/lib/shopify-sync";
import { cop } from "@/lib/ai/format";
import { searchProducts, detectForma, formaDe } from "@/lib/ai/search";
import { identifyProduct } from "@/lib/ai/brain";
import { rulesForTenant } from "@/lib/ai/aliases";
import { detectarOtraMarcaEnItems, preferirOtraMarca, telLegible } from "@/lib/ai/marcas";
import { DEFAULT_TENANT_SLUG } from "@/lib/ai/tenant";
import type { ProductView } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (x: unknown) => (x == null ? "" : String(x)).trim();
const qty = (x: unknown) => {
  const n = parseInt(String(x ?? "").replace(/[^0-9]/g, ""), 10);
  return n > 0 ? n : 1;
};
/** Placeholder del bot ("pendiente", "N/A", "-", "sin dato"…) = dato ausente. */
const esPlaceholder = (s: string) =>
  !s || /^(pendiente|pend|n\/?a|na|no\s*(aplica|hay|tiene|se)|ninguno?|sin\s*\w*|desconocid[oa]|\.+|-+|\?+|x+)$/i.test(s.trim());
/** Nombre completo = al menos 2 palabras de ≥2 letras (nombre + apellido). "Luis" solo NO pasa:
 *  Interrapidísimo rechaza guías sin apellidos. */
const nombreCompletoValido = (s: string): boolean => {
  if (esPlaceholder(s)) return false;
  const palabras = s.split(/\s+/).map((w) => w.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/g, "")).filter((w) => w.length >= 2);
  return palabras.length >= 2;
};
/** Celular colombiano válido → 10 dígitos que empiezan en 3 (tolera prefijo 57). "" si inválido. */
const telValido = (raw: string): string => {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("57")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("57")) d = d.slice(2);
  return d.length === 10 && d.startsWith("3") ? d : "";
};

/** ¿Este texto (con sus dígitos) es un producto real del catálogo? Se usa para
 *  decidir si un número al inicio es cantidad o parte del nombre. */
function resolvesToProduct(name: string, catalog: ProductView[]): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  if (catalog.some((p) => p.slug === n)) return true;
  return !!searchProducts(name, catalog).product;
}

/* Umbrales de la salvaguarda de sensatez (§2 · bug $385M). COD de productos de
   gallos: una cantidad enorme o un total absurdo NO se confirma automático. */
const SOSPECHA_CANTIDAD = 20;
const SOSPECHA_TOTAL_COP = 2_000_000;
/** Interrapidísimo no despacha contra entrega por debajo de este valor en productos. */
const MINIMO_CONTRAENTREGA_COP = 50_000; // dueño 26-nov (decisión final): mínimo $50.000 en productos; los de $45.000 suman otro producto

/** 57XXXXXXXXXX → "313 316 0235" para el aviso al asesor. "" si no hay número. */
function telAviso(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("57")) d = d.slice(2);
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : "";
}

/* Campos de UChat que usa la plantilla `aviso_pedido_asesor` (bot f280503 de Animals).
   Bug 25-nov (AD-VBAJ): `ad_prod_nombre` lo llenaba solo buscar_producto; si el cliente
   pidió sin búsqueda previa quedaba VACÍO, Meta rechaza la plantilla con un parámetro
   vacío y el aviso NO llegaba (sin error en UChat). Ahora crear-pedido los escribe con
   los datos REALES del pedido antes de responder, así el aviso siempre sale completo. */
const AVISO_FIELDS_ANIMALS = {
  prodNombre: "f280503v14846981", // ad_prod_nombre
  prodPrecio: "f280503v14846983", // ad_prod_precio
};
async function llenarCamposAviso(tenantSlug: string, subId: string, producto: string, total: number): Promise<void> {
  if (tenantSlug !== DEFAULT_TENANT_SLUG || !subId.startsWith("f280503u") || !producto) return;
  const { uchatSetUserFields } = await import("@/lib/uchat");
  await Promise.race([
    uchatSetUserFields(subId, { [AVISO_FIELDS_ANIMALS.prodNombre]: producto, [AVISO_FIELDS_ANIMALS.prodPrecio]: String(total) }),
    new Promise((res) => setTimeout(res, 3000)),
  ]);
}

/** WhatsApp DESDE EL QUE SE HIZO el pedido (no el que el cliente escribe para la guía).
 *  El dueño busca el chat por ese número: si el aviso trae solo el del destinatario,
 *  no encuentra al cliente (reportes 9-jul, 27-ago, 14-nov, 25-nov). Fuentes, en orden:
 *  lo que mande UChat en el body → get-info de UChat por sub_id. Fail-soft: "" si no hay. */
async function whatsappDelChat(b: Record<string, unknown>, subId: string): Promise<string> {
  const crudo = str(b.telefono_wa ?? b.wa_phone ?? b.phone ?? b.whatsapp_phone);
  if (crudo.replace(/\D/g, "").length >= 10) return crudo;
  if (!subId || subId.startsWith("demo-")) return "";
  const { uchatGetSubscriber } = await import("@/lib/uchat");
  const r = await Promise.race([
    uchatGetSubscriber(subId),
    new Promise<{ ok: false }>((res) => setTimeout(() => res({ ok: false }), 2500)),
  ]);
  return r.ok && "telefono" in r ? r.telefono || "" : "";
}

export const POST = withBridge(
  // Body PERMISIVO (§2.1): NUNCA rechazamos por formato ("faltan datos"). Normalizamos
  // y resolvemos todo dentro; si falta un mínimo real, devolvemos campos_faltantes.
  z.object({}).passthrough(),
  async ({ customer, body, tenant }) => {
    const b = body as Record<string, unknown>;
    const esDefaultTenant = tenant.slug === DEFAULT_TENANT_SLUG; // solo AD tiene Shopify/Meta
    const subId = customer.uchatSubId || customer.id;
    // LOG del request crudo + registro del intento (para NO perder ninguna venta).
    await logEvent("crear_pedido_req", { sub_id: subId, body: b });
    const attemptId = await logOrderAttempt({ subId, rawBody: b, resultado: "recibido" });
    const catalog = await getProducts();

    // --- Campos (acepta nombres alternativos que puede mandar el bot) ---
    // Nombre COMPLETO con apellidos (Interrapidísimo lo exige para la guía). Si el bot
    // manda el apellido en un campo aparte, se une al nombre.
    const nombreBase = str(b.nombre ?? b.cliente ?? b.nombre_cliente ?? b.nombreCliente ?? b.nombre_completo);
    const apellidos = str(b.apellido ?? b.apellidos ?? b.apellido_cliente);
    const nombre = apellidos && !nombreBase.toLowerCase().includes(apellidos.toLowerCase())
      ? `${nombreBase} ${apellidos}`.trim() : nombreBase;
    const telefono = str(b.telefono ?? b.celular ?? b.movil ?? b.whatsapp ?? b.tel ?? b.numero);
    const ciudad = str(b.ciudad ?? b.municipio ?? b.pueblo);
    const oficina = str(b.oficina ?? b.agencia ?? b.punto_recogida ?? b.transportadora_oficina);
    let direccion = str(b.direccion ?? b.direccion_entrega ?? b.dir);
    if (!direccion && oficina) direccion = oficina;
    else if (direccion && oficina && !direccion.toLowerCase().includes(oficina.toLowerCase())) direccion = `${direccion} · ${oficina}`;
    // Cédula: solo dígitos. Placeholders del bot ("[Tu cédula]", "N/A"…) → vacío. NO bloquea el pedido.
    const cedulaRaw = str(b.cedula ?? b.cc ?? b.documento ?? b.identificacion ?? b.nid).replace(/[^0-9]/g, "");
    const cedula = cedulaRaw.length >= 5 ? cedulaRaw : "";
    const correo = str(b.correo ?? b.email);
    const cupon = str(b.cupon ?? b.codigo ?? b.cupon_codigo);
    // Método: lo que mande el bot; si no, el modo del TENANT (Rooster Deluxe = anticipado).
    const metodoRaw = str(b.metodo).toLowerCase();
    const metodo: "contraentrega" | "anticipado" =
      metodoRaw.startsWith("antic") ? "anticipado"
      : metodoRaw.startsWith("contra") ? "contraentrega"
      : (tenant.paymentMode === "anticipado" ? "anticipado" : "contraentrega");
    // Canal de origen (para separar en el panel). El bot puede mandarlo; default whatsapp.
    const canalRaw = str(b.canal ?? b.channel ?? b.origen).toLowerCase();
    const canal = /messen|facebook|\bfb\b|insta/.test(canalRaw) ? "messenger" : canalRaw === "web" ? "web" : "whatsapp";

    // --- Resolver productos: acepta items[] (con slug O nombre) o producto suelto + cantidad ---
    type Raw = { name: string; cantidad: number; presentacion?: string };
    const raws: Raw[] = [];
    // items puede llegar como ARRAY o como STRING con JSON dentro (falla típica de UChat),
    // o como un solo objeto. Toleramos las 3 formas.
    let itemsArr: unknown = b.items;
    if (typeof itemsArr === "string" && itemsArr.trim()) {
      // 1) string con JSON dentro; 2) si no, TEXTO PLANO ("American Rooster Fury x2").
      const s: string = itemsArr;
      try { itemsArr = JSON.parse(s); } catch { itemsArr = parsePlainItems(s, (n) => resolvesToProduct(n, catalog)); }
    }
    if (itemsArr && !Array.isArray(itemsArr) && typeof itemsArr === "object") itemsArr = [itemsArr];
    if (Array.isArray(itemsArr)) {
      for (const it of itemsArr as Record<string, unknown>[]) {
        const name = str(it?.slug ?? it?.nombre ?? it?.name ?? it?.producto ?? it?.producto_nombre);
        if (name) raws.push({ name, cantidad: qty(it?.cantidad ?? it?.qty), presentacion: str(it?.presentacion) || undefined });
      }
    }
    // producto "suelto" (fuera de items) — muy común desde el bot; también en texto plano.
    const prodSuelto = str(b.producto ?? b.producto_nombre ?? b.nombre_producto ?? b.item);
    if (!raws.length && prodSuelto) {
      const parsed = parsePlainItems(prodSuelto, (n) => resolvesToProduct(n, catalog));
      if (parsed.length === 1 && (b.cantidad || b.unidades)) parsed[0].cantidad = qty(b.cantidad ?? b.unidades);
      for (const x of parsed) raws.push({ name: x.name, cantidad: x.cantidad });
    }

    // resolver cada nombre → slug REAL del catálogo. CEREBRO (identifyProduct) con
    // umbral de CONFIANZA: bug AD-K7QM ("Ultra Gallo B12" quedó como Champions Choice)
    // = el fuzzy viejo (searchProducts) sustituía por otro producto. Ahora SOLO se
    // acepta un match seguro (alias/nombre/keyword, o fuzzy con score alto y NO ambiguo).
    // Cualquier duda → NO se sustituye: se pide aclarar ese producto.
    const rules = rulesForTenant(tenant.slug);
    const items: { slug: string; presentacion?: string; cantidad: number }[] = [];
    const noEncontrados: string[] = []; // sin match → "no encontré"
    const aclarar: string[] = [];       // match dudoso/ambiguo → "¿cuál exactamente?"
    const formasNoEncontradas: string[] = []; // "shampoo"/"topico" pedidos que no hay en este canal
    for (const r of raws) {
      const bySlug = catalog.find((p) => p.slug === r.name.toLowerCase());
      if (bySlug) { items.push({ slug: bySlug.slug, presentacion: r.presentacion, cantidad: r.cantidad }); continue; }
      const res = identifyProduct(r.name, catalog, [], rules);
      const seguro =
        !!res.product && res.status !== "ambiguous" &&
        (res.matchedBy === "alias" || res.matchedBy === "name" || res.matchedBy === "keyword"
          || (res.matchedBy === "fuzzy" && res.score >= 0.6));
      // Un alias de una palabra ("cobra") no puede convertir un producto del OTRO canal
      // ("super cobra 500") en uno nuestro: si no lo cubre, va a la detección de otra marca.
      const otraPreferida = seguro && (res.matchedBy === "alias" || res.matchedBy === "fuzzy") ? await preferirOtraMarca(r.name, res.product) : null;
      // Pidió un shampoo/ungüento y el match es de otra forma (AD-VBAJ 25-nov: "Rooster Deluxe
      // Shampoo" quedó como Rooster DELUXE en pastillas). Ese producto NO es lo que pidió.
      const formaPedida = detectForma(r.name);
      const formaChoca = !!(seguro && res.product && (formaPedida === "shampoo" || formaPedida === "topico") && formaDe(res.product) !== formaPedida);
      if (formaChoca) formasNoEncontradas.push(formaPedida!);
      if (otraPreferida || formaChoca) noEncontrados.push(r.name);
      else if (seguro) items.push({ slug: res.product!.slug, presentacion: r.presentacion, cantidad: r.cantidad });
      else if (res.product || res.status === "ambiguous" || res.status === "category") aclarar.push(r.name);
      else noEncontrados.push(r.name);
    }
    // --- OTRA MARCA (M-CERO): un ítem que no está en este catálogo puede ser del
    // OTRO negocio (botas, canilleras, comederos…). No se crea el pedido: se
    // redirige al canal que sí lo despacha, con su número y su forma de pago.
    // Va ANTES de "aclarar"/"faltan datos" para que el cliente no dé vueltas.
    if (noEncontrados.length) {
      let otras = await detectarOtraMarcaEnItems(noEncontrados);
      if (!otras.length && formasNoEncontradas.length) otras = await detectarOtraMarcaEnItems(formasNoEncontradas);
      if (otras.length) {
        const primera = otras[0];
        const nombres = otras.map((o) => `*${o.producto_nombre}*`).join(", ");
        await logEvent("pedido_no_creado", {
          motivo: "otra_marca", marca: primera.marca,
          productos: otras.map((o) => o.producto_slug), sub_id: subId,
        });
        await updateOrderAttempt(attemptId, { resultado: "rejected", motivo: `otra marca (${primera.marca}): ${otras.map((o) => o.producto_slug).join(", ")}` });
        return {
          ok: false,
          status: "otra_marca",
          requiere_asesor: true,
          otra_marca: {
            marca: primera.marca,
            marca_nombre: primera.marca_nombre,
            politica_pago: primera.politica_pago,
            whatsapp: primera.whatsapp,
            whatsapp_link: primera.whatsapp_link,
            productos: otras.map((o) => o.producto_nombre),
          },
          mensaje: otras.length === 1
            ? primera.mensaje
            : `👉 ${nombres} no los manejamos en este canal.\nEsos los despacha *${primera.marca_nombre}* 📲\nEscribile al *${telLegible(primera.whatsapp)}* y te los despachan de una 🐓`,
        };
      }
    }

    // Un match DUDOSO nunca crea pedido con otro producto: se pide aclarar (§2 · AD-K7QM).
    if (aclarar.length) {
      await logEvent("pedido_no_creado", { motivo: "producto_ambiguo", productos: aclarar, sub_id: subId });
      await updateOrderAttempt(attemptId, { resultado: "rejected", motivo: `aclarar producto: ${aclarar.join(", ")}` });
      return {
        ok: false,
        campos_faltantes: ["producto"],
        producto_ambiguo: aclarar,
        mensaje: `Para no equivocarme, ¿me confirmas exactamente cuál producto es "${aclarar[0]}"? Dime el nombre completo o te paso el catálogo 🐓`,
      };
    }

    // --- SOLO ANTICIPADO (M6.2): productos que NO se venden contra entrega en este bot.
    // Se remite al canal de pago anticipado — NUNCA se crea un pedido COD con ellos.
    if (metodo === "contraentrega") {
      const soloAnt = items
        .map((it) => catalog.find((p) => p.slug === it.slug))
        .filter((p): p is ProductView => !!p?.soloAnticipado);
      if (soloAnt.length) {
        const nombres = soloAnt.map((p) => p.name).join(", ");
        await logEvent("pedido_no_creado", { motivo: "solo_anticipado", productos: soloAnt.map((p) => p.slug), sub_id: subId });
        await updateOrderAttempt(attemptId, { resultado: "rejected", motivo: `solo anticipado: ${nombres}` });
        return {
          ok: false,
          solo_anticipado: soloAnt.map((p) => p.slug),
          requiere_asesor: true,
          mensaje:
            `${soloAnt.length > 1 ? "Esos productos se manejan" : `El *${nombres}* se maneja`} con *pago anticipado*, ` +
            `no contra entrega. Te paso con un asesor para coordinarlo por ese canal y te despachamos enseguida 🐓`,
        };
      }
    }

    // --- MÍNIMO DE UNIDADES (M6.3): ciertos goteros solo se despachan de a 2+.
    // Se ajusta la cantidad al mínimo (resolveItems hace lo mismo) y se le avisa al cliente.
    const subidos: string[] = [];
    for (const it of items) {
      const p = catalog.find((x) => x.slug === it.slug);
      const minU = Math.max(1, p?.minUnidades ?? 1);
      if (p && it.cantidad < minU) {
        subidos.push(`${p.name} (mínimo ${minU})`);
        it.cantidad = minU;
      }
    }

    // --- MÍNIMO DE INTERRAPIDÍSIMO (reporte del dueño 30-jul / 17-ago / 19-nov):
    // contra entrega solo se despacha si los PRODUCTOS suman ≥ $45.000. Un gotero de
    // $25.000 solo no sale. No se crea el pedido: se le pide sumar unidades/productos.
    if (metodo === "contraentrega" && items.length) {
      const subtotalProd = items.reduce((s, it) => {
        const p = catalog.find((x) => x.slug === it.slug);
        return s + (p?.presentations?.[0]?.priceCOP ?? p?.priceCOP ?? 0) * it.cantidad;
      }, 0);
      if (subtotalProd > 0 && subtotalProd < MINIMO_CONTRAENTREGA_COP) {
        await logEvent("pedido_no_creado", { motivo: "minimo_contraentrega", subtotal: subtotalProd, sub_id: subId });
        await updateOrderAttempt(attemptId, { resultado: "rejected", motivo: `bajo mínimo COD: ${subtotalProd}` });
        return {
          ok: false,
          status: "minimo_contraentrega",
          minimo_cop: MINIMO_CONTRAENTREGA_COP,
          subtotal_cop: subtotalProd,
          campos_faltantes: ["producto"],
          mensaje:
            `Mi rey, la transportadora despacha contra entrega desde *${cop(MINIMO_CONTRAENTREGA_COP)}* en productos ` +
            `y tu pedido va en ${cop(subtotalProd)}. ¿Le sumamos otra unidad u otro producto y te lo despacho de una? 🐓`,
        };
      }
    }

    // --- REQUISITOS DUROS (bug AD-7PM7: se creó un pedido sin nombre/cédula/tel/dirección).
    // NINGÚN pedido se crea sin los 5 datos + 1 ítem. Se validan formato y placeholders.
    const telOk = telValido(telefono);            // celular CO válido (10 díg, empieza en 3)
    const nombreOk = nombreCompletoValido(nombre);
    const faltantes: string[] = [];
    // PAGO ANTICIPADO (Rooster Deluxe): el proceso del dueño es cuentas → comprobante →
    // datos. Pedir nombre/cédula/dirección ANTES del pago hace creer que es contra entrega
    // y el cliente no paga. Por eso aquí el pedido nace solo con producto (+ ciudad si la
    // dio) en 'por_verificar_pago'; los datos llegan con el comprobante (registrar-cliente
    // los completa en ESTE pedido). Antes, crear_pedido de Rooster no registraba NADA:
    // 0 pedidos en el sistema con miles de chats.
    const datosDespues = metodo === "anticipado";
    if (datosDespues) {
      if (!items.length) faltantes.push("producto");
    } else {
    if (!nombreOk) faltantes.push("nombre");
    if (!telOk) faltantes.push("telefono");
    if (!cedula) faltantes.push("cedula");        // cédula: numérica ≥5 díg (ya validada arriba). Requerida.
    if (esPlaceholder(ciudad)) faltantes.push("ciudad");
    if (esPlaceholder(direccion)) faltantes.push("direccion");
    if (!items.length) faltantes.push("producto");
    }
    if (faltantes.length) {
      await logEvent("pedido_no_creado", {
        motivo: "campos_faltantes", campos: faltantes, no_encontrados: noEncontrados,
        recibido: Object.keys(b), sub_id: subId,
      });
      await updateOrderAttempt(attemptId, { resultado: "rejected", motivo: `faltan: ${faltantes.join(", ")}${noEncontrados.length ? ` · no encontré: ${noEncontrados.join(", ")}` : ""}` });
      const et: Record<string, string> = {
        nombre: "tu *nombre completo con apellidos* (la transportadora lo exige para la guía)", telefono: "tu teléfono", ciudad: "tu ciudad",
        direccion: "tu dirección (o la oficina de la transportadora)",
        cedula: "tu número de cédula (la transportadora la exige para entregar)",
        producto: noEncontrados.length ? `el producto (no encontré "${noEncontrados[0]}")` : "el producto que quieres",
      };
      return {
        ok: false,
        campos_faltantes: faltantes,
        mensaje: `Para confirmar tu pedido me falta ${faltantes.map((f) => et[f]).join(", ")}. ¿Me lo pasas? 🐓`,
      };
    }

    // actualizar datos del cliente (sin pisar con vacíos: en anticipado aún no los dio)
    if (db && !customer.id.startsWith("demo-")) {
      const set: Record<string, unknown> = { estado: "cliente", ultimoContacto: new Date() };
      if (nombreOk) set.nombre = nombre;
      if (telOk) set.telefono = telOk;
      if (!esPlaceholder(ciudad)) set.ciudad = ciudad;
      if (!esPlaceholder(direccion)) set.direccion = direccion;
      await db.update(customers).set(set).where(eq(customers.id, customer.id));
    }

    // --- SALVAGUARDA DE SENSATEZ (§2 · bug $385M) ---------------------------------
    // Nunca confirmar automáticamente un pedido con una cantidad o un valor absurdos,
    // aunque el bot se equivoque. Sospechoso → "por_revisar", SIN empujar a Shopify/Meta,
    // y se le pide al cliente confirmar la cantidad (un asesor lo valida antes de despachar).
    const precioDe = (slug: string) => {
      const p = catalog.find((x) => x.slug === slug);
      return p?.presentations?.[0]?.priceCOP ?? p?.priceCOP ?? 0;
    };
    const maxCantidad = items.reduce((m, it) => Math.max(m, it.cantidad), 0);
    const totalEstimado = items.reduce((s, it) => s + precioDe(it.slug) * it.cantidad, 0);
    const sospechoso = maxCantidad > SOSPECHA_CANTIDAD || totalEstimado > SOSPECHA_TOTAL_COP;

    // Teléfonos para el AVISO AL ASESOR: el de la guía + el WhatsApp del chat.
    const waChat = await whatsappDelChat(b, subId);
    const telGuia = telAviso(telOk);
    const telChat = telAviso(waChat);
    const telefonoAviso =
      telChat && telChat !== telGuia ? `${telGuia} · WhatsApp del chat: ${telChat}`
      : telGuia || telChat || (canal === "messenger" ? "cliente de Messenger (sin WhatsApp)" : "sin número");

    // Anticipado sin datos aún: nombre del WhatsApp y teléfono del chat, para que el
    // asesor ubique el pedido; el resto llega con el comprobante.
    const nombrePedido = nombreOk ? nombre
      : (datosDespues ? (str(b.nombre_wa) || customer.nombre || "Cliente WhatsApp") : nombre);
    const telPedido = telOk || (datosDespues ? telValido(waChat) : "");
    const ciudadPedido = esPlaceholder(ciudad) ? "" : ciudad;
    const order = await createOrder({
      subId: customer.uchatSubId || customer.id,
      customerId: customer.id,
      items,
      nombre: nombrePedido, telefono: telPedido, ciudad: ciudadPedido, direccion: esPlaceholder(direccion) ? "" : direccion, cedula,
      cupon: cupon || undefined,
      metodo,
      canal,
      catalog,
      // Anticipado: nace en 'por_verificar_pago' (espera comprobante). COD: default 'remision'.
      estado: sospechoso ? "por_revisar" : (metodo === "anticipado" ? "por_verificar_pago" : undefined),
      notas: sospechoso
        ? `⚠️ REVISAR CANTIDAD (posible error del bot): pidió ${maxCantidad} unid · total estimado ${cop(totalEstimado)}. Confirmar con el cliente antes de despachar. La cantidad real suele ser 1.`
        : [
            datosDespues && (!nombreOk || !cedula || esPlaceholder(direccion))
              ? "Pago anticipado: datos de envío pendientes (llegan con el comprobante)." : "",
            telChat && telChat !== telGuia ? `WhatsApp del chat: ${telChat}` : "",
          ].filter(Boolean).join(" ") || undefined,
    });

    const ref = order.ref;

    // Pedido sospechoso: NO se confirma. Queda "por_revisar" para el asesor y se le
    // pregunta al cliente cuántas unidades quiere (por defecto 1). No va a Shopify/Meta.
    if (sospechoso) {
      await logEvent("pedido_sospechoso", { ref, sub_id: subId, max_cantidad: maxCantidad, total_estimado: totalEstimado, items });
      await audit("pedido_por_revisar", "orders", { ref, maxCantidad, total: totalEstimado });
      await updateOrderAttempt(attemptId, { resultado: "por_revisar", ref, motivo: `sospechoso: ${maxCantidad} unid / ${totalEstimado}` });
      const listaNombres = order.items.map((it) => it.name).join(", ");
      await llenarCamposAviso(tenant.slug, subId, `${order.items.map((it) => `${it.cantidad}× ${it.name}`).join(", ")} (POR REVISAR)`, order.total_cop);
      return {
        pedido_id: order.pedido_id,
        ref,
        estado: "por_revisar",
        requiere_revision: true,
        // Resumen coherente con ESTE pedido (§5): la notificación al asesor no debe
        // llenarse con variables viejas del bot.
        producto_resumen: order.items.map((it) => `${it.cantidad}× ${it.name}`).join(", "),
        total_cop: order.total_cop,
        asesor: order.asesor,
        mensaje:
          `¡Gracias${nombre ? " " + nombre.split(" ")[0] : ""}! 🙏 Antes de cerrar quiero confirmar bien: ` +
          `¿cuántas unidades querés de ${listaNombres}? (por defecto es *1*). ` +
          `Un asesor te confirma el total exacto enseguida. 🐓`,
      };
    }

    // La ref que ve el cliente SIEMPRE es la interna AD-XXXX (con esa consulta
    // estado-pedido, y es idempotente). El nombre de Shopify queda guardado aparte.
    if (esDefaultTenant && !order.reused && !order.pedido_id.startsWith("demo-")) {
      const shop = await pushOrderToShopify({
        orderId: order.pedido_id,
        nombre, telefono, ciudad, direccion, cedula,
        items: order.items.map((it) => ({
          slug: it.slug, name: it.name, presentacionLabel: it.presentacionLabel,
          precioCop: it.precioCop, cantidad: it.cantidad, shopifyVariantId: it.shopifyVariantId,
        })),
        note: `Pedido contraentrega tomado por el bot (WhatsApp). Ref interna: ${order.ref}`,
      });
      await logEvent(shop.ok ? "pedido_shopify_ok" : "pedido_shopify_error", {
        ref: order.ref, shopify: shop.shopifyOrderName, error: shop.error, skipped: shop.skipped,
      });
    }

    if (!order.reused) {
      await audit("crear_pedido", "orders", { ref: order.ref, total: order.total_cop });
      await logEvent("pedido_creado", { ref: order.ref, total: order.total_cop, metodo });
      // Evento Purchase a Meta CAPI (solo AD: es su pixel). Fail-soft.
      if (esDefaultTenant) {
        const meta = await sendMetaPurchase({
          ref: order.ref, valueCop: order.total_cop, phone: telefono, nombre, ciudad,
          contentIds: order.items.map((it) => it.slug), actionSource: "business_messaging",
        });
        if (!meta.skipped) await logEvent(meta.ok ? "meta_purchase_ok" : "meta_purchase_error", { ref: order.ref, error: meta.error });
      }
    }
    await updateOrderAttempt(attemptId, { resultado: "created", ref: order.ref });

    const listaProductos = order.items.map((it) => `${it.cantidad}× ${it.name}`).join(", ");
    await llenarCamposAviso(tenant.slug, subId, listaProductos, order.total_cop);
    // Aviso de mínimo por envío (M6.3): el total ya viene recalculado con la cantidad subida.
    const avisoMinimo = subidos.length
      ? `ℹ️ De ${subidos.join(" y ")} se envían mínimo esas unidades, así que ajusté la cantidad.\n`
      : "";
    const mensaje = metodo === "anticipado"
      // --- PAGO ANTICIPADO: nunca menciona contra entrega. Pide comprobante. ---
      ? (order.reused ? `📝 Tu pedido ya quedó registrado: ${listaProductos}\n` : `📝 Tu pedido: ${listaProductos}\n`) + avisoMinimo +
        `💵 *Total a transferir: ${cop(order.total_cop)}* (solo productos; el envío se paga al recibir)` +
        (ciudadPedido ? ` · ${ciudadPedido}` : "") + ` · Ref *${ref}*`
      // --- CONTRA ENTREGA (Animals Deluxe) ---
      : `✅ ¡Listo${nombre ? " " + nombre.split(" ")[0] : ""}! Tu pedido quedó confirmado 🎉 Ref *${ref}*\n` +
        `${listaProductos}\n` + avisoMinimo +
        `Producto: ${cop(order.subtotal_cop)}` +
        (order.descuento_cop ? ` · Descuento: -${cop(order.descuento_cop)}` : "") + `\n` +
        `*Total a recaudar: ${cop(order.total_cop)}* (solo el producto)\n` +
        (order.envio_cop
          ? `🚚 El flete lo cobra la transportadora al entregar (aprox ${cop(order.envio_cop)}, puede variar).\n`
          : `🚚 ¡Envío GRATIS! 🎉\n`) +
        `Te despachamos a ${ciudad} contra entrega. ¡Gracias por confiar en Animals Deluxe! 🐓`;

    return {
      pedido_id: order.pedido_id,
      ref,
      // Campos que alimentan la notificación al asesor (§5): SIEMPRE los de ESTE
      // pedido recién creado (producto, total y ref), para que el bot no llene la
      // plantilla con variables de un pedido anterior.
      producto_resumen: listaProductos,
      // Aviso al asesor: SIEMPRE con número. `telefono_aviso` trae el de la guía y,
      // si es distinto, el WhatsApp desde el que se hizo el pedido (para encontrar el chat).
      cliente_nombre: nombre,
      cliente_telefono: telOk,
      cliente_whatsapp: waChat.replace(/\D/g, ""),
      cliente_cedula: cedula,
      telefono_aviso: telefonoAviso,
      subtotal_cop: order.subtotal_cop,
      total_cop: order.total_cop,
      flete: order.envio_cop,
      envio_cop: order.envio_cop,
      descuento_cop: order.descuento_cop,
      estado: order.estado,
      asesor: order.asesor,
      no_encontrados: noEncontrados,
      mensaje,
    };
  },
);
