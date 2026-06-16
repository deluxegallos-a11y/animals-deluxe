# 🐓 Animals Deluxe — Plataforma e-commerce headless (Web + Panel + API del bot)

Tienda de suplementos para gallos, pollos, perros y caballos en Colombia, **contraentrega (COD)**
por WhatsApp. Una sola fuente de verdad (Supabase) alimenta la web pública, el panel admin y el
bot de UChat. Construida con el mismo patrón de producción que la plataforma dental (Sonría):
**Next.js 15 · React 19 · TypeScript · Drizzle ORM · Supabase · Zod**.

> **Modo demo:** sin `.env.local` la app corre con el catálogo semilla (mock, sin login). Apenas
> pones las llaves de Supabase, se activan la base de datos real y el login del panel.

---

## Arquitectura

```
Cliente (WhatsApp/IG)
   ↓
UChat (AI Agent + AI Functions + sub-flows)
   ↓  External Request (POST JSON + header x-bridge-token)
Plataforma Next.js  /api/ai/*          ← withBridge (auth, Zod, anti-null, rate-limit, audit)
   ↓  Drizzle (DATABASE_URL, server-side)
Supabase (Postgres + Storage, RLS)
   ↑  lectura pública
Web pública (/  ·  /producto/[slug])   ·   Panel admin (/dashboard, /productos, …)
```

UChat **nunca** habla con Supabase directo: todo pasa por `/api/ai/*` (una sola auth).

---

## Arrancar local

```bash
npm install
npm run dev            # http://localhost:3000  (modo demo si no hay .env.local)
npm test               # 13 tests (búsqueda fuzzy + cálculo de pedidos)
npm run build          # build de producción
```

Rutas: `/` tienda · `/producto/[slug]` ficha · `/login` `/signup` panel ·
`/dashboard` `/productos` `/pedidos` `/clientes` `/conversaciones` `/promociones`
`/asesores` `/configuracion`.

---

## Go-live (checklist)

1. **Crear proyecto Supabase** y copiar de *Settings → API*: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. De *Settings → Database*:
   `DATABASE_URL` (pooler 6543) y `DIRECT_DATABASE_URL` (5432).
2. **Migración:** pega `supabase/migration.sql` en *SQL Editor → Run* (crea tablas, búsqueda
   fuzzy `pg_trgm`, RLS, trigger, bucket `product-images` y la RPC `search_products`).
3. **Secrets:** genera `BRIDGE_TOKEN` y `BOT_API_KEY` (`openssl rand -hex 32` / `-hex 24`) y
   `ENCRYPTION_KEY` (`openssl rand -hex 32`, 64 chars). Copia `.env.example` → `.env.local`.
4. **Seed:** `npm run seed` (idempotente) → 10 categorías, 41 productos, 2 asesores, 1 promo,
   cupón `GALLO10` y `store_config`.
5. **Cuenta admin:** entra a `/signup` y crea tu usuario (Supabase Auth).
6. **Deploy a Vercel:** importa el repo, define **todas** las env vars de `.env.example` en el
   proyecto Vercel, `Build Command = next build`. Deploy.
7. **Verifica en prod:** `POST /api/ai/buscar-producto` responde, la web carga el catálogo y el
   panel pide login.

---

## Contrato del bot — endpoints `/api/ai/*`

Todos son `POST`, JSON, header `x-bridge-token`, validación Zod, campo `mensaje`, **nunca `null`**.
Reciben siempre `sub_id` (single-tenant: sin `uchat_ws`). **No renombres estos campos** o el bot deja de mapear.

| AI Function | Endpoint | Entra | Sale (campos clave) |
|---|---|---|---|
| buscar_producto | `/api/ai/buscar-producto` | `q` | `status, match, producto{…,url,imageUrl,disclaimer}, sugerencias[], mensaje` |
| ver_catalogo | `/api/ai/catalogo` | `categoria?` | `productos[], mensaje` |
| ver_producto | `/api/ai/producto` | `slug` | `producto, mensaje` |
| ver_categorias | `/api/ai/categorias` | — | `categorias[], mensaje` |
| recomendar | `/api/ai/recomendar` | `necesidad` | `productos[{…,pitch}], mensaje` |
| ver_promociones | `/api/ai/promociones` | `categoria?` | `promos[], imagen_url, mensaje` |
| verificar_cobertura | `/api/ai/cobertura` | `ciudad` | `cobertura, contraentrega, costo_envio, mensaje` |
| aplicar_cupon | `/api/ai/cupon` | `codigo` | `valido, tipo, valor, mensaje` |
| registrar_cliente | `/api/ai/registrar-cliente` | `nombre, telefono, ciudad?, direccion?` | `customer_id, mensaje` |
| crear_pedido | `/api/ai/crear-pedido` | `items[], nombre, telefono, ciudad, direccion, cupon?, metodo?` | `pedido_id, ref, total_cop, envio_cop, descuento_cop, estado, asesor, mensaje` |
| estado_pedido | `/api/ai/estado-pedido` | `ref` | `estado, total_cop, items[], mensaje` |
| link_pago | `/api/ai/link-pago` | `ref, metodo?` | `link, ref_pago, mensaje` |
| asignar_asesor | `/api/ai/asignar-asesor` | `razon?` | `asesor{nombre,whatsapp}, mensaje` |
| escalar_humano | `/api/ai/escalar` | `motivo` | `mensaje` |
| pedir_resena | `/api/ai/resena` | `sentimiento` | `link_resena, mensaje` |

**Lectura pública (web/CORS):** `GET /api/products`, `GET /api/products/[slug]`, `GET /api/categories`,
`GET /api/products/search?q=` (header `x-api-key`, contrato `{ ok, status, match, product, suggestions }`).

**Idempotencia:** `crear-pedido` usa key `sub_id:metodo:items` (incluye el método). `link-pago` y el
webhook Wompi son idempotentes. El pedido COD asigna asesor por **round-robin**.

---

## Seguridad

- `x-bridge-token` en tiempo constante (`safeEqual`). Rate-limit 60/min por IP+sub_id.
- Validación/sanitización Zod en todo input; `noNulls` convierte null→"" en profundidad.
- Upload: solo sesión admin, 5MB, jpg/png/webp, a Storage `product-images`.
- Credenciales (UChat/Wompi) cifradas **AES-256-GCM** antes de guardar.
- Webhook Wompi **fail-closed**: rechaza si la firma SHA-256 no valida.
- RLS: lectura pública de catálogo activo; escrituras solo `authenticated` + server (service_role).

---

## Conectar el bot UChat

Ver `bot_uchat/`. Apunta cada External Request a `https://<TU_URL>/api/ai/<endpoint>` con header
`x-bridge-token: <BRIDGE_TOKEN>`, mapea la respuesta a bot fields, responde al cliente y cierra con
`stop_ai_agent`.
