# 🧭 Animals Deluxe — Contexto + PROMPT MAESTRO para Claude Code (build de producción)

> **Cómo usar este archivo.** Las **Partes 1–2** son contexto para ti (fily). La **Parte 3** es
> el prompt que copias y pegas en Claude Code (en la terminal, dentro de la carpeta del proyecto).
> Está calcado del patrón **ya probado** de tu plataforma dental (`ECOSISTEMA_CLINICA_DENTAL/plataforma`),
> adaptado a e-commerce contraentrega para **Animals Deluxe**. No es un demo: es el producto final.

---

## PARTE 1 · Estado real del proyecto

| # | Componente | Dónde vive | Estado |
|---|---|---|---|
| 1 | Catálogo (10 categorías · 41 productos con pitch de venta) | `ANIMALS_DELUXE/data/catalogo-productos.json` | ✅ Listo (datos semilla) |
| 2 | Config del bot UChat (external request, prompt StoryBrand, sub-flow) | `ANIMALS_DELUXE/bot_uchat/` | ✅ Documentado |
| 3 | Plataforma de referencia (patrón a clonar) | `ECOSISTEMA_CLINICA_DENTAL/plataforma/` | ✅ Producción probada (Next 15 + Drizzle + Supabase) |
| 4 | Plataforma de producción de Animals Deluxe | repo `plataforma/` (por crear) | ❌ **Claude Code la construye** |
| 5 | Bot conversacional en UChat | workspace UChat | ⏳ Se configura aparte con `bot_uchat/` |
| 6 | Deploy a Vercel + Supabase | — | ❌ **Claude Code lo hace** |

**La cadena:** Claude Code construye la plataforma → la despliega → te da **URL pública + BRIDGE_TOKEN**
→ tú apuntas las External Requests del bot a esa URL → prueba E2E por WhatsApp.

---

## PARTE 2 · Decisiones de arquitectura (ya tomadas)

- **Single-tenant:** una sola tienda (Animals Deluxe). Sin resolución de comercio por `uchat_ws`.
- **Venta:** contraentrega (COD) por WhatsApp — el cliente paga al recibir. Wompi/Bold es **opcional**
  (anticipo/prepago) y va en sandbox si se activa.
- **Stack idéntico al de la plataforma dental:** Next.js 15 (App Router) · React 19 · TypeScript ·
  Drizzle ORM · Supabase (Postgres + Storage + Auth) · Zod. Deploy en Vercel.
- **Patrón bridge:** el bot llama endpoints `/api/ai/*` con header `x-bridge-token`. Respuestas siempre
  `{ ok, mensaje, ... }`, **nunca `null`** (UChat se cuelga). Toda mutación → `audit_log` + `events`.

---

## PARTE 3 · PROMPT PARA CLAUDE CODE  (copia desde aquí 👇)

