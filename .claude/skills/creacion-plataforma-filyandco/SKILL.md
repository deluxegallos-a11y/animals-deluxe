---
name: creacion-plataforma-filyandco
description: "Plano maestro de cómo se construyó la plataforma FilyandCo / Animals Deluxe (e-commerce headless contraentrega + bot de WhatsApp con UChat). Contiene la arquitectura completa, el modelo de seguridad, la conexión con UChat (entrante y saliente), la integración con Shopify/Bold/MiPaquete y el flujo de despliegue. Úsala como base para construir OTRAS plataformas iguales de aquí en adelante. Triggers: 'crea otra plataforma como Animals Deluxe', 'monta una tienda con bot de UChat', 'replica FilyandCo', 'nueva plataforma para [nicho]', 'cómo se construyó esta plataforma', 'quiero un bot de ventas por WhatsApp conectado a una web', 'plataforma contraentrega con Shopify'."
---

# Creación de Plataforma — FilyandCo (blueprint Animals Deluxe)

Esta skill es el **plano reproducible** de la plataforma que ya está en producción
(Animals Deluxe). Sirve para dos cosas:

1. **Entender** cada detalle de cómo está construida (arquitectura, seguridad, UChat, pagos).
2. **Clonarla** para un nicho nuevo (otra tienda + otro bot) sin reinventar nada.

> La plataforma es **single-tenant**: una plataforma = una tienda = un bot. Para un
> negocio nuevo se levanta una instancia nueva con este mismo molde, no un multi-tenant.

> **Archivos de apoyo en esta skill:**
> - `plantilla.env` — todas las env vars listas para copiar a `.env.local` de una instancia nueva.
> - `prompt-agente-vendedor.md` — patrón del AI Agent de UChat (reglas duras reutilizables).

---

## 0. Qué es la plataforma (visión de una línea)

E-commerce **headless de contraentrega (COD)** con tres caras sobre el mismo código:

- **Web pública** (storefront + landings por producto) → Next.js App Router en Vercel.
- **Panel admin** (productos, pedidos, despacho, anuncios, configuración) → protegido por login Supabase.
- **API del bot** (`/api/ai/*` + `/api/products/search`) → la consume un **bot de UChat** que vende por WhatsApp.

**La plataforma es la fuente de verdad.** Shopify es un *espejo* del catálogo y libro de
pedidos; el bot **no** guarda productos ni precios: los pide a la API en tiempo real.

---

## 1. Stack (lo que hay que provisionar)

| Capa | Tecnología | Notas |
|---|---|---|
| Framework | **Next.js 15 (App Router)**, React 19 | `runtime = "nodejs"` en las rutas que usan `crypto`/DB |
| Hosting | **Vercel** (Fluid Compute) | deploy manual `vercel --prod`; landings con ISR |
| DB | **Postgres (Supabase)** vía **Drizzle ORM** + driver `postgres` | pooler 6543 para la app, directo 5432 para migraciones/seed |
| Auth panel | **Supabase Auth** (`@supabase/ssr`) | middleware refresca sesión |
| Storage | **Supabase Storage** bucket público `product-images` | la `image_url` de la DB manda en prod |
| Bot / WhatsApp | **UChat** (external request entrante + API saliente) | ver §4 |
| Catálogo espejo | **Shopify Admin API (GraphQL)** | custom app, scopes write/read products+orders |
| Pago anticipado | **Bold** (link de pago + webhook firmado) | Wompi quedó desactivado |
| Guías / envíos | **MiPaquete API v2** | COD requiere activación de recaudo por parte de MiPaquete |
| Rate limit | **Upstash Redis** (opcional) | cae a in-memory por-lambda si no está |
| UI | **Tailwind v4**, framer-motion, lenis, embla | landings premium namespaced |

Node fijado a `22.x`. Sin `.env.local` la plataforma arranca en **MODO DEMO** (mock, sin login).

---

## 2. Estructura de carpetas (mapa mental)

