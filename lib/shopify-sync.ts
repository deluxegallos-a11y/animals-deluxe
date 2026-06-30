/* ===========================================================
   Orquestación de sincronía Plataforma → Shopify.
   Aquí viven las funciones que tocan la DB (Supabase) y delegan
   las llamadas a la API en lib/shopify.ts. Regla de oro: si Shopify
   falla, NO rompemos el panel — se persiste igual y se marca
   shopify_sync = 'pending'/'error' para reintentar.
   =========================================================== */
import { eq, or, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  products, categories, orders, orderItems,
  type Presentacion,
} from "@/lib/db/schema";
import {
  getShopifyCreds, createProduct, updateProduct, archiveProduct, createOrder,
  publishProductOnline,
  type ShopifyProductInput, type ShopifyOrderLineItem, ShopifyError,
} from "@/lib/shopify";

type ProdRow = typeof products.$inferSelect;

export interface SyncResult {
  ok: boolean;
  skipped?: boolean; // Shopify no configurado
  error?: string;
  shopifyProductId?: string;
}

function buildProductInput(p: ProdRow, categoryName: string): ShopifyProductInput {
  const presentations = (p.presentations as Presentacion[]) || [];
  const variants = presentations.length
    ? presentations.map((pr) => ({ label: pr.label || "Unidad", priceCOP: pr.priceCOP || p.priceCop || 0 }))
    : [{ label: "Unidad", priceCOP: p.priceCop || 0 }];
  const bodyParts = [p.shortDesc, p.pitch].filter(Boolean);
  return {
    title: p.name,
    bodyHtml: bodyParts.map((t) => `<p>${escapeHtml(t!)}</p>`).join("\n"),
    imageUrl: p.imageUrl || (p.image && /^https?:\/\//.test(p.image) ? p.image : undefined),
    tags: categoryName ? [categoryName] : [],
    variants,
    status: p.activo === false ? "ARCHIVED" : "ACTIVE",
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Funde los variantId devueltos por Shopify dentro de las presentaciones. */
function mergeVariantIds(presentations: Presentacion[], byLabel: Record<string, string>): Presentacion[] {
  const base = presentations.length ? presentations : [{ label: "Unidad", priceCOP: 0 }];
  return base.map((pr) => ({ ...pr, shopifyVariantId: byLabel[pr.label] || pr.shopifyVariantId }));
}

/**
 * Sincroniza un producto a Shopify (crea o actualiza). Persiste IDs + estado.
 * Nunca lanza: devuelve {ok:false, error} si Shopify falla (panel no se rompe).
 */
export async function syncProductToShopify(productId: string): Promise<SyncResult> {
  if (!db) return { ok: false, skipped: true, error: "Sin DB (modo demo)." };
  const creds = await getShopifyCreds();
  if (!creds) {
    await db.update(products).set({ shopifySync: "pending", shopifySyncError: "Shopify no configurado." }).where(eq(products.id, productId));
    return { ok: false, skipped: true, error: "Shopify no configurado." };
  }

  const [row] = await db
    .select({ p: products, c: categories })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, productId))
    .limit(1);
  if (!row) return { ok: false, error: "Producto no encontrado." };

  const input = buildProductInput(row.p, row.c?.name || "");
  try {
    const result = row.p.shopifyProductId
      ? await updateProduct(row.p.shopifyProductId, input, creds)
      : await createProduct(input, creds);

    // Publica en el canal Online Store para que el cart permalink (pago anticipado)
    // reconozca la variante. No rompe el sync si falla.
    if (row.p.activo !== false) {
      try {
        await publishProductOnline(result.productId, creds);
      } catch (e) {
        console.error("publishProductOnline:", e instanceof Error ? e.message : e);
      }
    }

    const presentations = mergeVariantIds((row.p.presentations as Presentacion[]) || [], result.variantIdByLabel);
    await db
      .update(products)
      .set({
        shopifyProductId: result.productId,
        presentations,
        shopifySync: "synced",
        shopifySyncError: "",
        shopifySyncedAt: new Date(),
      })
      .where(eq(products.id, productId));
    return { ok: true, shopifyProductId: result.productId };
  } catch (e) {
    const msg = e instanceof ShopifyError ? e.message : e instanceof Error ? e.message : "Error desconocido";
    await db.update(products).set({ shopifySync: "error", shopifySyncError: msg.slice(0, 500) }).where(eq(products.id, productId));
    console.error("syncProductToShopify error:", msg);
    return { ok: false, error: msg };
  }
}

/** Archiva en Shopify (al desactivar/borrar). No rompe si falla. */
export async function archiveProductInShopify(shopifyProductId: string | null | undefined): Promise<void> {
  if (!shopifyProductId) return;
  const creds = await getShopifyCreds();
  if (!creds) return;
  try {
    await archiveProduct(shopifyProductId, creds);
  } catch (e) {
    console.error("archiveProductInShopify error:", e instanceof Error ? e.message : e);
  }
}

/** Reintenta la sincronía de todos los productos pendientes/errados. */
export async function retryPendingProducts(): Promise<{ procesados: number; ok: number; fallidos: number; resultados: Array<{ id: string; slug: string; ok: boolean; error?: string }> }> {
  if (!db) return { procesados: 0, ok: 0, fallidos: 0, resultados: [] };
  const pendientes = await db
    .select({ id: products.id, slug: products.slug })
    .from(products)
    .where(or(eq(products.shopifySync, "pending"), eq(products.shopifySync, "error"), isNull(products.shopifySync)));

  const resultados: Array<{ id: string; slug: string; ok: boolean; error?: string }> = [];
  for (const p of pendientes) {
    const r = await syncProductToShopify(p.id);
    resultados.push({ id: p.id, slug: p.slug, ok: r.ok, error: r.error });
  }
  const ok = resultados.filter((r) => r.ok).length;
  return { procesados: resultados.length, ok, fallidos: resultados.length - ok, resultados };
}

/* ===========================================================
   ÓRDENES — registra el pedido COD en Shopify (libro de pedidos).
   =========================================================== */
export interface PushOrderItem {
  slug: string;
  name: string;
  presentacionLabel: string;
  precioCop: number;
  cantidad: number;
  shopifyVariantId?: string;
}
export interface PushOrderInput {
  orderId: string; // id interno del pedido en Supabase
  nombre: string;
  telefono: string;
  ciudad: string;
  direccion: string;
  items: PushOrderItem[];
  note?: string;
}
export interface PushOrderResult {
  ok: boolean;
  skipped?: boolean;
  shopifyOrderId?: string;
  shopifyOrderName?: string;
  error?: string;
}

/**
 * Crea la orden en Shopify y guarda shopify_order_id / shopify_order_name en el
 * pedido de Supabase. Idempotente: si el pedido ya tiene shopify_order_id, no
 * duplica. No rompe el flujo del bot si Shopify falla.
 */
export async function pushOrderToShopify(input: PushOrderInput): Promise<PushOrderResult> {
  if (!db) return { ok: false, skipped: true };
  const creds = await getShopifyCreds();
  if (!creds) return { ok: false, skipped: true, error: "Shopify no configurado." };

  // Idempotencia: ¿ya tiene orden en Shopify?
  const [existing] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (existing?.shopifyOrderId) {
    return { ok: true, shopifyOrderId: existing.shopifyOrderId, shopifyOrderName: existing.shopifyOrderName || "" };
  }

  const lineItems: ShopifyOrderLineItem[] = input.items.map((it) => ({
    variantId: it.shopifyVariantId,
    title: `${it.name}${it.presentacionLabel ? ` · ${it.presentacionLabel}` : ""}`,
    priceCOP: it.precioCop,
    quantity: it.cantidad,
  }));

  try {
    const result = await createOrder(
      {
        lineItems,
        nombre: input.nombre,
        telefono: input.telefono,
        ciudad: input.ciudad,
        direccion: input.direccion,
        note: input.note,
        tags: ["COD", "WhatsApp", "Bot"],
      },
      creds,
    );
    await db
      .update(orders)
      .set({ shopifyOrderId: result.orderId, shopifyOrderName: result.orderName, updatedAt: new Date() })
      .where(eq(orders.id, input.orderId));
    return { ok: true, shopifyOrderId: result.orderId, shopifyOrderName: result.orderName };
  } catch (e) {
    const msg = e instanceof ShopifyError ? e.message : e instanceof Error ? e.message : "Error desconocido";
    console.error("pushOrderToShopify error:", msg);
    return { ok: false, error: msg };
  }
}

/** Utilidad: ¿quedan productos sin sincronizar? (para badges del panel) */
export async function countUnsynced(): Promise<number> {
  if (!db) return 0;
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(or(eq(products.shopifySync, "pending"), eq(products.shopifySync, "error")));
  return rows.length;
}
