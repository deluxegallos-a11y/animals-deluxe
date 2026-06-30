/* ===========================================================
   Animals Deluxe · Capa Shopify Admin API (GraphQL)
   ------------------------------------------------------------
   La PLATAFORMA es la fuente de verdad. Shopify es el espejo del
   catálogo y el libro de pedidos. Aquí vive el cliente GraphQL con
   retries + manejo de rate limit (THROTTLED / 429 / 5xx) y las
   funciones de dominio: createProduct, updateProduct, archiveProduct,
   createOrder, getVariantId.

   API: GraphQL Admin API (REST de productos quedó deprecado en 2025-04).
   Credenciales: ENV primero; si no, integración cifrada (AES-256) en DB.
   =========================================================== */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { integrations } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";

export const OPTION_NAME = "Presentación";
const DEFAULT_API_VERSION = "2024-10";

export interface ShopifyCreds {
  domain: string; // tu-tienda.myshopify.com
  token: string; // shpat_...
  apiVersion: string; // 2024-10
}

/* Custom App con grant_type=client_credentials: key+secret → token 24h.
   Lo cacheamos en memoria y lo renovamos solo cuando está por vencer. */
let ccCache: { token: string; exp: number } | null = null;
async function getClientCredentialsToken(domain: string, key: string, secret: string): Promise<string | null> {
  if (ccCache && ccCache.exp > Date.now() + 60_000) return ccCache.token;
  try {
    const r = await fetch(`https://${domain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: key, client_secret: secret, grant_type: "client_credentials" }),
    });
    const j = (await r.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    ccCache = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 86400) * 1000 };
    return j.access_token;
  } catch {
    return null;
  }
}

/** Resuelve credenciales: ENV del server primero, luego integración cifrada en DB. */
export async function getShopifyCreds(): Promise<ShopifyCreds | null> {
  const envDomain = process.env.SHOPIFY_STORE_DOMAIN || "";
  const envToken = process.env.SHOPIFY_ADMIN_API_TOKEN || "";
  const envVersion = process.env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION;
  if (envDomain && envToken) {
    return { domain: normalizeDomain(envDomain), token: envToken, apiVersion: envVersion };
  }
  // Custom App: con key+secret obtenemos y renovamos el token solos (no expira).
  const key = process.env.SHOPIFY_API_KEY || "";
  const secret = process.env.SHOPIFY_API_SECRET || "";
  if (envDomain && key && secret) {
    const token = await getClientCredentialsToken(normalizeDomain(envDomain), key, secret);
    if (token) return { domain: normalizeDomain(envDomain), token, apiVersion: envVersion };
  }
  // Fallback: credenciales guardadas (cifradas) desde el panel.
  if (!db) return null;
  try {
    const [row] = await db.select().from(integrations).where(eq(integrations.proveedor, "shopify")).limit(1);
    if (!row?.configEnc || row.activo === false) return null;
    const cfg = JSON.parse(decrypt(row.configEnc)) as Partial<ShopifyCreds>;
    if (!cfg.domain || !cfg.token) return null;
    return { domain: normalizeDomain(cfg.domain), token: cfg.token, apiVersion: cfg.apiVersion || DEFAULT_API_VERSION };
  } catch {
    return null;
  }
}

export async function shopifyConfigured(): Promise<boolean> {
  return (await getShopifyCreds()) !== null;
}

function normalizeDomain(d: string): string {
  return d.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

/** URL al detalle de la orden en el admin de Shopify (para el panel). */
export function shopifyOrderAdminUrl(domain: string, orderId: string): string {
  const numeric = orderId.split("/").pop() || orderId; // gid://shopify/Order/123 → 123
  return `https://${normalizeDomain(domain)}/admin/orders/${numeric}`;
}

/* ===========================================================
   Cliente GraphQL con retry + rate limit.
   =========================================================== */
export class ShopifyError extends Error {
  constructor(message: string, public detail?: unknown) {
    super(message);
    this.name = "ShopifyError";
  }
}

const MAX_RETRIES = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
  extensions?: { cost?: { throttleStatus?: { currentlyAvailable: number; restoreRate: number } } };
}

/** Ejecuta una query/mutation GraphQL contra el Admin API con reintentos. */
export async function shopifyGraphQL<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {},
  creds?: ShopifyCreds,
): Promise<T> {
  const c = creds || (await getShopifyCreds());
  if (!c) throw new ShopifyError("Shopify no está configurado (faltan SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_API_TOKEN).");

  const url = `https://${c.domain}/admin/api/${c.apiVersion}/graphql.json`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": c.token,
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch (e) {
      // error de red → reintentar con backoff
      if (attempt < MAX_RETRIES) { await sleep(backoff(attempt)); continue; }
      throw new ShopifyError("Fallo de red contra Shopify", e);
    }

    // 429 / 5xx → respetar Retry-After y reintentar
    if (res.status === 429 || res.status >= 500) {
      if (attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get("Retry-After")) || 0;
        await sleep(retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
        continue;
      }
      throw new ShopifyError(`Shopify respondió ${res.status} tras ${MAX_RETRIES} reintentos.`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ShopifyError(`Shopify HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as GraphQLResponse<T>;

    // THROTTLED a nivel GraphQL → backoff y reintento
    const throttled = json.errors?.some((e) => e.extensions?.code === "THROTTLED");
    if (throttled && attempt < MAX_RETRIES) {
      const status = json.extensions?.cost?.throttleStatus;
      const waitMs = status ? Math.ceil((1000 / Math.max(1, status.restoreRate)) * 200) : backoff(attempt);
      await sleep(waitMs);
      continue;
    }

    if (json.errors?.length) {
      throw new ShopifyError(json.errors.map((e) => e.message).join("; "), json.errors);
    }
    if (!json.data) throw new ShopifyError("Respuesta de Shopify sin data.");
    return json.data;
  }
  throw new ShopifyError("Shopify: reintentos agotados.");
}

function backoff(attempt: number): number {
  return Math.min(8000, 500 * 2 ** attempt); // 0.5s, 1s, 2s, 4s, 8s
}

function throwUserErrors(scope: string, errs?: Array<{ field?: string[] | null; message: string }>) {
  if (errs?.length) {
    throw new ShopifyError(`${scope}: ${errs.map((e) => `${(e.field || []).join(".")} ${e.message}`).join("; ")}`, errs);
  }
}

/* ===========================================================
   Tipos de entrada de dominio (desacoplados de Drizzle).
   =========================================================== */
export interface ShopifyVariantInput {
  label: string; // valor de la opción "Presentación"
  priceCOP: number;
  sku?: string;
}
export interface ShopifyProductInput {
  title: string;
  bodyHtml?: string;
  imageUrl?: string;
  tags?: string[];
  variants: ShopifyVariantInput[];
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
}
export interface ShopifyProductResult {
  productId: string; // gid://shopify/Product/...
  /** Mapa label → variantId (gid) para guardar en la presentación. */
  variantIdByLabel: Record<string, string>;
}

/* ---- productSet: crea/actualiza producto + opción + variantes en una llamada ---- */
const PRODUCT_SET = /* GraphQL */ `
  mutation AdSetProduct($input: ProductSetInput!, $synchronous: Boolean!) {
    productSet(input: $input, synchronous: $synchronous) {
      product {
        id
        variants(first: 100) { nodes { id selectedOptions { name value } } }
      }
      userErrors { field message }
    }
  }`;

function buildProductSetInput(input: ShopifyProductInput, productId?: string) {
  const labels = input.variants.map((v) => v.label || "Unidad");
  const set: Record<string, unknown> = {
    title: input.title,
    descriptionHtml: input.bodyHtml || "",
    status: input.status || "ACTIVE",
    tags: input.tags || [],
    productOptions: [{ name: OPTION_NAME, values: labels.map((name) => ({ name })) }],
    variants: input.variants.map((v) => ({
      optionValues: [{ optionName: OPTION_NAME, name: v.label || "Unidad" }],
      price: String(v.priceCOP || 0),
      ...(v.sku ? { sku: v.sku } : {}),
    })),
  };
  if (productId) set.id = productId;
  // Imagen sólo al crear (evita re-subir en cada edición / duplicados).
  if (input.imageUrl && !productId) {
    set.files = [{ originalSource: input.imageUrl, contentType: "IMAGE" }];
  }
  return set;
}

async function runProductSet(input: ShopifyProductInput, creds: ShopifyCreds | undefined, productId?: string): Promise<ShopifyProductResult> {
  const data = await shopifyGraphQL<{
    productSet: {
      product: { id: string; variants: { nodes: Array<{ id: string; selectedOptions: Array<{ name: string; value: string }> }> } } | null;
      userErrors: Array<{ field?: string[] | null; message: string }>;
    };
  }>(PRODUCT_SET, { input: buildProductSetInput(input, productId), synchronous: true }, creds);

  throwUserErrors("productSet", data.productSet.userErrors);
  const product = data.productSet.product;
  if (!product) throw new ShopifyError("productSet no devolvió producto.");

  const variantIdByLabel: Record<string, string> = {};
  for (const v of product.variants.nodes) {
    const label = v.selectedOptions.find((o) => o.name === OPTION_NAME)?.value;
    if (label) variantIdByLabel[label] = v.id;
  }
  return { productId: product.id, variantIdByLabel };
}

/** Crea un producto nuevo en Shopify (con sus variantes = presentaciones). */
export async function createProduct(input: ShopifyProductInput, creds?: ShopifyCreds): Promise<ShopifyProductResult> {
  return runProductSet(input, creds);
}

/** Actualiza un producto existente en Shopify. */
export async function updateProduct(productId: string, input: ShopifyProductInput, creds?: ShopifyCreds): Promise<ShopifyProductResult> {
  return runProductSet(input, creds, productId);
}

/* ---- Publicación en el canal Online Store ----
   Sin esto, los productos creados por la Admin API quedan ACTIVE pero NO
   disponibles en la tienda online, y el cart permalink del pago anticipado
   responde 410 ("el enlace ya no existe"). Publicarlos lo arregla. */
let _onlineStorePubId: string | null = null;
async function getOnlineStorePublicationId(creds?: ShopifyCreds): Promise<string | null> {
  if (_onlineStorePubId) return _onlineStorePubId;
  const data = await shopifyGraphQL<{ publications: { nodes: Array<{ id: string; name: string }> } }>(
    `{ publications(first: 20) { nodes { id name } } }`,
    {},
    creds,
  );
  _onlineStorePubId =
    data.publications.nodes.find((p) => /online store/i.test(p.name))?.id || null;
  return _onlineStorePubId;
}

/** Publica un producto en el canal Online Store (idempotente). Necesario para que
 *  el cart permalink (pago anticipado) reconozca la variante. */
export async function publishProductOnline(productId: string, creds?: ShopifyCreds): Promise<void> {
  const pubId = await getOnlineStorePublicationId(creds);
  if (!pubId) return;
  const data = await shopifyGraphQL<{
    publishablePublish: { userErrors: Array<{ field?: string[] | null; message: string }> };
  }>(
    `mutation AdPublish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) { userErrors { field message } }
    }`,
    { id: productId, input: [{ publicationId: pubId }] },
    creds,
  );
  throwUserErrors("publishablePublish", data.publishablePublish.userErrors);
}

/** Archiva un producto en Shopify (no se borra en duro). */
export async function archiveProduct(productId: string, creds?: ShopifyCreds): Promise<void> {
  const data = await shopifyGraphQL<{ productUpdate: { userErrors: Array<{ field?: string[] | null; message: string }> } }>(
    /* GraphQL */ `
      mutation AdArchiveProduct($input: ProductInput!) {
        productUpdate(input: $input) { product { id status } userErrors { field message } }
      }`,
    { input: { id: productId, status: "ARCHIVED" } },
    creds,
  );
  throwUserErrors("productUpdate(archive)", data.productUpdate.userErrors);
}

/* ---- Órdenes (libro de pedidos COD) ---- */
export interface ShopifyOrderLineItem {
  variantId?: string; // gid si la presentación está sincronizada
  title: string; // fallback / display
  priceCOP: number;
  quantity: number;
}
export interface ShopifyOrderInput {
  lineItems: ShopifyOrderLineItem[];
  nombre: string;
  telefono: string;
  ciudad: string;
  direccion: string;
  note?: string;
  tags?: string[];
}
export interface ShopifyOrderResult {
  orderId: string; // gid://shopify/Order/...
  orderName: string; // #1042
}

const ORDER_CREATE = /* GraphQL */ `
  mutation AdCreateOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      order { id name }
      userErrors { field message }
    }
  }`;

/**
 * Crea una Order en Shopify (contraentrega). NO notifica al cliente
 * (sendReceipt/sendFulfillmentReceipt en false): el cliente sólo habla por WhatsApp.
 */
export async function createOrder(input: ShopifyOrderInput, creds?: ShopifyCreds): Promise<ShopifyOrderResult> {
  const [firstName, ...rest] = (input.nombre || "Cliente WhatsApp").trim().split(/\s+/);
  const lastName = rest.join(" ") || ".";

  const lineItems = input.lineItems.map((li) =>
    li.variantId
      ? { variantId: li.variantId, quantity: li.quantity }
      : {
          // línea personalizada: permite registrar el pedido aunque la presentación
          // aún no esté sincronizada como variante en Shopify.
          title: li.title,
          quantity: li.quantity,
          priceSet: { shopMoney: { amount: String(li.priceCOP || 0), currencyCode: "COP" } },
        },
  );

  const order = {
    currency: "COP",
    financialStatus: "PENDING",
    tags: input.tags && input.tags.length ? input.tags : ["COD", "WhatsApp", "Bot"],
    note: input.note || "Pedido contraentrega tomado por el bot Victor (WhatsApp)",
    lineItems,
    shippingAddress: {
      firstName,
      lastName,
      address1: input.direccion || "Por confirmar",
      city: input.ciudad || "",
      phone: input.telefono || "",
      countryCode: "CO",
    },
  };

  const data = await shopifyGraphQL<{
    orderCreate: { order: { id: string; name: string } | null; userErrors: Array<{ field?: string[] | null; message: string }> };
  }>(
    ORDER_CREATE,
    {
      order,
      options: { sendReceipt: false, sendFulfillmentReceipt: false, inventoryBehaviour: "DECREMENT_IGNORING_POLICY" },
    },
    creds,
  );

  throwUserErrors("orderCreate", data.orderCreate.userErrors);
  const o = data.orderCreate.order;
  if (!o) throw new ShopifyError("orderCreate no devolvió orden.");
  return { orderId: o.id, orderName: o.name };
}

/** Resuelve el variantId de un producto en Shopify por etiqueta de presentación. */
export async function getVariantId(productId: string, label: string, creds?: ShopifyCreds): Promise<string | null> {
  if (!productId) return null;
  const data = await shopifyGraphQL<{
    product: { variants: { nodes: Array<{ id: string; selectedOptions: Array<{ name: string; value: string }> }> } } | null;
  }>(
    /* GraphQL */ `
      query AdGetVariant($id: ID!) {
        product(id: $id) { variants(first: 100) { nodes { id selectedOptions { name value } } } }
      }`,
    { id: productId },
    creds,
  );
  const nodes = data.product?.variants.nodes || [];
  const match = nodes.find((v) => v.selectedOptions.some((o) => o.name === OPTION_NAME && o.value === label));
  return match?.id || nodes[0]?.id || null;
}