```
app/
  api/
    ai/*            → endpoints del bot (crear-pedido, estado-pedido, buscar-producto,
                      recomendar, cobertura, promociones, link-pago, escalar, ...)
    products/search → búsqueda tolerante a typos para el bot (x-api-key)
    webhooks/       → uchat, bold, wompi (verificados por token/firma)
    admin/          → tareas internas (backfill, retry-sync)
    track, upload, categories, mp-webhook
  (web pública: home, /producto/*, landings /gallos /caballos /perros)
  (panel admin: pedidos, anuncios, configuración — bajo login)
lib/
  ai/       → bridge.ts (núcleo auth+validación), search, orders, shipping,
              notificaciones (envío UChat saliente), present, format, keywords
  db/       → client.ts (Drizzle), schema.ts (tablas)
  supabase/ → middleware.ts, config.ts (auth)
  crypto.ts → AES-256-GCM + safeEqual (comparación tiempo constante)
  ratelimit.ts, uchat.ts (cliente saliente)
bot_uchat/  → documentación del bot (contrato external request, prompts del agente)
middleware.ts → gate de rutas públicas vs protegidas
```

---

## 3. Modelo de seguridad (el corazón — cópialo tal cual)

Cada superficie tiene su **propio** mecanismo de autenticación. No se mezclan.

| Superficie | Mecanismo | Header / campo | Verificación |
|---|---|---|---|
| `/api/ai/*` (bot → plataforma) | token compartido | `x-bridge-token` = `BRIDGE_TOKEN` | `safeEqual` (tiempo constante) |
| `GET /api/products/search` | api key | `x-api-key` = `BOT_API_KEY` | `safeEqual` |
| `POST /api/webhooks/uchat` | token en query o header | `?token=` / `x-webhook-token` = `UCHAT_WEBHOOK_TOKEN` | `safeEqual` → 401 si no cuadra |
| `POST /api/webhooks/bold` | firma HMAC | `BOLD_WEBHOOK_SECRET` | verificar firma del payload |
| Panel admin + `/api/upload` | sesión Supabase | cookie | middleware + check dentro del handler |
| Credenciales guardadas (Shopify/Bold/UChat) | cifradas en DB | — | **AES-256-GCM** (`ENCRYPTION_KEY`, 64 hex) |

Reglas de oro que la plataforma ya respeta (mantenerlas al clonar):

1. **Comparación de tokens SIEMPRE con `safeEqual`** (nunca `===`) → evita timing attacks.
   ```ts
   import { safeEqual } from "@/lib/crypto";
   if (!safeEqual(token, expected)) return NextResponse.json({ ok:false }, { status:401 });
   ```
2. **Secretos de terceros cifrados en reposo** con `encrypt()/decrypt()` (AES-256-GCM,
   formato `base64(iv).base64(tag).base64(ct)`). El operador puede pegarlos en
   `/configuracion` y quedan cifrados en la DB.
3. **Rate limiting por IP + sub_id** en el bridge. Upstash si está; si no, in-memory.
   Falla **abierto** (degrada, no bloquea la venta).
4. **Sanitizado anti-null** (`noNulls`): todo lo que sale hacia UChat convierte
   `null`/`undefined` → `""` / `[]`. **UChat se cuelga con `null`.** Regla de oro.
5. **Validación Zod** en el body de cada endpoint del bot (`baseSchema` exige `sub_id`).
6. **Middleware allowlist**: solo son públicas `/`, `/api/*`, `/producto/*`, `/gallos`,
   `/caballos`, `/perros`. Todo lo demás exige sesión (salvo modo demo).
7. **Fail-soft en lo no crítico**: si UChat no está configurado o el cliente no tiene
   `sub_id`, las notificaciones devuelven `{ok:false, skipped:true}` — nunca lanzan.
   Lo crítico (estado + guía) ya quedó en la DB.
8. **No perder ventas**: cada intento de crear-pedido se registra en `order_attempts`
   aunque falten datos; la cédula NO bloquea el pedido.

---

## 4. Conexión con UChat (los dos sentidos)

UChat es la plataforma no-code de WhatsApp donde vive el bot. Hay **dos direcciones**:

### 4.1 ENTRANTE — el bot le pregunta a la plataforma (External Request)

El bot **no almacena catálogo**. Cuando el cliente escribe, dispara un external request:

| Campo | Valor |
|---|---|
| Nombre | `Buscar_Producto` |
| Método | `GET` |
| URL | `https://api.<dominio>/api/products/search?q={{consulta_cliente}}` |
| Headers | `Content-Type: application/json` · `x-api-key: <BOT_API_KEY>` |
| Timeout | **8 s máx** (UChat falla después) |

