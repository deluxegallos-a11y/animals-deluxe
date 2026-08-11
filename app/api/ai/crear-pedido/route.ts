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
import { searchProducts } from "@/lib/ai/search";
import { identifyProduct } from "@/lib/ai/brain";
import { rulesForTenant } from "@/lib/ai/aliases";
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
    const nombre = str(b.nombre ?? b.cliente ?? b.nombre_cliente ?? b.nombreCliente);
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
    for (const r of raws) {
      const bySlug = catalog.find((p) => p.slug === r.name.toLowerCase());
      if (bySlug) { items.push({ slug: bySlug.slug, presentacion: r.presentacion, cantidad: r.cantidad }); continue; }
      const res = identifyProduct(r.name, catalog, [], rules);
      const seguro =
        !!res.product && res.status !== "ambiguous" &&
        (res.matchedBy === "alias" || res.matchedBy === "name" || res.matchedBy === "keyword"
          || (res.matchedBy === "fuzzy" && res.score >= 0.6));
      if (seguro) items.push({ slug: res.product!.slug, presentacion: r.presentacion, cantidad: r.cantidad });
      else if (res.product || res.status === "ambiguous" || res.status === "category") aclarar.push(r.name);
      else noEncontrados.push(r.name);
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

    // --- REQUISITOS DUROS (bug AD-7PM7: se creó un pedido sin nombre/cédula/tel/dirección).
    // NINGÚN pedido se crea sin los 5 datos + 1 ítem. Se validan formato y placeholders.
    const telOk = telValido(telefono);            // celular CO válido (10 díg, empieza en 3)
    const nombreOk = !esPlaceholder(nombre) && nombre.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, "").length >= 3;
    const faltantes: string[] = [];
    if (!nombreOk) faltantes.push("nombre");
    if (!telOk) faltantes.push("telefono");
    if (!cedula) faltantes.push("cedula");        // cédula: numérica ≥5 díg (ya validada arriba). Requerida.
    if (esPlaceholder(ciudad)) faltantes.push("ciudad");
    if (esPlaceholder(direccion)) faltantes.push("direccion");
    if (!items.length) faltantes.push("producto");
    if (faltantes.length) {
      await logEvent("pedido_no_creado", {
        motivo: "campos_faltantes", campos: faltantes, no_encontrados: noEncontrados,
        recibido: Object.keys(b), sub_id: subId,
      });
      await updateOrderAttempt(attemptId, { resultado: "rejected", motivo: `faltan: ${faltantes.join(", ")}${noEncontrados.length ? ` · no encontré: ${noEncontrados.join(", ")}` : ""}` });
      const et: Record<string, string> = {
        nombre: "tu nombre", telefono: "tu teléfono", ciudad: "tu ciudad",
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

    // actualizar datos del cliente
    if (db && !customer.id.startsWith("demo-")) {
      await db
        .update(customers)
        .set({ nombre, telefono: telOk, ciudad, direccion, estado: "cliente", ultimoContacto: new Date() })
        .where(eq(customers.id, customer.id));
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

    const order = await createOrder({
      subId: customer.uchatSubId || customer.id,
      customerId: customer.id,
      items,
      nombre, telefono: telOk, ciudad, direccion, cedula,
      cupon: cupon || undefined,
      metodo,
      canal,
      catalog,
      // Anticipado: nace en 'por_verificar_pago' (espera comprobante). COD: default 'remision'.
      estado: sospechoso ? "por_revisar" : (metodo === "anticipado" ? "por_verificar_pago" : undefined),
      notas: sospechoso
        ? `⚠️ REVISAR CANTIDAD (posible error del bot): pidió ${maxCantidad} unid · total estimado ${cop(totalEstimado)}. Confirmar con el cliente antes de despachar. La cantidad real suele ser 1.`
        : undefined,
    });

    const ref = order.ref;

    // Pedido sospechoso: NO se confirma. Queda "por_revisar" para el asesor y se le
    // pregunta al cliente cuántas unidades quiere (por defecto 1). No va a Shopify/Meta.
    if (sospechoso) {
      await logEvent("pedido_sospechoso", { ref, sub_id: subId, max_cantidad: maxCantidad, total_estimado: totalEstimado, items });
      await audit("pedido_por_revisar", "orders", { ref, maxCantidad, total: totalEstimado });
      await updateOrderAttempt(attemptId, { resultado: "por_revisar", ref, motivo: `sospechoso: ${maxCantidad} unid / ${totalEstimado}` });
      const listaNombres = order.items.map((it) => it.name).join(", ");
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
    // Aviso de mínimo por envío (M6.3): el total ya viene recalculado con la cantidad subida.
    const avisoMinimo = subidos.length
      ? `ℹ️ De ${subidos.join(" y ")} se envían mínimo esas unidades, así que ajusté la cantidad.\n`
      : "";
    const mensaje = metodo === "anticipado"
      // --- PAGO ANTICIPADO: nunca menciona contra entrega. Pide comprobante. ---
      ? `✅ ¡Listo${nombre ? " " + nombre.split(" ")[0] : ""}! Tu pedido quedó registrado 🎉 Ref *${ref}*\n` +
        `${listaProductos}\n` + avisoMinimo +
        `*Total a pagar: ${cop(order.total_cop)}*\n` +
        `Para despacharlo, realiza el pago por adelantado y envíame el *comprobante*. ` +
        `Un asesor lo confirma y coordina el envío a ${ciudad}. ¡Gracias! 🐓`
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
