"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray, sql, and, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  products, categories, orders, orderItems, customers, advisors, promotions, coupons, storeConfig, integrations, auditLog, reviews, adMap,
  type Presentacion, type Ingrediente, type FaqItem, type CiudadCobertura, type CuentaBancaria,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { syncProductToShopify, archiveProductInShopify, retryPendingProducts } from "@/lib/shopify-sync";
import { notificarDespacho, type NotifyResult } from "@/lib/ai/notificaciones";
import { uchatSendText, uchatSendImage } from "@/lib/uchat";
import { getProducts } from "@/lib/ai/data";
import { createOrder } from "@/lib/ai/orders";
import { sendMetaPurchase } from "@/lib/meta-capi";

/* ---------- helpers de parseo ---------- */
function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function lines(s: string): string[] {
  return String(s || "").split("\n").map((l) => l.trim()).filter(Boolean);
}
function csv(s: string): string[] {
  return String(s || "").split(",").map((l) => l.trim()).filter(Boolean);
}
function parsePresentations(s: string): Presentacion[] {
  return lines(s).map((l) => {
    const [label, precio] = l.split("|").map((x) => x.trim());
    return { label: label || "Unidad", priceCOP: parseInt((precio || "0").replace(/\D/g, ""), 10) || 0 };
  }).filter((p) => p.label);
}
function parseIngredients(s: string): Ingrediente[] {
  return lines(s).map((l) => { const [name, detail] = l.split("|").map((x) => x.trim()); return { name: name || "", detail: detail || "" }; }).filter((i) => i.name);
}
function parseFaq(s: string): FaqItem[] {
  return lines(s).map((l) => { const [q, a] = l.split("|").map((x) => x.trim()); return { q: q || "", a: a || "" }; }).filter((f) => f.q);
}
function parseCuentas(s: string): CuentaBancaria[] {
  return lines(s).map((l) => {
    const [banco, tipo, numero, titular] = l.split("|").map((x) => x.trim());
    return { banco: banco || "", tipo: tipo || "Ahorros", numero: numero || "", titular: titular || "" };
  }).filter((c) => c.banco && c.numero);
}
async function logAudit(accion: string, entidad: string, despues: unknown) {
  if (!db) return;
  try { await db.insert(auditLog).values({ accion, entidad, despues: despues as object }); } catch { /* noop */ }
}

/* ===========================================================
   PRODUCTOS
   =========================================================== */