- `{{consulta_cliente}}` sale de `{{last_text_input}}` o de la entidad de la AI Function.
- La respuesta trae `status` ∈ `found | ambiguous | not_found | empty_query`, un `product`
  y `suggestions`. **Nunca `null`** en strings/arrays (usa `""`/`[]`).
- Se mapea cada `JSON path` → **bot field** de UChat (`producto_nombre`, `producto_precio`,
  `producto_pitch` ⭐, `producto_imagen`, etc.). El `pitch` es el guion de venta principal.
- Para acciones (crear pedido, estado, cobertura, link de pago) el bot llama a
  `/api/ai/*` con `x-bridge-token: <BRIDGE_TOKEN>` y `sub_id` en el body.

Probar:
```bash
curl "https://api.<dominio>/api/products/search?q=energia%20para%20la%20pelea" \
  -H "x-api-key: TU_BOT_API_KEY"
```

### 4.2 SALIENTE — la plataforma le habla al cliente (API de UChat)

Cuando pasa algo fuera del chat (pago Bold recibido, pedido despachado con guía), la
plataforma **envía** un WhatsApp al cliente vía la API de UChat:

- Cliente en `lib/uchat.ts` → `uchatSendText(subId, texto)`.
- Config: `UCHAT_API_TOKEN` (Bearer), `UCHAT_API_BASE=https://www.uchat.com.au/api`,
  `UCHAT_SEND_PATH=/subscriber/send-content` (confirmar endpoint exacto en el Swagger de la cuenta).
- El `uchatSubId` es el `user_id` del cliente en UChat; se guarda en `customers.uchatSubId`
  y se resuelve desde el webhook entrante o al crear el lead.
- **Fail-soft**: `notificarDespacho()` nunca lanza. Sin token o sin sub_id → `skipped`.
- El armado del mensaje es una **función pura y testeable** (`mensajeDespacho`), separada
  del envío. Cópialo así para poder testear sin red.

### 4.3 Webhook de UChat → plataforma

`POST /api/webhooks/uchat` recibe `message.received / conversation.assigned /
subscriber.tagged`. Verifica `UCHAT_WEBHOOK_TOKEN`, resuelve el `customer` por `uchatSubId`,
abre/actualiza `conversation` y guarda el `message`. **Responde 200 en <200 ms** (UChat lo exige).

---

## 5. Integraciones de negocio

- **Shopify (espejo)**: custom app, Admin API GraphQL, scopes `write_products,
  write_orders, read_products, read_orders`. El precio real vive en la DB; al cambiarlo se
  hace `UPDATE` dirigido + `syncProductToShopify`. DDL solo por Management API con token `sbp_`.
- **Bold (pago anticipado)**: link de pago; identidad `Authorization: x-api-key <BOLD_API_KEY>`;
  webhook `/api/webhooks/bold` verificado con `BOLD_WEBHOOK_SECRET`. Al confirmar pago →
  notifica al cliente por UChat.
- **MiPaquete (guías)**: API v2. Anticipado probado en vivo (nº + PDF). El recaudo de la
  guía = **solo el producto** (no producto + flete). COD (102) requiere activación de
  recaudo por parte de MiPaquete.
- **Flete**: por zonas desde Medellín; **el flete NO se suma al total a recaudar** (total = solo producto).

---

## 6. Variables de entorno (checklist para una instancia nueva)

```
# DB
DATABASE_URL=              # pooler 6543 (app)
DIRECT_DATABASE_URL=       # directo 5432 (migración/seed)
# Supabase
NEXT_PUBLIC_SUPABASE_URL= / NEXT_PUBLIC_SUPABASE_ANON_KEY= / SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=product-images
# Seguridad  (todas: openssl rand -hex 32 / 24)
BRIDGE_TOKEN=              # x-bridge-token de /api/ai/*
BOT_API_KEY=               # x-api-key de /api/products/search
ENCRYPTION_KEY=            # AES-256, 64 chars hex
UCHAT_WEBHOOK_TOKEN=       # verifica el webhook entrante de UChat
# URLs
NEXT_PUBLIC_SITE_URL= / NEXT_PUBLIC_WHATSAPP=
# Shopify
SHOPIFY_STORE_DOMAIN= / SHOPIFY_ADMIN_API_TOKEN=shpat_... / SHOPIFY_API_VERSION=2024-10
# Bold
BOLD_API_KEY= / BOLD_WEBHOOK_SECRET=
# UChat saliente
UCHAT_API_TOKEN= / UCHAT_API_BASE=https://www.uchat.com.au/api / UCHAT_SEND_PATH=/subscriber/send-content
# Rate limit (opcional)
UPSTASH_REDIS_REST_URL= / UPSTASH_REDIS_REST_TOKEN=
```

