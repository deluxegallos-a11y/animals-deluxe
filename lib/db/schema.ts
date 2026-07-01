/* ===========================================================
   Animals Deluxe · Schema Drizzle (Postgres / Supabase)
   Single-tenant (una sola tienda). Venta contraentrega (COD) por WhatsApp.
   RLS + extensiones en supabase/migration.sql.
   =========================================================== */
import {
  pgTable, uuid, text, integer, boolean, timestamp, jsonb, index,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const now = () => timestamp("created_at", { withTimezone: true }).defaultNow();

/* tipos jsonb */
export type Presentacion = { label: string; priceCOP: number; shopifyVariantId?: string };
export type Ingrediente = { name: string; detail: string };
export type FaqItem = { q: string; a: string };
export type CiudadCobertura = { ciudad: string; costo_envio: number; contraentrega: boolean };
export type Branding = { logoUrl?: string; colorPrimario?: string; colorAcento?: string };
export type CuentaBancaria = { banco: string; tipo: string; numero: string; titular: string };
/** Config del formulario de contraentrega (upsell/promo opcional, editable en el panel). */
export type CodFormConfig = {
  upsellEnabled?: boolean;
  upsellTitulo?: string;
  upsellDesc?: string;
  upsellPrecioCop?: number;
};

/** Estado de sincronización con Shopify (plataforma = fuente de verdad). */
export type ShopifySync = "synced" | "pending" | "error";

/* 1. categories */
export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  color: text("color").default("#FF4D2E"),
  sortOrder: integer("sort_order").default(0),
  createdAt: now(),
});

/* 2. products */
export const products = pgTable(
  "products",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    categoryId: uuid("category_id"),
    audience: text("audience").default(""),
    origin: text("origin").default("co"), // us | co | br | mx
    priceCop: integer("price_cop").notNull().default(0),
    presentations: jsonb("presentations").$type<Presentacion[]>().default([]),
    image: text("image").default(""),
    imageUrl: text("image_url").default(""),
    badges: jsonb("badges").$type<string[]>().default([]),
    tagline: text("tagline").default(""),
    shortDesc: text("short_desc").default(""),
    benefits: jsonb("benefits").$type<string[]>().default([]),
    ingredients: jsonb("ingredients").$type<Ingrediente[]>().default([]),
    usage: text("usage").default(""),
    pitch: text("pitch").default(""),
    faq: jsonb("faq").$type<FaqItem[]>().default([]),
    keywords: jsonb("keywords").$type<string[]>().default([]),
    objeciones: jsonb("objeciones").$type<Record<string, string>>().default({}),
    adIds: jsonb("ad_ids").$type<string[]>().default([]),
    salesPrompt: text("sales_prompt").default(""),
    disclaimer: text("disclaimer").default(""),
    stock: integer("stock").default(999),
    activo: boolean("activo").default(true),
    envioGratis: boolean("envio_gratis").default(false),
    // --- Espejo Shopify (la plataforma es la fuente de verdad) ---
    shopifyProductId: text("shopify_product_id"),
    shopifySync: text("shopify_sync").$type<"synced" | "pending" | "error">().default("pending"),
    shopifySyncError: text("shopify_sync_error").default(""),
    shopifySyncedAt: timestamp("shopify_synced_at", { withTimezone: true }),
    // search_text es columna generada en SQL (unaccent); no se escribe desde Drizzle.
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({ catIdx: index("idx_products_category").on(t.categoryId) }),
);

/* 3. customers (leads) */
export const customers = pgTable("customers", {
  id: id(),
  uchatSubId: text("uchat_sub_id").unique(),
  nombre: text("nombre").default(""),
  telefono: text("telefono").default(""),
  departamento: text("departamento").default(""),
  ciudad: text("ciudad").default(""),
  direccion: text("direccion").default(""),
  canalOrigen: text("canal_origen").default("whatsapp"), // whatsapp | instagram | web
  estado: text("estado").default("nuevo"), // nuevo | interesado | cliente
  notas: text("notas").default(""),
  ultimoContacto: timestamp("ultimo_contacto", { withTimezone: true }).defaultNow(),
  createdAt: now(),
});

/* 4. advisors (asesores de venta) — round-robin */
export const advisors = pgTable("advisors", {
  id: id(),
  nombre: text("nombre").notNull(),
  whatsapp: text("whatsapp").default(""),
  activo: boolean("activo").default(true),
  pedidosAsignados: integer("pedidos_asignados").default(0),
  createdAt: now(),
});

/* 5. coupons */
export const coupons = pgTable("coupons", {
  id: id(),
  codigo: text("codigo").notNull().unique(),
  tipo: text("tipo").default("porcentaje"), // porcentaje | fijo
  valor: integer("valor").notNull().default(0),
  activo: boolean("activo").default(true),
  usosMax: integer("usos_max"),
  usos: integer("usos").default(0),
  vence: timestamp("vence", { withTimezone: true }),
  createdAt: now(),
});