export async function saveProduct(formData: FormData) {
  await requireUser();
  if (!db) return { ok: false, error: "demo" };

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "El nombre es obligatorio." };

  let slug = String(formData.get("slug") || "").trim() || slugify(name);
  slug = slugify(slug);
  const priceCop = parseInt(String(formData.get("priceCop") || "0").replace(/\D/g, ""), 10) || 0;
  if (priceCop <= 0) return { ok: false, error: "El precio debe ser mayor a 0." };

  const presentations = parsePresentations(String(formData.get("presentations") || ""));
  if (presentations.length === 0) return { ok: false, error: "Agrega al menos una presentación (label | precio)." };
  // Si hay UNA sola presentación, su precio sigue al campo "Precio" (evita descuadres web/Shopify).
  if (presentations.length === 1) presentations[0].priceCOP = priceCop;
  const benefits = lines(String(formData.get("benefits") || ""));
  if (benefits.length < 3) return { ok: false, error: "Agrega al menos 3 beneficios (uno por línea)." };
  const usage = String(formData.get("usage") || "").trim();
  if (!usage) return { ok: false, error: "El modo de uso es obligatorio." };

  // categoría
  const categorySlug = String(formData.get("categorySlug") || "");
  let categoryId: string | null = null;
  if (categorySlug) {
    const [c] = await db.select().from(categories).where(eq(categories.slug, categorySlug)).limit(1);
    categoryId = c?.id || null;
  }

  const values = {
    slug, name, categoryId,
    audience: String(formData.get("audience") || ""),
    origin: String(formData.get("origin") || "co"),
    priceCop,
    presentations,
    imageUrl: String(formData.get("imageUrl") || ""),
    badges: csv(String(formData.get("badges") || "")),
    tagline: String(formData.get("tagline") || ""),
    shortDesc: String(formData.get("shortDesc") || ""),
    benefits,
    ingredients: parseIngredients(String(formData.get("ingredients") || "")),
    usage,
    pitch: String(formData.get("pitch") || ""),
    faq: parseFaq(String(formData.get("faq") || "")),
    keywords: String(formData.get("keywords") || "")
      .split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 20),
    objeciones: {
      muy_caro: String(formData.get("obj_muy_caro") || ""),
      lo_pienso: String(formData.get("obj_lo_pienso") || ""),
      no_confio: String(formData.get("obj_no_confio") || ""),
      no_tengo_plata: String(formData.get("obj_no_tengo_plata") || ""),
      ya_lo_uso: String(formData.get("obj_ya_lo_uso") || ""),
    },
    adIds: String(formData.get("ad_ids") || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 30),
    disclaimer: String(formData.get("disclaimer") || ""),
    stock: parseInt(String(formData.get("stock") || "999"), 10) || 999,
    // Dimensiones para el flete/guía (afectan el precio del envío)
    pesoGr: Math.max(1, parseInt(String(formData.get("pesoGr") || "1000").replace(/\D/g, ""), 10) || 1000),
    altoCm: Math.max(1, parseInt(String(formData.get("altoCm") || "15").replace(/\D/g, ""), 10) || 15),
    anchoCm: Math.max(1, parseInt(String(formData.get("anchoCm") || "12").replace(/\D/g, ""), 10) || 12),
    largoCm: Math.max(1, parseInt(String(formData.get("largoCm") || "8").replace(/\D/g, ""), 10) || 8),
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
    envioGratis: formData.get("envioGratis") === "on" || formData.get("envioGratis") === "true",
    // Ficha enriquecida (§4.6)
    descripcion: String(formData.get("descripcion") || "").trim(),
    edadMinima: String(formData.get("edadMinima") || "").trim(),
    dosificacion: String(formData.get("dosificacion") || "").trim(),
    presentacion: String(formData.get("presentacion") || "").trim(),
    paraQue: String(formData.get("paraQue") || "").trim(),
  };

  // Marca pendiente de sincronía; syncProductToShopify lo pondrá en 'synced'.
  let productId = id;
  if (id) {
    await db.update(products).set({ ...values, shopifySync: "pending", updatedAt: new Date() }).where(eq(products.id, id));
    await logAudit("editar_producto", "products", { id, slug });
  } else {
    const [created] = await db.insert(products).values({ ...values, shopifySync: "pending" }).returning();
    productId = created?.id || "";
    await logAudit("crear_producto", "products", { id: productId, slug });
  }

  // Espejo en Shopify (la plataforma es la fuente de verdad). No rompe el panel
  // si Shopify falla: queda 'pending'/'error' y se reintenta desde el botón.
  let shopify: { ok: boolean; skipped?: boolean; error?: string } = { ok: false, skipped: true };
  if (productId) shopify = await syncProductToShopify(productId);

  revalidatePath("/productos");
  revalidatePath("/");
  return { ok: true, shopify };
}

export async function deleteProduct(id: string) {
  await requireUser();
  if (!db || !id) return;
  // Archiva en Shopify (no borrar en duro) antes de eliminar el registro local.
  const [row] = await db.select({ sid: products.shopifyProductId }).from(products).where(eq(products.id, id)).limit(1);
  await archiveProductInShopify(row?.sid);
  await db.delete(products).where(eq(products.id, id));
  await logAudit("eliminar_producto", "products", { id });
  revalidatePath("/productos");
}

/* ---------- Reseñas (moderación) ---------- */
export async function deleteReview(id: string) {
  await requireUser();
  if (!db || !id) return;
  await db.delete(reviews).where(eq(reviews.id, id));
  await logAudit("eliminar_resena", "reviews", { id });
  revalidatePath("/resenas");
}

export async function toggleReview(id: string, estado: "aprobado" | "oculto") {
  await requireUser();
  if (!db || !id) return;
  await db.update(reviews).set({ estado }).where(eq(reviews.id, id));
  revalidatePath("/resenas");
}

export async function toggleProduct(id: string, activo: boolean) {
  await requireUser();
  if (!db || !id) return;
  await db.update(products).set({ activo, shopifySync: "pending", updatedAt: new Date() }).where(eq(products.id, id));
  // Refleja el estado en Shopify (ACTIVE/ARCHIVED) según 'activo'.
  await syncProductToShopify(id);
  revalidatePath("/productos");
}