Genera los secretos con `openssl rand -hex 32` (y `-hex 24` para `BOT_API_KEY`).

---

## 7. Receta para CLONAR la plataforma a un nicho nuevo

Cuando el usuario pida "otra plataforma como esta para [nicho]", sigue estos pasos:

1. **Copiar el molde**: mismo repo Next.js/Drizzle. Cambiar nombre, dominio, marca, colores.
2. **Provisionar infra**: nuevo proyecto Supabase (DB + Auth + bucket), nuevo proyecto Vercel,
   nueva custom app de Shopify, cuentas Bold/MiPaquete/UChat del cliente.
3. **Generar secretos nuevos** (§6) — NO reutilizar los de otra instancia.
4. **Sembrar catálogo**: `npm run seed` con los productos del nicho; subir imágenes al bucket.
5. **Cablear el bot en UChat**:
   - External Request `Buscar_Producto` → `/api/products/search` con `x-api-key`.
   - AI Functions/flows que llamen a `/api/ai/*` con `x-bridge-token`.
   - Bot fields mapeados (§4.1). Webhook entrante con `UCHAT_WEBHOOK_TOKEN`.
   - Prompt del agente vendedor (ver `bot_uchat/04_PROMPT_AGENTE_VENDEDOR.md` del original).
6. **Configurar webhooks**: Bold → `/api/webhooks/bold`; UChat → `/api/webhooks/uchat`.
7. **Landings**: reutilizar la infra de landings (namespaced, Tailwind con alcance,
   conectadas a precios/checkout/reseñas reales). Precio del checkout = SKU real.
8. **Verificar seguridad** (§3): safeEqual en todos los tokens, secretos cifrados,
   sanitizado anti-null, rate limit, allowlist del middleware.
9. **Deploy**: `vercel --prod`. Landings con ISR. Probar el curl de §4.1 y un pedido de punta a punta.

---

## 8. Trampas conocidas (no repetir errores ya resueltos)

- **UChat + `null` = cuelgue.** Siempre `noNulls`. Strings vacíos, no null.
- **Timeout de external request = 8 s.** `/api/products/search` debe responder rápido.
- **Webhook UChat < 200 ms.** Responde 200 y haz el trabajo mínimo síncrono.
- **El flete NO va en el recaudo** ni en el total. Recaudo = solo producto.
- **La cédula no bloquea el pedido** (se pierde la venta). Registrar el intento igual.
- **El precio real vive en la DB**, no en el JSON. Shopify es espejo, se sincroniza.
- **Imágenes**: la `image_url` de la DB manda en prod; el store sirve desde `/products/`.
- **DDL en Supabase** solo por Management API con token `sbp_` (el runtime no puede `ALTER`).
- **Rate limit falla abierto**: no tumbes ventas por un fallo de Upstash.

---

## 9. Cómo usar esta skill

- Si el usuario pregunta **"cómo está construido X"** → responde desde las secciones §1–§6
  citando el archivo real (`middleware.ts`, `lib/crypto.ts`, `lib/ai/bridge.ts`,
  `app/api/webhooks/uchat/route.ts`, `lib/ai/notificaciones.ts`, `bot_uchat/*`).
- Si pide **"crea otra plataforma"** → ejecuta la receta §7 paso a paso, confirmando el
  nicho, el dominio y qué cuentas de terceros ya tiene.
- Mantén **single-tenant**: una instancia por negocio. No conviertas esto en multi-tenant
  salvo que el usuario lo pida explícitamente.
- **Nunca** hardcodees secretos: todos por env o cifrados en DB.