```text
═══════════════════════════════════════════════════════════════════════════
ANIMALS DELUXE · BUILD DE PRODUCCIÓN — PLATAFORMA E-COMMERCE HEADLESS + BOT
═══════════════════════════════════════════════════════════════════════════

ROL
Eres un ingeniero full-stack senior. Vas a construir, de punta a punta y con calidad de
PRODUCCIÓN (NO un demo, NO stubs, NO "TODO: implementar"), la plataforma de Animals Deluxe:
una tienda headless de suplementos para gallos, pollos, perros y caballos en Colombia, con
venta CONTRAENTREGA por WhatsApp. Una sola fuente de verdad (Supabase) alimenta
automáticamente la web, el panel admin y el bot de UChat. Crear/editar un producto en el
panel lo publica al instante en la web y lo deja disponible para el bot, sin redeploy.

CLONA EL PATRÓN YA PROBADO. En este mismo workspace existe una plataforma de producción
para clínicas dentales en `ECOSISTEMA_CLINICA_DENTAL/plataforma/`. ESTÚDIALA y replica su
arquitectura, convenciones y nivel de calidad (no copies el dominio dental; adapta a
e-commerce). En particular reutiliza estos patrones tal cual:
  - `lib/ai/bridge.ts`  → el wrapper `withBridge`: auth por `x-bridge-token` en tiempo
     constante, validación Zod, sanitizado `noNulls` (null/undefined → "" en profundidad),
     rate-limit, helpers `audit()` y `logEvent()`, y `domainError()` para mensajes amables.
  - `lib/db/schema.ts`  → estilo Drizzle con helpers `id()`, `now()`, tablas en snake_case.
  - `lib/db/client.ts`  → cliente Drizzle que es `null` en modo demo (sin DATABASE_URL).
  - `supabase/migration.sql` → migración + RLS con función SQL y políticas por tabla.
  - `lib/ratelimit.ts`, `lib/crypto.ts` (safeEqual, AES-256), `lib/supabase/*`, `middleware.ts`.
  - Modo demo automático: si NO hay `.env.local`, la app corre con datos mock y sin login.

DATOS SEMILLA. El catálogo real está en `ANIMALS_DELUXE/data/catalogo-productos.json`
(10 categorías + 41 productos, cada uno con: slug, name, category, audience, origin,
priceCOP, presentations[], image, badges[], tagline, shortDesc, benefits[], usage, pitch).
La config del bot (external requests, prompt, sub-flow) está en `ANIMALS_DELUXE/bot_uchat/`.
NO construyas el bot de UChat: solo la plataforma y sus endpoints. El bot se conecta aparte.

═══════════════════════════════════════════════════════════════════════════
STACK (obligatorio, idéntico a la plataforma dental)
═══════════════════════════════════════════════════════════════════════════
Next.js 15 (App Router) · React 19 · TypeScript · Drizzle ORM · postgres-js ·
Supabase (Postgres + Storage + Auth) · Zod · Vercel.
Imágenes de producto: Supabase Storage (bucket público `product-images`, URLs públicas).
Sin librerías de UI pesadas: CSS propio en `app/globals.css` (estética "gallero premium",
fondo oscuro, acento naranja #FF4D2E). Todo tipado, sin `any` salvo casos justificados.

═══════════════════════════════════════════════════════════════════════════
ARQUITECTURA
═══════════════════════════════════════════════════════════════════════════
Cliente (WhatsApp/IG)
   ↓
UChat (AI Agent + AI Functions + sub-flows)
   ↓  External Request (POST JSON + header x-bridge-token)
Plataforma Next.js  /api/ai/*            ← TÚ construyes esto
   ↓  Drizzle (SERVICE_ROLE / DATABASE_URL, server-side)
Supabase (Postgres + Storage, RLS)
   ↑  lectura pública
Web pública (catálogo + ficha)  ·  Panel admin (CRUD + pedidos + leads)

Regla de oro: UChat NUNCA habla con Supabase directo. Todo pasa por /api/ai/* (una sola auth).

═══════════════════════════════════════════════════════════════════════════
1) MODELO DE DATOS  (Drizzle, snake_case, en lib/db/schema.ts)
═══════════════════════════════════════════════════════════════════════════
Single-tenant: NO hay tabla de comercios. Define estas tablas (ajusta tipos como en la
plataforma dental; usa helpers id()/now(); índices donde tenga sentido):

- categories: id, slug(unique), name, color, sort_order, created_at
- products:
    id, slug(unique), name, category_id(fk categories), audience, origin('us'|'co'|'br'|'mx'),
    price_cop(int), presentations(jsonb [{label, priceCOP}]), image, image_url,
    badges(jsonb string[]), tagline, short_desc, benefits(jsonb string[]),
    ingredients(jsonb [{name,detail}]), usage, pitch, faq(jsonb [{q,a}]),
    disclaimer, stock(int, default 999), activo(bool default true),
    search_text(columna generada: unaccent(name||category||audience||short_desc||tagline)),
    created_at, updated_at (trigger updated_at).
    Índice GIN gin_trgm_ops sobre search_text (pg_trgm) para búsqueda fuzzy.
- customers (leads): id, uchat_sub_id(unique), nombre, telefono, ciudad, direccion,
    canal_origen('whatsapp'|'instagram'|'web'), estado('nuevo'|'interesado'|'cliente'),
    notas, ultimo_contacto, created_at
- orders (pedidos): id, ref(unique, ej "AD-7F3A"), customer_id(fk),
    estado('pendiente_confirmacion'|'confirmado'|'despachado'|'entregado'|'pagado'|'cancelado'),
    metodo_pago('contraentrega'|'anticipado'), subtotal_cop, descuento_cop, envio_cop,
    total_cop, ciudad, direccion, telefono, nombre, cupon_id(fk, nullable),
    asesor_id(fk advisors, nullable), notas, created_at, updated_at
- order_items: id, order_id(fk), product_id(fk), product_slug, product_name,
    presentacion_label, precio_cop, cantidad, subtotal_cop
- advisors (asesores de venta): id, nombre, whatsapp, activo, pedidos_asignados(int default 0),
    created_at  // para round-robin de asignación
- promotions: id, titulo, descripcion, product_id(fk nullable), category_id(fk nullable),
    precio_promo_cop, precio_antes_cop, imagen_url, activa(bool), desde, hasta, orden, created_at
- coupons: id, codigo(unique), tipo('porcentaje'|'fijo'), valor(int), activo(bool),
    usos_max(int nullable), usos(int default 0), vence(timestamp nullable), created_at
- store_config (1 fila, settings de la tienda): id, nombre('Animals Deluxe'), whatsapp,
    ciudad_base, envio_default_cop, ciudades_cobertura(jsonb [{ciudad, costo_envio, contraentrega:bool}]),
    mensaje_bienvenida, branding(jsonb {logoUrl,colorPrimario,colorAcento}), updated_at
- conversations: id, customer_id(fk), estado('activa'|'escalada'|'cerrada'),
    asignada_a(fk advisors nullable), ultimo_mensaje_at, created_at
- messages: id, conversation_id(fk), rol('cliente'|'bot'|'asesor'), texto, meta(jsonb), created_at
- integrations: id, proveedor('uchat'|'wompi'), config_enc(text, AES-256), activo, created_at
- audit_log: id, accion, entidad, antes(jsonb), despues(jsonb), created_at
- events: id, tipo, payload(jsonb), created_at

Genera la migración SQL en `supabase/migration.sql` (CREATE EXTENSION pg_trgm, unaccent;
todas las tablas; trigger updated_at; índice trigram; función + políticas RLS; bucket
`product-images` público con política de lectura pública). Single-tenant: RLS permite
lectura pública de products/categories activos; escrituras solo a usuarios autenticados
(panel) y al server (service role). Provee también seed idempotente.

═══════════════════════════════════════════════════════════════════════════
2) CAPA BRIDGE  (lib/ai/bridge.ts) — clónala de la dental, adaptada single-tenant
═══════════════════════════════════════════════════════════════════════════
`withBridge(schema, handler)` envuelve cada endpoint /api/ai/*:
  0. db disponible (si no → 503).
  1. Auth: `x-bridge-token` === process.env.BRIDGE_TOKEN (safeEqual tiempo constante). Si no → 401.
  2. Parse JSON → 400 si falla.
  3. Validación Zod (baseSchema { sub_id } + schema propio). Single-tenant: NO se exige uchat_ws.
  4. Rate limit por IP+sub_id (lib/ratelimit.ts, 60/min).
  5. Resolver/crear customer por sub_id (upsert en `customers`, actualiza ultimo_contacto).
  6. Ejecuta handler({customer, body, req}); respuesta pasa por `noNulls` y se envuelve en {ok:true,...}.
  7. `domainError(msg)` → 409 {ok:false, error:'domain_error', mensaje:msg}.
Todas las respuestas incluyen `mensaje` (texto corto es-CO listo para WhatsApp) y NUNCA null.

═══════════════════════════════════════════════════════════════════════════
3) ENDPOINTS /api/ai/*  (Route Handlers POST en app/api/ai/<nombre>/route.ts)
═══════════════════════════════════════════════════════════════════════════
Implementa EXACTAMENTE estos 15. Todos POST, JSON, auth x-bridge-token, validación Zod,
campo `mensaje`, sin null, <2s. Mutaciones → audit_log + events. crear-pedido y link-pago
idempotentes (por `ref`/idempotency key). El bot mapeará estos campos: si los renombras, NO conecta.

  1. POST /api/ai/buscar-producto        ⭐ el corazón
     recibe: {sub_id, q}                  // q = lo que pidió el cliente (texto libre)
     hace:   búsqueda fuzzy (RPC pg_trgm search_products + fallback por keywords; tolerante
             a errores de tipeo y stopwords; NO trates perro/caballo/pollo como stopword).
     devuelve: {ok, status:'found'|'ambiguous'|'not_found', match:slug,
                producto:{slug,name,priceCOP,presentations,shortDesc,benefits,usage,pitch,
                          imageUrl,url,disclaimer},
                sugerencias:[{name,slug,priceCOP}], mensaje}
             // si no hay match: producto vacío con "" y [] (nunca null) + sugerencias top.

  2. POST /api/ai/catalogo
     recibe: {sub_id, categoria?}
     devuelve: {ok, productos:[{slug,name,priceCOP,categoria}], mensaje}

  3. POST /api/ai/producto
     recibe: {sub_id, slug}
     devuelve: {ok, producto:{...todos los campos públicos...}, mensaje}

  4. POST /api/ai/categorias
     recibe: {sub_id}
     devuelve: {ok, categorias:[{id,slug,name,color}], mensaje}

  5. POST /api/ai/recomendar          // por necesidad/animal/problema (cross-sell)
     recibe: {sub_id, necesidad}      // ej "energía para la pelea", "mocos", "musculo perro"
     devuelve: {ok, productos:[{slug,name,priceCOP,pitch}], mensaje}

  6. POST /api/ai/promociones
     recibe: {sub_id, categoria?}
     devuelve: {ok, promos:[{id,titulo,descripcion,precio_promo,precio_antes,imagen_url,slug}],
                imagen_url, mensaje}   // imagen_url = la de la 1ª promo (el sub-flow la manda)

  7. POST /api/ai/cobertura            // envío/contraentrega por ciudad
     recibe: {sub_id, ciudad}
     devuelve: {ok, cobertura:true|false, contraentrega:true|false, costo_envio:int, mensaje}

  8. POST /api/ai/cupon
     recibe: {sub_id, codigo}
     devuelve: {ok, valido:true|false, tipo, valor, mensaje}

  9. POST /api/ai/registrar-cliente
     recibe: {sub_id, nombre, telefono, ciudad?, direccion?}
     devuelve: {ok, customer_id, mensaje}   // upsert en customers, estado='interesado'

 10. POST /api/ai/crear-pedido          ⭐ COD, idempotente
     recibe: {sub_id, items:[{slug, presentacion?, cantidad}], nombre, telefono, ciudad,
              direccion, cupon?}
     hace:   valida productos/stock, calcula subtotal + envío (por ciudad) − descuento(cupón),
             asigna asesor por round-robin (advisors.activo, menor pedidos_asignados),
             crea order (estado 'pendiente_confirmacion', metodo 'contraentrega') + order_items,
             genera ref único 'AD-XXXX'. Idempotente por (sub_id + hash de items) en ventana corta.
     devuelve: {ok, pedido_id, ref, total_cop, envio_cop, descuento_cop, estado, asesor:{nombre,whatsapp}, mensaje}

 11. POST /api/ai/estado-pedido
     recibe: {sub_id, ref}
     devuelve: {ok, estado, total_cop, items:[{name,cantidad}], mensaje}

 12. POST /api/ai/link-pago             // opcional (anticipo/prepago Wompi sandbox)
     recibe: {sub_id, ref, metodo?}
     devuelve: {ok, link, ref_pago, mensaje}   // si no hay pasarela activa → manual + mensaje COD

 13. POST /api/ai/asignar-asesor
     recibe: {sub_id, razon?}
     devuelve: {ok, asesor:{nombre,whatsapp}, mensaje}

 14. POST /api/ai/escalar
     recibe: {sub_id, motivo}
     devuelve: {ok, mensaje}            // conversations.estado='escalada' + event + (notifica asesor)

 15. POST /api/ai/resena
     recibe: {sub_id, sentimiento}      // positivo|neutro|negativo
     devuelve: {ok, link_resena, mensaje}   // si negativo → escala y link_resena=""

═══════════════════════════════════════════════════════════════════════════
4) ENDPOINTS PÚBLICOS DE LECTURA  (para la web; sin token, con CORS)
═══════════════════════════════════════════════════════════════════════════
  GET /api/products            (?category= &limit=)   → productos activos
  GET /api/products/[slug]                              → detalle
  GET /api/categories                                   → categorías
  GET /api/products/search?q=   (header x-api-key opc.) → misma búsqueda fuzzy, por si se usa fuera del bridge
Respuestas JSON con CORS habilitado. Estos son SOLO lectura de productos activos.

Endpoints privados de escritura (panel, requieren sesión admin Supabase):
  POST /api/products · PUT /api/products/[slug] · DELETE /api/products/[slug] · POST /api/upload (imagen)

═══════════════════════════════════════════════════════════════════════════
5) PANEL ADMIN  (app/(panel)/*, protegido con auth Supabase + middleware)
═══════════════════════════════════════════════════════════════════════════
Login/signup (app/(auth)/), middleware que protege (panel). Vistas:
  - Dashboard: KPIs (pedidos hoy/semana, ingresos COD, leads nuevos, top productos).
  - Productos: lista con buscador/filtro por categoría; crear/editar/eliminar/activar.
      Formulario con TODOS los campos del modelo: nombre, slug autogenerado (editable),
      categoría, origen (bandera), precio, presentaciones (lista dinámica label+precio),
      subir imagen (drag&drop → Storage → image_url), badges (multi-tag), tagline,
      descripción corta, beneficios (lista dinámica, mín 3), ingredientes, modo de uso,
      pitch de venta del bot, FAQ, disclaimer, activo. VISTA PREVIA EN VIVO de la ficha.
      Validaciones: slug único, precio>0, ≥1 presentación, ≥3 beneficios, usage no vacío.
  - Pedidos: lista de orders con estado, filtro, detalle (items, cliente, asesor, total),
      cambiar estado (confirmar/despachar/entregar/pagado/cancelar). Todo a audit_log.
  - Clientes (leads): lista de customers con estado, ciudad, último contacto, historial de pedidos.
  - Conversaciones: inbox de conversaciones escaladas (estado, asignación a asesor).
  - Promociones: CRUD con imagen, precio promo/antes, vínculo a producto/categoría, vigencia, orden.
  - Asesores: CRUD de advisors (nombre, whatsapp, activo) — alimentan el round-robin.
  - Configuración: store_config (whatsapp, ciudades de cobertura con costo de envío y bandera
      contraentrega, mensaje de bienvenida, branding/logo), integraciones (token UChat y llaves
      Wompi, guardadas ENCRIPTADAS con AES-256).
  Server actions tipadas; cada mutación escribe audit_log. Mantén el mismo set de componentes/clases.

═══════════════════════════════════════════════════════════════════════════
6) WEB PÚBLICA  (app/page.tsx + app/producto/[slug] o /producto?id=slug)
═══════════════════════════════════════════════════════════════════════════
Catálogo data-driven desde la API: home con chips de categoría + grid de tarjetas; ficha de
producto con galería, presentaciones seleccionables, beneficios, uso, FAQ, disclaimer y botón
"Pedir por WhatsApp" que arma el mensaje wa.me con producto + presentación + precio. Diseño
"gallero premium" coherente con el branding. Responsive.

═══════════════════════════════════════════════════════════════════════════
7) WEBHOOKS
═══════════════════════════════════════════════════════════════════════════
  POST /api/webhooks/uchat : eventos message.received / conversation.assigned /
      subscriber.tagged → guarda en messages/conversations. Verifica token. 200 < 200ms.
  POST /api/webhooks/wompi  : verifica firma; si pago APPROVED → marca order 'pagado'. Idempotente.

═══════════════════════════════════════════════════════════════════════════
8) SEGURIDAD (no negociable)
═══════════════════════════════════════════════════════════════════════════
  - Secretos solo en env (nunca en cliente ni en git). service_role solo server-side.
  - RLS activo; además filtra en código. Lectura pública solo de productos/categorías activos.
  - Token bridge en tiempo constante (safeEqual). Rate-limit en /api/ai/* (60/min IP+sub_id).
  - Búsqueda del bot con x-bridge-token; endpoints públicos de lectura con CORS restringido.
  - Validación/sanitización Zod en todo input. Límite y tipo de imagen en upload (5MB, jpg/png/webp).
  - Llaves de pasarela (Wompi) y token UChat encriptados AES-256 antes de guardar.
  - Verificación de firma en webhooks. Security headers.

═══════════════════════════════════════════════════════════════════════════
9) SEED  (scripts/seed.mjs, idempotente)
═══════════════════════════════════════════════════════════════════════════
Siembra desde `ANIMALS_DELUXE/data/catalogo-productos.json`:
  - 10 categorías (con color y orden).
  - 41 productos (todos los campos; resuelve image_url si <slug>.jpg ya está en el bucket, si no "").
  - store_config: nombre 'Animals Deluxe', whatsapp (placeholder 57XXXXXXXXXX), ciudad_base 'Bogotá',
    ciudades_cobertura ejemplo (Bogotá/Medellín/Cali contraentrega=true costo 0; resto envío
    anticipado), mensaje_bienvenida.
  - 2-3 advisors de ejemplo (activos) para el round-robin.
  - 1-2 promotions de ejemplo (activa, vinculada a un producto, con precio_antes/precio_promo).
  - 1 coupon de ejemplo (ej 'GALLO10' 10% activo).
NO inventes productos fuera del JSON. El JSON manda.

═══════════════════════════════════════════════════════════════════════════
10) TESTS  (node --test, como la dental)
═══════════════════════════════════════════════════════════════════════════
  - Búsqueda fuzzy: queries con typos y lenguaje natural devuelven el producto correcto
    ("enrgy kobra"→energy-cobra; "vitamina b12"→CyanoMax/Rooscer; "comida para caballo"→horse-deluxe).
  - crear-pedido: cálculo de total (subtotal+envío−cupón), idempotencia, asignación round-robin.
  - noNulls: ninguna respuesta de /api/ai/* contiene null.
  - Script check de seguridad: ninguna query de escritura sin auth.

═══════════════════════════════════════════════════════════════════════════
11) DEPLOY (Vercel producción) + ENV
═══════════════════════════════════════════════════════════════════════════
Configura TODAS las env vars en .env.local y en Vercel:
  DATABASE_URL, DIRECT_DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_STORAGE_BUCKET=product-images,
  BRIDGE_TOKEN (openssl rand -hex 32), ENCRYPTION_KEY (32 bytes),
  BOT_API_KEY (para /api/products/search público), NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_WHATSAPP,
  WOMPI_PUBLIC_KEY / WOMPI_PRIVATE_KEY (sandbox, opcional).
Corre migración en Supabase, siembra, verifica build y que /api/ai/buscar-producto responde en prod.

═══════════════════════════════════════════════════════════════════════════
12) APÉNDICE — Configuración del bot UChat (ya documentada, NO la construyas)
═══════════════════════════════════════════════════════════════════════════
La carpeta `ANIMALS_DELUXE/bot_uchat/` tiene el external request, el prompt StoryBrand y el
sub-flow. Cuando termines, deja en el README la tabla "AI Function → endpoint" para que se
conecte el bot:
  buscar_producto→/buscar-producto · recomendar→/recomendar · ver_catalogo→/catalogo ·
  ver_promociones→/promociones · verificar_cobertura→/cobertura · aplicar_cupon→/cupon ·
  registrar_cliente→/registrar-cliente · crear_pedido→/crear-pedido · estado_pedido→/estado-pedido ·
  link_pago→/link-pago · asignar_asesor→/asignar-asesor · escalar_humano→/escalar · pedir_resena→/resena
Cada AI Function → un sub-flow que hace el External Request (POST + x-bridge-token), mapea la
respuesta a bot fields, responde al cliente y termina con stop_ai_agent (patrón del KB).

═══════════════════════════════════════════════════════════════════════════
CRITERIOS DE ACEPTACIÓN ("listo" = todo esto pasa)
═══════════════════════════════════════════════════════════════════════════
[ ] Crear un producto en el panel lo hace visible en la web Y lo encuentra el bot, sin pasos extra.
[ ] /api/ai/buscar-producto encuentra productos con typos y lenguaje natural; nunca devuelve null.
[ ] /api/ai/crear-pedido crea un pedido COD real con total correcto, asesor asignado y ref único.
[ ] La web de producto se arma 100% desde la API. Botón "Pedir" arma el WhatsApp.
[ ] Panel completo: productos (con preview en vivo + upload), pedidos, leads, promos, asesores, config.
[ ] Auth en el panel; endpoints de escritura protegidos; RLS activo; token en tiempo constante.
[ ] Los 41 productos semilla cargados. Migración corrida. Tests en verde. Build de prod OK.
[ ] Subida de imagen funciona y devuelve URL pública.

═══════════════════════════════════════════════════════════════════════════
QUÉ DEBES DEVOLVERME AL TERMINAR (pégalo tal cual)
═══════════════════════════════════════════════════════════════════════════
A) URL pública de producción (https://xxxx.vercel.app)
B) El BRIDGE_TOKEN que configuraste y el BOT_API_KEY
C) Resultado de esta prueba (debe dar 200 con JSON que incluya "mensaje"):
     curl -s -X POST https://<TU_URL>/api/ai/buscar-producto \
       -H "Content-Type: application/json" \
       -H "x-bridge-token: <BRIDGE_TOKEN>" \
       -d '{"sub_id":"test123","q":"energia para la pelea"}'
D) URL del panel admin y credenciales de prueba.
E) Confirmación de migración corrida + 41 productos sembrados.
F) Lista de qué quedó 100% funcional vs. qué está en sandbox (ej. "Wompi sandbox", "COD full").

REGLAS: producción, no demo. No stubs ni funciones a medias. No renombres los campos del
contrato /api/ai/*. Sigue el patrón de ECOSISTEMA_CLINICA_DENTAL/plataforma. Trabaja seguro.
```

(fin del prompt — copia hasta aquí ⬆️)

---

## PARTE 4 · Qué haces TÚ cuando Claude Code te devuelva la URL + token

1. **Barrido** de las External Requests del bot en UChat → apunta a `https://<TU_URL>/api/ai/*`
   y pon el `BRIDGE_TOKEN` en el header `x-bridge-token` de cada una.
2. Crea las **AI Functions** (tabla del apéndice 12) y vincula cada una a su sub-flow
   (external request → mapeo de bot fields → respuesta → `stop_ai_agent`).
3. Pega el **system prompt** de `bot_uchat/02_PROMPT_SISTEMA_AGENTE.md` en el AI Agent.
4. **Prueba E2E** por WhatsApp: "algo para que mi gallo tenga más energía" → el bot busca,
   vende con pitch+beneficios+precio, toma ciudad y crea el pedido COD → aparece en el panel.

Con eso queda el ciclo completo: cliente escribe por WhatsApp → bot vende y toma el pedido
contraentrega → todo cae en la plataforma de Animals Deluxe.