/** Botón del panel: fuerza/repara la sincronía de UN producto con Shopify. */
export async function syncProductNow(id: string) {
  await requireUser();
  if (!db || !id) return { ok: false, error: "Sin DB." };
  const res = await syncProductToShopify(id);
  revalidatePath("/productos");
  return res;
}

/** Botón del panel: reintenta TODOS los productos pendientes/errados. */
export async function retryShopifySync() {
  await requireUser();
  const res = await retryPendingProducts();
  revalidatePath("/productos");
  return res;
}

/* ===========================================================
   PEDIDOS
   =========================================================== */
export async function updateOrderStatus(id: string, estado: string) {
  await requireUser();
  if (!db || !id) return;
  await db.update(orders).set({ estado, updatedAt: new Date() }).where(eq(orders.id, id));
  await logAudit("cambiar_estado_pedido", "orders", { id, estado });
  revalidatePath("/pedidos");
  revalidatePath("/dashboard");
}

/** Cambia el estado de VARIOS pedidos a la vez (acción masiva del panel). */
export async function bulkUpdateStatus(ids: string[], estado: string): Promise<{ ok: boolean; count: number }> {
  await requireUser();
  const clean = (ids || []).filter(Boolean);
  if (!db || !clean.length) return { ok: false, count: 0 };
  await db.update(orders).set({ estado, updatedAt: new Date() }).where(inArray(orders.id, clean));
  await logAudit("cambiar_estado_masivo", "orders", { ids: clean, estado });
  revalidatePath("/pedidos");
  revalidatePath("/dashboard");
  return { ok: true, count: clean.length };
}

export interface DespachoResult {
  ok: boolean;
  error?: string;
  /** Resultado del aviso por WhatsApp al cliente (fail-soft). */
  notify?: NotifyResult;
}

/**
 * Marca un pedido como DESPACHADO (manual), guarda guía + transportadora y
 * avisa al cliente por WhatsApp ("tu pedido fue despachado" + guía).
 * El aviso es fail-soft: si falta el sub_id o UChat no está configurado, el
 * despacho igual queda guardado y el panel muestra por qué no se envió.
 */
export async function despacharPedido(id: string, guia: string, transportadora: string): Promise<DespachoResult> {
  await requireUser();
  if (!db || !id) return { ok: false, error: "Sin DB." };
  const g = String(guia || "").trim();
  const t = String(transportadora || "").trim();
  if (!g) return { ok: false, error: "El número de guía es obligatorio para despachar." };

  // Pedido + sub_id de UChat del cliente (para el aviso por WhatsApp).
  const [row] = await db
    .select({ o: orders, subId: customers.uchatSubId })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, id))
    .limit(1);
  if (!row) return { ok: false, error: "Pedido no encontrado." };

  const despachadoAt = new Date();
  await db
    .update(orders)
    .set({ estado: "despachado", guia: g, transportadora: t, despachadoAt, updatedAt: despachadoAt })
    .where(eq(orders.id, id));

  // Resumen de items para el mensaje.
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));

  const notify = await notificarDespacho(row.subId, {
    ref: row.o.ref,
    nombre: row.o.nombre || "",
    guia: g,
    transportadora: t,
    items: items.map((it) => ({ name: it.productName || "", cantidad: it.cantidad ?? 1 })),
  });
  if (notify.ok) {
    await db.update(orders).set({ clienteNotificadoAt: new Date() }).where(eq(orders.id, id));
  }

  await logAudit("despachar_pedido", "orders", { id, ref: row.o.ref, guia: g, transportadora: t, notify });
  revalidatePath("/pedidos");
  revalidatePath("/dashboard");
  return { ok: true, notify };
}

/* ===========================================================
   ANUNCIOS (ad_map: ad_id de Meta → producto)
   =========================================================== */
export async function saveAdMap(formData: FormData) {
  await requireUser();
  if (!db) return { ok: false, error: "demo" };
  const adId = String(formData.get("adId") || "").trim();
  // Un anuncio puede tener 1 o VARIOS productos (multi-select).
  const slugs = formData.getAll("productSlug").map((s) => String(s).trim()).filter(Boolean);
  const nombreAnuncio = String(formData.get("nombreAnuncio") || "").trim();
  const activo = formData.get("activo") === "on" || formData.get("activo") === "true";
  if (!adId) return { ok: false, error: "El ad_id es obligatorio." };
  if (!slugs.length) return { ok: false, error: "Elige al menos un producto." };
  // Reemplaza las filas de este ad_id (una fila por producto, con su orden).
  await db.delete(adMap).where(eq(adMap.adId, adId));
  await db.insert(adMap).values(slugs.map((slug, i) => ({ adId, productSlug: slug, nombreAnuncio, orden: i, activo })));
  await logAudit("guardar_ad_map", "ad_map", { adId, slugs });
  revalidatePath("/anuncios");
  return { ok: true };
}