/* 6. orders (pedidos) */
export const orders = pgTable(
  "orders",
  {
    id: id(),
    ref: text("ref").notNull().unique(),
    customerId: uuid("customer_id"),
    estado: text("estado").default("pendiente_confirmacion"),
    // pendiente_confirmacion | confirmado | despachado | entregado | pagado | cancelado
    metodoPago: text("metodo_pago").default("contraentrega"), // contraentrega | anticipado
    subtotalCop: integer("subtotal_cop").default(0),
    descuentoCop: integer("descuento_cop").default(0),
    envioCop: integer("envio_cop").default(0),
    totalCop: integer("total_cop").default(0),
    ciudad: text("ciudad").default(""),
    direccion: text("direccion").default(""),
    telefono: text("telefono").default(""),
    nombre: text("nombre").default(""),
    couponId: uuid("coupon_id"),
    advisorId: uuid("advisor_id"),
    notas: text("notas").default(""),
    idempotencyKey: text("idempotency_key"),
    // --- Despacho / postventa (manual por ahora; luego automático vía transportadora) ---
    guia: text("guia").default(""),                       // número de guía de la transportadora
    transportadora: text("transportadora").default(""),   // Interrapidísimo | Servientrega | Coordinadora | Envía ...
    despachadoAt: timestamp("despachado_at", { withTimezone: true }),        // cuándo se marcó despachado
    clienteNotificadoAt: timestamp("cliente_notificado_at", { withTimezone: true }), // cuándo se avisó al cliente por WhatsApp
    // --- Espejo Shopify (registro/libro de pedidos) ---
    shopifyOrderId: text("shopify_order_id"),
    shopifyOrderName: text("shopify_order_name").default(""),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    custIdx: index("idx_orders_customer").on(t.customerId),
    idemIdx: index("idx_orders_idem").on(t.idempotencyKey),
  }),
);

/* 7. order_items */
export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid("order_id").notNull(),
  productId: uuid("product_id"),
  productSlug: text("product_slug").default(""),
  productName: text("product_name").default(""),
  presentacionLabel: text("presentacion_label").default(""),
  precioCop: integer("precio_cop").default(0),
  cantidad: integer("cantidad").default(1),
  subtotalCop: integer("subtotal_cop").default(0),
});

/* 8. promotions */
export const promotions = pgTable("promotions", {
  id: id(),
  titulo: text("titulo").notNull(),
  descripcion: text("descripcion").default(""),
  productId: uuid("product_id"),
  categoryId: uuid("category_id"),
  precioPromoCop: integer("precio_promo_cop"),
  precioAntesCop: integer("precio_antes_cop"),
  imagenUrl: text("imagen_url").default(""),
  activa: boolean("activa").default(true),
  desde: timestamp("desde", { withTimezone: true }),
  hasta: timestamp("hasta", { withTimezone: true }),
  orden: integer("orden").default(0),
  createdAt: now(),
});

/* 9. store_config (1 fila) */
export const storeConfig = pgTable("store_config", {
  id: id(),
  nombre: text("nombre").default("Animals Deluxe"),
  whatsapp: text("whatsapp").default(""),
  ciudadBase: text("ciudad_base").default(""),
  envioDefaultCop: integer("envio_default_cop").default(0),
  ciudadesCobertura: jsonb("ciudades_cobertura").$type<CiudadCobertura[]>().default([]),
  mensajeBienvenida: text("mensaje_bienvenida").default(""),
  branding: jsonb("branding").$type<Branding>().default({}),
  // Cuentas para pago anticipado (lo lee el bot en asignar-asesor).
  cuentasBancarias: jsonb("cuentas_bancarias").$type<CuentaBancaria[]>().default([]),
  // Config del formulario de contraentrega (upsell/promo editable en el panel).
  codForm: jsonb("cod_form").$type<CodFormConfig>().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/* 10. conversations */
export const conversations = pgTable("conversations", {
  id: id(),
  customerId: uuid("customer_id"),
  estado: text("estado").default("activa"), // activa | escalada | cerrada
  asignadaA: uuid("asignada_a"),
  ultimoMensajeAt: timestamp("ultimo_mensaje_at", { withTimezone: true }).defaultNow(),
  createdAt: now(),
});

/* 11. messages */
export const messages = pgTable("messages", {
  id: id(),
  conversationId: uuid("conversation_id"),
  rol: text("rol").default("cliente"), // cliente | bot | asesor
  texto: text("texto").default(""),
  meta: jsonb("meta"),
  createdAt: now(),
});

/* 12. integrations (tokens cifrados) */
export const integrations = pgTable("integrations", {
  id: id(),
  proveedor: text("proveedor").notNull(), // uchat | wompi
  configEnc: text("config_enc"),
  activo: boolean("activo").default(true),
  createdAt: now(),
});

/* 13. audit_log */
export const auditLog = pgTable("audit_log", {
  id: id(),
  accion: text("accion").notNull(),
  entidad: text("entidad"),
  antes: jsonb("antes"),
  despues: jsonb("despues"),
  createdAt: now(),
});

/* 14. events (analytics de dominio) */
export const events = pgTable("events", {
  id: id(),
  tipo: text("tipo").notNull(),
  payload: jsonb("payload"),
  createdAt: now(),
});

/* 15. reviews (reseñas de clientes por producto) — público agrega, admin borra */
export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    productSlug: text("product_slug").notNull(),
    nombre: text("nombre").notNull(),
    ciudad: text("ciudad").default(""),
    rating: integer("rating").default(5), // 1..5
    texto: text("texto").notNull(),
    estado: text("estado").default("aprobado"), // aprobado | oculto
    createdAt: now(),
  },
  (t) => ({ bySlug: index("reviews_slug_idx").on(t.productSlug) }),
);
