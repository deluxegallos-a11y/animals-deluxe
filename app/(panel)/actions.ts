"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  products, categories, orders, advisors, promotions, storeConfig, integrations, auditLog, reviews,
  type Presentacion, type Ingrediente, type FaqItem, type CiudadCobertura, type CuentaBancaria,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { syncProductToShopify, archiveProductInShopify, retryPendingProducts } from "@/lib/shopify-sync";

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
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
    envioGratis: formData.get("envioGratis") === "on" || formData.get("envioGratis") === "true",
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