export async function deleteAdMap(adId: string) {
  await requireUser();
  if (!db || !adId) return;
  await db.delete(adMap).where(eq(adMap.adId, adId)); // borra todas las filas del anuncio
  await logAudit("eliminar_ad_map", "ad_map", { adId });
  revalidatePath("/anuncios");
}

/* ===========================================================
   PROMOCIONES
   =========================================================== */
export async function savePromotion(formData: FormData) {
  await requireUser();
  if (!db) return { ok: false, error: "demo" };
  const id = String(formData.get("id") || "");
  const titulo = String(formData.get("titulo") || "").trim();
  if (!titulo) return { ok: false, error: "El título es obligatorio." };

  const productSlug = String(formData.get("productSlug") || "");
  let productId: string | null = null;
  if (productSlug) {
    const [p] = await db.select().from(products).where(eq(products.slug, productSlug)).limit(1);
    productId = p?.id || null;
  }
  const values = {
    titulo,
    descripcion: String(formData.get("descripcion") || ""),
    productId,
    precioPromoCop: parseInt(String(formData.get("precioPromoCop") || "0").replace(/\D/g, ""), 10) || null,
    precioAntesCop: parseInt(String(formData.get("precioAntesCop") || "0").replace(/\D/g, ""), 10) || null,
    imagenUrl: String(formData.get("imagenUrl") || ""),
    activa: formData.get("activa") === "on" || formData.get("activa") === "true",
    orden: parseInt(String(formData.get("orden") || "0"), 10) || 0,
  };
  if (id) await db.update(promotions).set(values).where(eq(promotions.id, id));
  else await db.insert(promotions).values(values);
  await logAudit(id ? "editar_promo" : "crear_promo", "promotions", { titulo });
  revalidatePath("/promociones");
  return { ok: true };
}

export async function deletePromotion(id: string) {
  await requireUser();
  if (!db || !id) return;
  await db.delete(promotions).where(eq(promotions.id, id));
  revalidatePath("/promociones");
}

/* ===========================================================
   ASESORES
   =========================================================== */
