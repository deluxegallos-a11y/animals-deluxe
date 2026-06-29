# ANÁLISIS — Plataforma web de Animals Deluxe (cómo se comunica con el bot)

> PASO 2. Basado en el código real desplegado (`ANIMALS_DELUXE/`, prod en
> `https://animals-deluxe.vercel.app`).

## 1. Stack
- **Next.js 15** (App Router) · React 19 · TypeScript · **Drizzle ORM** · **Supabase** (Postgres +
  Storage + Auth) · Zod. Deploy en Vercel.
- Capa bot: `lib/ai/*` (bridge, data, search, present, keywords, orders, format, types).
- Espejo **Shopify** (`lib/shopify.ts`, `lib/shopify-sync.ts`): la plataforma es la fuente de verdad
  y replica producto/pedido a Shopify.

## 2. Endpoints que consume el bot (`/api/ai/*`, POST, header `x-bridge-token`)
15 endpoints (ver README/contrato). Wrapper `withBridge`: auth en tiempo constante, Zod,
`noNulls` (nunca null), rate-limit, upsert de `customers` por `sub_id`, `audit_log` + `events`.
Clave: `buscar-producto`, `recomendar`, `producto`, `cobertura`, `cupon`, `registrar-cliente`,
`crear-pedido` (crea pedido + espejo Shopify), `estado-pedido`, `asignar-asesor`, `escalar`.

## 3. Esquema de PRODUCTO (tabla `products`, real)
`slug, name, category_id, audience, origin, price_cop, presentations(jsonb [{label,priceCOP}]),
image, image_url, badges[], tagline, short_desc, benefits[], ingredients[], usage, pitch,
faq[], keywords[], disclaimer, stock, activo, shopify_product_id, shopify_sync, …`

Lo que el external request **devuelve hoy** (`lib/ai/present.ts → publicProduct`): name, priceCOP,
presentations, benefits, ingredients, usage, pitch, faq, tagline, shortDesc, imageUrl, disclaimer,
url + `mensaje`.

## 4. Cómo crea/edita productos
Panel admin (`/productos`) con CRUD; al guardar escribe en Supabase y **espeja a Shopify** (Admin
API). El bot lee vía `/api/ai/*`. La web pública lee de la misma DB.

## 5. Comunicación con el bot
- **Patrón backend-bridge** (UChat nunca habla con Supabase directo): `x-bridge-token` (Bearer-like)
  en cada request, guardado en el bot como valor del header (ya barrido a prod).
- Identificación de producto: **por texto** (`q`) con búsqueda **fuzzy** (keywords + `pg_trgm`).
- Pedido: el bot manda los datos del cliente a `crear-pedido` → la plataforma crea la orden (DB +
  Shopify), devuelve `ref`. **No se manda carrito/checkout al cliente** (venta 100% WhatsApp).

## 6. Huecos para alcanzar el patrón Chatea Pro (qué falta en la plataforma)
| Hueco | Qué agregar |
|---|---|
| **`producto_contexto` rico** | bloque compacto con todo lo vendible (ver `PROMPT_CURSOR_CONTENIDO_PRODUCTOS.md`) |
| **Contenido por producto pobre** | `keywords=[]`, `faq=[]`, sin `objeciones`; hay que enriquecer los 41 |
| **Identificación por `ad_id`** | columna `ad_ids[]` por producto + endpoint `GET /api/bot/producto?ad_id=` |
| **Prompt de venta por producto** | campo `sales_prompt` generado con el meta-prompt de 6 etapas y guardado en DB |
| **Recolección de datos** | hoy la hace el agente; el patrón Chatea Pro la hace por `ai_task` (más confiable). La plataforma ya recibe los datos en `crear-pedido`/`registrar-cliente`: OK. |
| **Estados/tableros** | el bot maneja los estados; la plataforma podría exponer `estado` del lead/pedido para sincronizar |

## 7. Datos de conexión (confirmados)
- **URL prod:** `https://animals-deluxe.vercel.app`
- **Header:** `x-bridge-token: <BRIDGE_TOKEN>` (ya configurado en los 15 external requests del bot).
- **Lectura pública** (web/CORS): `GET /api/products`, `/api/products/[slug]`, `/api/categories`,
  `/api/products/search?q=` (con `x-api-key`).
