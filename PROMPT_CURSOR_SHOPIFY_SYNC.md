# 🛠️ Prompt para Cursor / Claude Code — Reestructura: Plataforma ⇆ Shopify + Pedido COD por WhatsApp

> Pégalo en Claude Code dentro del proyecto `ANIMALS_DELUXE/`. Es una **adición** a la plataforma
> que ya existe (Next.js 15 + Supabase + Drizzle + `/api/ai/*` + bot UChat). NO rehagas lo que ya
> está; agrega la sincronización con Shopify y la creación automática del pedido contraentrega.

---

## PARTE 1 · Contexto (léelo antes de actuar)

La plataforma de Animals Deluxe ya está construida: panel admin, 41 productos en Supabase, web
pública y los endpoints `/api/ai/*` que consume el bot de WhatsApp (UChat). El bot ya está
construido y vende contraentrega. **Falta conectar Shopify.**

La tienda real está en **Shopify**. La regla nueva:

> **La PLATAFORMA es la fuente de verdad.** Todo lo que se crea/edita/borra en el panel de la
> plataforma se debe crear/actualizar/archivar **automáticamente en Shopify** (vía Shopify Admin
> API). La web pública y el bot siguen leyendo de la plataforma (Supabase) — Shopify es el espejo
> oficial del catálogo y el libro de pedidos.

Venta: **100% por WhatsApp, contraentrega.** Los clientes son del campo (galleros) y NO compran
por web. Por eso **NO se le manda carrito ni checkout al cliente**. El bot toma los datos por
WhatsApp, la plataforma recibe el pedido y lo **registra en Shopify** (para inventario/registro),
nada más.

---

## PARTE 2 · Tareas (production-grade, sin stubs)

### 1) Integración Shopify Admin API (capa `lib/shopify.ts`)
- Cliente para Shopify Admin API (REST o GraphQL) con credenciales en env:
  ```
  SHOPIFY_STORE_DOMAIN=tu-tienda.myshopify.com
  SHOPIFY_ADMIN_API_TOKEN=shpat_...
  SHOPIFY_API_VERSION=2024-10
  ```
- Guarda el token **cifrado** (AES-256) si lo persistes en DB; idealmente solo en env del server.
- Funciones: `createProduct`, `updateProduct`, `archiveProduct`, `createOrder` (Admin API),
  `getVariantId`. Con retries y manejo de rate limit (Shopify 429/`Retry-After`).

### 2) Sincronía Producto → Shopify (al crear/editar en el panel)
- Agrega al modelo `products` (Drizzle + migración): `shopify_product_id` (text, nullable) y, por
  presentación, `shopify_variant_id`. Si las presentaciones son variantes, guárdalas como
  `presentations: [{ label, priceCOP, shopify_variant_id }]`.
- **Al crear un producto** en el panel/`POST /api/products`: créalo también en Shopify
  (título=name, body_html=short_desc+pitch, imagen=image_url, variantes=presentaciones con su
  precio, tags=categoría) y **guarda los IDs** (`shopify_product_id`, `shopify_variant_id` por
  presentación) en Supabase.
- **Al editar** (`PUT`): actualiza el producto/variantes en Shopify.
- **Al desactivar/borrar**: archiva el producto en Shopify (no lo borres en duro).
- Si Shopify falla, **no rompas el panel**: guarda en Supabase igual, marca `shopify_sync: 'pending'`
  y reintenta con un job/endpoint `/api/admin/shopify/retry-sync`. Loguea cada sync.
- Botón en el panel "Sincronizar con Shopify" para forzar/reparar.

### 3) Pedido COD: el bot manda los datos → la plataforma crea la orden en Shopify
- El bot ya llama `POST /api/ai/crear-pedido` con: `{ sub_id, items:[{slug,presentacion,cantidad}],
  nombre, telefono, ciudad, direccion, cupon?, metodo? }`.
- En ese endpoint, además de guardar el pedido en Supabase (como ya hace):
  1. Resuelve cada item a su `shopify_variant_id` (desde la presentación del producto).
  2. **Crea una Order en Shopify** vía Admin API con:
     - `line_items`: `[{ variant_id, quantity }]`
     - `customer` / `shipping_address`: nombre, teléfono, ciudad, dirección (del cliente).
     - `financial_status: "pending"`, `tags: "COD, WhatsApp, Bot"`,
       `note: "Pedido contraentrega tomado por el bot Victor (WhatsApp)"`.
     - (opcional) `send_receipt: false`, `send_fulfillment_receipt: false` — **no notificar al
       cliente** (no queremos que reciba correos/links).
  3. Guarda en el pedido de Supabase el `shopify_order_id` y `shopify_order_name` (ej. `#1042`),
     y usa ese nombre como `ref` que devuelve al bot.
- **Idempotencia:** si llega el mismo pedido 2 veces (mismo `sub_id`+items en ventana corta), no
  dupliques la orden en Shopify.
- **NO** generes checkout, carrito ni invoice_url para el cliente. El cliente solo habla por WhatsApp.
- Asigna asesor (round-robin, ya existe) para que despache.

### 4) Pago anticipado (versión simple manual, por ahora)
- NO integres Wompi todavía. Cuando el cliente pida pago anticipado, el bot llama
  `POST /api/ai/asignar-asesor` con `{ razon: "pago_anticipado" }`.
- Ese endpoint debe devolver en `mensaje` las **cuentas bancarias** de la tienda (desde
  `store_config.cuentas_bancarias`) + "un asesor te confirma el pago apenas transfieras", y marcar
  la conversación para que un asesor confirme (evento/notificación). Agrega a `store_config` el
  campo `cuentas_bancarias` (jsonb: `[{ banco, tipo, numero, titular }]`) editable en el panel.
- (Futuro, NO ahora: link de pago Wompi + webhook de confirmación automática.)

### 5) Panel
- En `/productos`: muestra el estado de sync con Shopify (✓ sincronizado / ⏳ pendiente / ✗ error)
  y el `shopify_product_id`.
- En `/pedidos`: muestra el `shopify_order_name` y un link a la orden en Shopify admin.
- En `/configuracion`: editar `cuentas_bancarias` y las credenciales de Shopify (cifradas).

---

## PARTE 3 · Lo que NO cambia
- Los nombres de campos del contrato `/api/ai/*` (el bot ya los mapea). Solo **agregas** datos
  (ref = nombre de la orden Shopify; mensaje de cuentas en asignar-asesor).
- La web pública y el bot siguen leyendo de la plataforma (Supabase). Shopify es espejo + registro.
- Todo sigue siendo **contraentrega** por defecto.

## PARTE 4 · Qué devolver al terminar
- Confirmación de que crear un producto en el panel lo crea en Shopify (con su `shopify_product_id`).
- `curl` de `/api/ai/crear-pedido` que cree una orden real en Shopify (sandbox/dev store) y devuelva
  `ref` = nombre de la orden.
- Variables de entorno nuevas que configuraste (`SHOPIFY_*`).
- La URL pública + `BRIDGE_TOKEN` (para que yo conecte el bot).