export async function saveAdvisor(formData: FormData) {
  await requireUser();
  if (!db) return { ok: false, error: "demo" };
  const id = String(formData.get("id") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
  const values = {
    nombre,
    whatsapp: String(formData.get("whatsapp") || ""),
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
  };
  if (id) await db.update(advisors).set(values).where(eq(advisors.id, id));
  else await db.insert(advisors).values(values);
  revalidatePath("/asesores");
  return { ok: true };
}

export async function deleteAdvisor(id: string) {
  await requireUser();
  if (!db || !id) return;
  await db.delete(advisors).where(eq(advisors.id, id));
  revalidatePath("/asesores");
}

/* ===========================================================
   CONFIGURACIÓN DE TIENDA
   =========================================================== */
export async function saveStoreConfig(formData: FormData) {
  await requireUser();
  if (!db) return { ok: false, error: "demo" };

  const ciudades: CiudadCobertura[] = lines(String(formData.get("ciudades") || "")).map((l) => {
    const [ciudad, costo, cod] = l.split("|").map((x) => x.trim());
    return {
      ciudad: ciudad || "",
      costo_envio: parseInt((costo || "0").replace(/\D/g, ""), 10) || 0,
      contraentrega: (cod || "si").toLowerCase().startsWith("s"),
    };
  }).filter((c) => c.ciudad);

  const values = {
    nombre: String(formData.get("nombre") || "Animals Deluxe"),
    whatsapp: String(formData.get("whatsapp") || ""),
    ciudadBase: String(formData.get("ciudadBase") || ""),
    envioDefaultCop: parseInt(String(formData.get("envioDefaultCop") || "0").replace(/\D/g, ""), 10) || 0,
    ciudadesCobertura: ciudades,
    cuentasBancarias: parseCuentas(String(formData.get("cuentas") || "")),
    mensajeBienvenida: String(formData.get("mensajeBienvenida") || ""),
    branding: {
      logoUrl: String(formData.get("logoUrl") || ""),
      colorPrimario: String(formData.get("colorPrimario") || "#FF4D2E"),
      colorAcento: String(formData.get("colorAcento") || "#FFB02E"),
    },
    codForm: {
      upsellEnabled: String(formData.get("upsellEnabled") || "") === "on",
      upsellTitulo: String(formData.get("upsellTitulo") || "").trim(),
      upsellDesc: String(formData.get("upsellDesc") || "").trim(),
      upsellPrecioCop: parseInt(String(formData.get("upsellPrecioCop") || "0").replace(/\D/g, ""), 10) || 0,
    },
    updatedAt: new Date(),
  };

  const [row] = await db.select().from(storeConfig).limit(1);
  if (row) await db.update(storeConfig).set(values).where(eq(storeConfig.id, row.id));
  else await db.insert(storeConfig).values(values);
  await logAudit("guardar_config", "store_config", { nombre: values.nombre });
  revalidatePath("/configuracion");
  return { ok: true };
}

/* ===========================================================
   INTEGRACIONES (tokens cifrados AES-256)
   =========================================================== */
export async function saveIntegration(formData: FormData) {
  await requireUser();
  if (!db) return { ok: false, error: "demo" };
  const proveedor = String(formData.get("proveedor") || "");
  if (!proveedor) return { ok: false, error: "Proveedor requerido." };

  let configEnc: string | null = null;
  if (proveedor === "shopify") {
    // Shopify guarda un objeto {domain, token, apiVersion} cifrado.
    const domain = String(formData.get("storeDomain") || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const token = String(formData.get("token") || "").trim();
    const apiVersion = String(formData.get("apiVersion") || "2024-10").trim() || "2024-10";
    if (!domain || !token) return { ok: false, error: "Dominio y token de Shopify son obligatorios." };
    configEnc = encrypt(JSON.stringify({ domain, token, apiVersion }));
  } else {
    const token = String(formData.get("token") || "");
    configEnc = token ? encrypt(token) : null;
  }

  const [existing] = await db.select().from(integrations).where(eq(integrations.proveedor, proveedor)).limit(1);
  // No sobreescribir con vacío si el usuario dejó el campo en blanco (mantener el token guardado).
  if (existing) {
    if (configEnc) await db.update(integrations).set({ configEnc, activo: true }).where(eq(integrations.id, existing.id));
    else await db.update(integrations).set({ activo: true }).where(eq(integrations.id, existing.id));
  } else {
    await db.insert(integrations).values({ proveedor, configEnc, activo: true });
  }
  await logAudit("guardar_integracion", "integrations", { proveedor });
  revalidatePath("/configuracion");
  return { ok: true };
}

/* ============================================================
   CRM — clientes: alta manual, importación masiva, etapa,
   notas/tags, cupón por segmento y envío WhatsApp por segmento.
   ============================================================ */
const digits = (s: string) => (s || "").replace(/[^0-9]/g, "");

export async function crearClienteManual(data: {
  nombre?: string; telefono?: string; ciudad?: string; canal?: string; etapa?: string; notas?: string;
  comprados?: string[]; interes?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  if (!db) return { ok: false, error: "Sin base de datos" };
  const nombre = (data.nombre || "").trim();
  const telefono = (data.telefono || "").trim();
  if (!nombre && !telefono) return { ok: false, error: "Pon al menos nombre o teléfono" };
  const comprados = (data.comprados || []).filter(Boolean).slice(0, 40);
  const interes = (data.interes || []).filter(Boolean).slice(0, 40);
  await db.insert(customers).values({
    uchatSubId: "manual:" + (digits(telefono) || Date.now().toString()),
    nombre, telefono, ciudad: (data.ciudad || "").trim(),
    canalOrigen: data.canal || "manual", estado: comprados.length ? "cliente" : "nuevo",
    etapaManual: data.etapa || "", notas: (data.notas || "").trim(),
    productosCompradosManual: comprados, productosInteres: interes, ultimoContacto: new Date(),
  }).onConflictDoNothing();
  await logAudit("crear_cliente_manual", "customers", { nombre, telefono, comprados: comprados.length });
  revalidatePath("/clientes");
  return { ok: true };
}

/** Edita a mano los productos que un cliente compró / le gustan (desde el detalle). */
export async function setProductosCliente(id: string, comprados: string[], interes: string[]): Promise<{ ok: boolean }> {
  await requireUser();
  if (!db || !id) return { ok: false };
  await db.update(customers).set({
    productosCompradosManual: (comprados || []).filter(Boolean).slice(0, 40),
    productosInteres: (interes || []).filter(Boolean).slice(0, 40),
  }).where(eq(customers.id, id));
  await logAudit("editar_productos_cliente", "customers", { id, comprados: comprados?.length || 0, interes: interes?.length || 0 });
  revalidatePath("/clientes");
  return { ok: true };
}

/** Importación masiva. Acepta líneas "nombre, telefono, ciudad" o con encabezado. */
export async function importarClientes(texto: string): Promise<{ ok: boolean; creados: number; error?: string }> {
  await requireUser();
  if (!db) return { ok: false, creados: 0, error: "Sin base de datos" };
  const raw = (texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!raw.length) return { ok: false, creados: 0, error: "Pega al menos una línea" };
  // ¿encabezado? detecta columnas
  let cols = ["nombre", "telefono", "ciudad"];
  const first = raw[0].toLowerCase();
  const hasHeader = /nombre|tel|celular|ciudad|nom|phone/.test(first) && !/[0-9]{6,}/.test(first);
  if (hasHeader) { cols = raw.shift()!.split(/[,;\t]/).map((c) => c.trim().toLowerCase()); }
  const idx = (names: string[]) => cols.findIndex((c) => names.some((n) => c.includes(n)));
  const iN = idx(["nombre", "nom", "name"]);
  const iT = idx(["tel", "celular", "phone", "whats"]);
  const iC = idx(["ciudad", "city", "municipio"]);
  let creados = 0;
  for (const line of raw) {
    const parts = line.split(/[,;\t]/).map((p) => p.trim());
    const nombre = (iN >= 0 ? parts[iN] : parts[0]) || "";
    const telefono = (iT >= 0 ? parts[iT] : parts[1]) || "";
    const ciudad = (iC >= 0 ? parts[iC] : parts[2]) || "";
    if (!nombre && !telefono) continue;
    try {
      await db.insert(customers).values({
        uchatSubId: "import:" + (digits(telefono) || `${Date.now()}-${creados}`),
        nombre, telefono, ciudad, canalOrigen: "import", estado: "nuevo", ultimoContacto: new Date(),
      }).onConflictDoNothing();
      creados++;
    } catch { /* fila inválida, continúa */ }
  }
  await logAudit("importar_clientes", "customers", { creados });
  revalidatePath("/clientes");
  return { ok: true, creados };
}

export async function cambiarEtapaCliente(id: string, etapa: string): Promise<{ ok: boolean }> {
  await requireUser();
  if (!db || !id) return { ok: false };
  // "" = quitar override (vuelve a la etapa automática)
  await db.update(customers).set({ etapaManual: etapa || "" }).where(eq(customers.id, id));
  await logAudit("cambiar_etapa_cliente", "customers", { id, etapa });
  revalidatePath("/clientes");
  return { ok: true };
}

export async function guardarNotasCliente(id: string, notas: string, tags: string[]): Promise<{ ok: boolean }> {
  await requireUser();
  if (!db || !id) return { ok: false };
  await db.update(customers).set({ notas: notas || "", tags: (tags || []).filter(Boolean).slice(0, 20) }).where(eq(customers.id, id));
  revalidatePath("/clientes");
  return { ok: true };
}

/** Crea un cupón de descuento (para un segmento del CRM). */
export async function crearCuponSegmento(data: {
  codigo: string; tipo: "porcentaje" | "fijo"; valor: number; usosMax?: number; diasVence?: number;
}): Promise<{ ok: boolean; codigo?: string; error?: string }> {
  await requireUser();
  if (!db) return { ok: false, error: "Sin base de datos" };
  const codigo = (data.codigo || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!codigo) return { ok: false, error: "Código inválido" };
  const valor = Math.max(0, Math.floor(data.valor || 0));
  if (!valor) return { ok: false, error: "El valor debe ser mayor a 0" };
  const vence = data.diasVence ? new Date(Date.now() + data.diasVence * 86400_000) : null;
  try {
    await db.insert(coupons).values({
      codigo, tipo: data.tipo, valor, activo: true,
      usosMax: data.usosMax || null, vence,
    });
  } catch {
    return { ok: false, error: "Ese código ya existe" };
  }
  await logAudit("crear_cupon_segmento", "coupons", { codigo, tipo: data.tipo, valor });
  revalidatePath("/clientes");
  return { ok: true, codigo };
}

/** Envía un mensaje por WhatsApp (bot UChat) a un segmento de clientes. Fail-soft. */
export async function enviarWhatsAppSegmento(ids: string[], mensaje: string, imageUrl?: string): Promise<{ ok: boolean; enviados: number; fallidos: number; error?: string }> {
  await requireUser();
  if (!db) return { ok: false, enviados: 0, fallidos: 0, error: "Sin base de datos" };
  const clean = (ids || []).filter(Boolean);
  const texto = (mensaje || "").trim();
  const img = (imageUrl || "").trim();
  if (!clean.length || (!texto && !img)) return { ok: false, enviados: 0, fallidos: 0, error: "Faltan destinatarios o contenido (texto o imagen)" };
  const rows = await db.select({ sub: customers.uchatSubId }).from(customers).where(inArray(customers.id, clean));
  let enviados = 0, fallidos = 0;
  for (const r of rows) {
    const sub = r.sub || "";
    // solo suscriptores reales del bot (no importados/manuales/web)
    if (!sub || sub.startsWith("manual:") || sub.startsWith("import:") || sub.startsWith("web:")) { fallidos++; continue; }
    // Campaña: imagen primero (con el texto como caption) y refuerzo de texto si hace falta.
    let ok = false;
    if (img) { const ri = await uchatSendImage(sub, img, texto); ok = ri.ok; if (ri.ok && texto) { try { await uchatSendText(sub, texto); } catch { /* noop */ } } }
    if (texto && !img) { const rt = await uchatSendText(sub, texto); ok = rt.ok; }
    if (ok) enviados++; else fallidos++;
  }
  await logAudit("whatsapp_segmento", "customers", { destinatarios: clean.length, enviados, fallidos, conImagen: !!img });
  return { ok: true, enviados, fallidos };
}

/** Cuántos clientes (con WhatsApp del bot) hay en un segmento (por producto de interés, o todos). */
export async function contarSegmento(productoSlug: string): Promise<{ total: number }> {
  await requireUser();
  if (!db) return { total: 0 };
  const botOnly = sql`coalesce(uchat_sub_id,'') <> '' and uchat_sub_id not like 'manual:%' and uchat_sub_id not like 'import:%' and uchat_sub_id not like 'web:%'`;
  const where = productoSlug
    ? sql`${botOnly} and (productos_interes @> ${JSON.stringify([productoSlug])}::jsonb or productos_comprados_manual @> ${JSON.stringify([productoSlug])}::jsonb)`
    : botOnly;
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(customers).where(where);
  return { total: r?.n ?? 0 };
}

/** Envía una CAMPAÑA (texto + imagen) a un segmento por producto de interés (o a todos los del bot). */
export async function enviarCampana(productoSlug: string, mensaje: string, imageUrl: string): Promise<{ ok: boolean; enviados: number; fallidos: number; total: number; error?: string }> {
  await requireUser();
  if (!db) return { ok: false, enviados: 0, fallidos: 0, total: 0, error: "Sin base de datos" };
  if (!(mensaje || "").trim() && !(imageUrl || "").trim()) return { ok: false, enviados: 0, fallidos: 0, total: 0, error: "Falta el mensaje o la imagen" };
  const botOnly = sql`coalesce(uchat_sub_id,'') <> '' and uchat_sub_id not like 'manual:%' and uchat_sub_id not like 'import:%' and uchat_sub_id not like 'web:%'`;
  const where = productoSlug
    ? sql`${botOnly} and (productos_interes @> ${JSON.stringify([productoSlug])}::jsonb or productos_comprados_manual @> ${JSON.stringify([productoSlug])}::jsonb)`
    : botOnly;
  const rows = await db.select({ id: customers.id }).from(customers).where(where);
  const r = await enviarWhatsAppSegmento(rows.map((x) => x.id), mensaje, imageUrl || undefined);
  return { ...r, total: rows.length };
}

/* ============================================================
   Pedido MANUAL desde el panel (asesor humano). Reutiliza la
   MISMA lógica del bot (createOrder: flete por valor, ref AD-XXXX,
   idempotencia) + dispara Purchase a Meta CAPI. canal="asesor".
   ============================================================ */
export interface PedidoManualInput {
  nombre: string; cedula: string; telefono: string; ciudad: string; departamento?: string;
  direccion: string; slug: string; presentacion?: string; cantidad?: number;
  subId?: string;
}
export async function crearPedidoManual(
  data: PedidoManualInput, force?: boolean,
): Promise<{ ok: boolean; ref?: string; total?: number; duplicate?: boolean; error?: string; campos?: string[] }> {
  await requireUser();
  if (!db) return { ok: false, error: "Sin base de datos" };

  // Validación de obligatorios
  const req: Record<string, string> = {
    nombre: data.nombre, cedula: data.cedula, telefono: data.telefono,
    ciudad: data.ciudad, direccion: data.direccion, slug: data.slug,
  };
  const campos = Object.entries(req).filter(([, v]) => !String(v || "").trim()).map(([k]) => k);
  if (campos.length) return { ok: false, error: "Faltan campos obligatorios", campos };

  const catalog = await getProducts();
  const prod = catalog.find((p) => p.slug === data.slug);
  if (!prod) return { ok: false, error: "Producto no válido", campos: ["slug"] };

  const telClean = data.telefono.replace(/\D/g, "");
  const cantidad = Math.max(1, parseInt(String(data.cantidad || 1), 10) || 1);

  // Idempotencia: pedido reciente (<10 min) con mismo teléfono + producto → avisar
  if (!force) {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const recent = await db
      .select({ ref: orders.ref })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(and(eq(orders.telefono, data.telefono), eq(orderItems.productSlug, data.slug), gte(orders.createdAt, since)))
      .limit(1);
    if (recent[0]) return { ok: false, duplicate: true, ref: recent[0].ref, error: `Ya existe un pedido similar (${recent[0].ref}) creado hace menos de 10 min.` };
  }

  // Cliente: enlazar por sub_id, luego por teléfono, o crear (canal asesor)
  let customerId = "";
  const sub = (data.subId || "").trim();
  if (sub) { const [c] = await db.select().from(customers).where(eq(customers.uchatSubId, sub)).limit(1); if (c) customerId = c.id; }
  if (!customerId) { const [c] = await db.select().from(customers).where(eq(customers.telefono, data.telefono)).limit(1); if (c) customerId = c.id; }
  if (!customerId) {
    const uid = sub || "asesor:" + telClean;
    const [c] = await db.insert(customers).values({
      uchatSubId: uid, nombre: data.nombre, telefono: data.telefono, ciudad: data.ciudad,
      departamento: data.departamento || "", direccion: data.direccion,
      canalOrigen: "asesor", estado: "cliente", ultimoContacto: new Date(),
    }).onConflictDoNothing().returning();
    customerId = c?.id || "";
    if (!customerId) { const [c2] = await db.select().from(customers).where(eq(customers.uchatSubId, uid)).limit(1); customerId = c2?.id || ""; }
  }

  // subId: en "force" único para saltar la idempotencia interna de createOrder
  const subId = force ? `asesor:${telClean}:${Date.now()}` : `asesor:${telClean}`;
  const order = await createOrder({
    subId, customerId: customerId || "demo-manual", // demo- => createOrder guarda customer_id null
    items: [{ slug: data.slug, presentacion: data.presentacion || undefined, cantidad }],
    nombre: data.nombre, telefono: data.telefono, ciudad: data.ciudad, direccion: data.direccion,
    cedula: data.cedula, metodo: "contraentrega", canal: "asesor", catalog,
  });

  if (!order.reused) {
    const meta = await sendMetaPurchase({
      ref: order.ref, valueCop: order.total_cop, phone: data.telefono, nombre: data.nombre,
      ciudad: data.ciudad, contentIds: [data.slug], actionSource: "phone_call",
    });
    await logAudit("crear_pedido_manual", "orders", { ref: order.ref, total: order.total_cop, meta: meta.ok, meta_skip: meta.skipped });
  }
  revalidatePath("/pedidos");
  revalidatePath("/dashboard");
  return { ok: true, ref: order.ref, total: order.total_cop, duplicate: order.reused };
}
