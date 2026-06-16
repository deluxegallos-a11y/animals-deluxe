"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  products, categories, orders, advisors, promotions, storeConfig, integrations, auditLog,
  type Presentacion, type Ingrediente, type FaqItem, type CiudadCobertura,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

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
    disclaimer: String(formData.get("disclaimer") || ""),
    stock: parseInt(String(formData.get("stock") || "999"), 10) || 999,
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
  };

  if (id) {
    await db.update(products).set({ ...values, updatedAt: new Date() }).where(eq(products.id, id));
    await logAudit("editar_producto", "products", { id, slug });
  } else {
    const [created] = await db.insert(products).values(values).returning();
    await logAudit("crear_producto", "products", { id: created?.id, slug });
  }
  revalidatePath("/productos");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteProduct(id: string) {
  await requireUser();
  if (!db || !id) return;
  await db.delete(products).where(eq(products.id, id));
  await logAudit("eliminar_producto", "products", { id });
  revalidatePath("/productos");
}

export async function toggleProduct(id: string, activo: boolean) {
  await requireUser();
  if (!db || !id) return;
  await db.update(products).set({ activo, updatedAt: new Date() }).where(eq(products.id, id));
  revalidatePath("/productos");
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
    mensajeBienvenida: String(formData.get("mensajeBienvenida") || ""),
    branding: {
      logoUrl: String(formData.get("logoUrl") || ""),
      colorPrimario: String(formData.get("colorPrimario") || "#FF4D2E"),
      colorAcento: String(formData.get("colorAcento") || "#FFB02E"),
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
  const token = String(formData.get("token") || "");
  if (!proveedor) return { ok: false, error: "Proveedor requerido." };

  const configEnc = token ? encrypt(token) : null;
  const [existing] = await db.select().from(integrations).where(eq(integrations.proveedor, proveedor)).limit(1);
  if (existing) await db.update(integrations).set({ configEnc, activo: true }).where(eq(integrations.id, existing.id));
  else await db.insert(integrations).values({ proveedor, configEnc, activo: true });
  await logAudit("guardar_integracion", "integrations", { proveedor });
  revalidatePath("/configuracion");
  return { ok: true };
}
