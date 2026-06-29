# 🛠️ MASTER · Prompt para Claude Code — Plataforma Animals Deluxe (datos ricos + producto_contexto + ad_id)

> Pégalo en Claude Code dentro de `ANIMALS_DELUXE/`. **Este documento consolida y REEMPLAZA** a
> `PROMPT_CURSOR_CONTENIDO_PRODUCTOS.md`, `PROMPT_CURSOR_SHOPIFY_SYNC.md` y la sección de keywords de
> `bot_uchat/05_*`. Es una **adición** a la plataforma ya desplegada (`animals-deluxe.vercel.app`):
> NO rehagas lo que existe; agrega lo que falta para que el bot venda a fondo y escale a muchos productos.

## CONTEXTO
La plataforma (Next 15 + Supabase + Drizzle) ya tiene panel, 41 productos, web, espejo Shopify y los
15 endpoints `/api/ai/*` que consume el bot de WhatsApp (UChat `f280503`, ya conectado a producción).
**El problema:** la data de cada producto está pobre (`keywords=[]`, `faq=[]`, sin objeciones, benefits
de una línea) y el endpoint no entrega un contexto rico → el bot asesora "suave". Hay que arreglar la
DATA y entregar un `producto_contexto`. El bot ya está preparado: mapea `producto.producto_contexto`
→ bot field `ad_prod_contexto` y el agente Victor asesora desde ahí.

═══════════════════════════════════════════════════════════════════
TAREA 1 · Schema (Drizzle + migración)
═══════════════════════════════════════════════════════════════════
Agrega a `products`:
- `objeciones` jsonb default `{}` — claves: `muy_caro`, `lo_pienso`, `no_confio`, `no_tengo_plata`, `ya_lo_uso`.
- `ad_ids` jsonb (text[]) default `[]` — IDs de anuncios de WhatsApp Ads que apuntan a este producto.
- `sales_prompt` text default `''` — (opcional, fase 2) prompt de venta por producto.
Usa `keywords`, `faq`, `ingredients` que ya existen.

═══════════════════════════════════════════════════════════════════
TAREA 2 · Enriquecer los 41 productos (script `scripts/enrich-products.mjs`, idempotente)
═══════════════════════════════════════════════════════════════════
Para CADA producto, genera con un LLM (OPENAI_API_KEY / Claude) y guarda en Supabase, contenido
COMPLETO en la **voz de Victor** (ver TAREA 5):
- `keywords` (8–15): nombre, plural, **errores de tipeo**, sinónimos, marca, el animal, y **la necesidad**
  ("pa la pelea", "mocos", "lombrices", "musculo perro").
- `benefits` (4–6): beneficios de RESULTADO en el animal (no fichas técnicas).
- `usage`: dosis a detalle, primera vez, advertencias.
- `faq` (≥5): Q&A reales del gallero, respuesta corta en voz Victor.
- `objeciones` (las 5 claves): respuesta de Victor a cada una (ROI / contraentrega / originalidad).
- `pitch`: 1–2 frases gancho.
Reglas: NUNCA decir que cura enfermedades (bienestar/rendimiento). Respeta animal/categoría. Paisa.
Botón "🤖 Autogenerar con IA" por producto en el panel (reusa el generador).

═══════════════════════════════════════════════════════════════════
TAREA 3 · `producto_contexto` + `mensaje` rico (lib/ai/present.ts)
═══════════════════════════════════════════════════════════════════
Agrega `buildContexto(p)` (≤1500 chars) y exponlo en `producto.producto_contexto` en
`buscar-producto`, `recomendar` y `producto`. Formato EXACTO:
```
PRODUCTO: {name} — {priceCOP} COP
PRESENTACIONES: {label: precio | ...}
PARA: {audience} · CATEGORÍA: {categoria} · ORIGEN: {origin}
GANCHO: {pitch}
BENEFICIOS: {benefits join ' · '}
MODO DE USO: {usage}
FAQS: {q? a | q? a | ...}
OBJECIONES: muy_caro: ... | lo_pienso: ... | no_confio: ... | no_tengo_plata: ...
NOTA: {disclaimer}
```
Y el `mensaje` de `buscar-producto` (presentación WhatsApp-ready, voz Victor):
```
{name} 🔥 {pitch}
✅ {benefit1}
✅ {benefit2}
✅ {benefit3}
💵 {precio} · {presentación} · contraentrega (pagás al recibir)
¿Te lo aparto, mi rey? 🐓
```
NUNCA `mensaje`/`producto_contexto` vacío ni null (regla de oro UChat).

═══════════════════════════════════════════════════════════════════
TAREA 4 · Identificación por anuncio (ad_id) — patrón Chatea Pro
═══════════════════════════════════════════════════════════════════
- Endpoint `POST /api/ai/producto-por-anuncio` body `{ sub_id, ad_id }` → busca el producto cuyo
  `ad_ids` contiene `ad_id`; devuelve el MISMO shape de `buscar-producto` (producto + producto_contexto +
  mensaje + status). Si no hay match → status `not_found` + sugerencias (nunca null).
- En el panel `/productos`: campo para pegar los `ad_ids` de cada producto.
(El bot capturará el `ad_id` del referral de WhatsApp Ads y llamará este endpoint; si no hay ad_id,
usa `buscar-producto` por keyword. Esa parte la cableo yo en UChat.)

═══════════════════════════════════════════════════════════════════
TAREA 5 · LA VOZ (estilo de TODO el contenido generado) — Victor
═══════════════════════════════════════════════════════════════════
- Paisa colombiano, voseo ("vos, decime, mirá, pagás"). Apelativos ("mi rey, parcero, hermano, mi león").
- Beneficios de resultado en el gallo/animal (más fondo, más reflejos, llega encendido al careo).
- Frases marca para objeciones: "es contraentrega, pagás cuando lo tenés en la mano", "original, fórmula
  americana, acá no manejamos copias", "te rinde X dosis, sale baratico por uso".
- Cumplimiento: bienestar y rendimiento. PROHIBIDO prometer cura de enfermedades; si es salud, apoyo +
  sugerir veterinario.
- Nada de mexicanismos/inglés/frases de bot. Frases cortas, 1–2 emojis (🐓🔥💪✅📦).

═══════════════════════════════════════════════════════════════════
TAREA 6 · EJEMPLO DE ORO (Energy Cobra) — replica ESTE nivel en los 41
═══════════════════════════════════════════════════════════════════
(Ver el JSON completo en `PROMPT_CURSOR_CONTENIDO_PRODUCTOS.md` §Parte 4: keywords, benefits, usage,
5 faqs, 5 objeciones y `producto_contexto` de Energy Cobra. Úsalo como plantilla de calidad mínima.)

═══════════════════════════════════════════════════════════════════
NO CAMBIA / QUÉ DEVOLVER
═══════════════════════════════════════════════════════════════════
- NO renombres los campos del contrato `/api/ai/*` (el bot ya mapea esos paths). Solo AGREGAS
  `producto.producto_contexto` y el endpoint de ad_id.
- Venta sigue 100% contraentrega por WhatsApp (sin carrito al cliente); la orden se crea en Shopify
  desde `crear-pedido` (ya implementado).
- Al terminar devuélveme: confirmación de los 41 enriquecidos (keywords≥8, benefits≥4, faq≥5, objeciones 5),
  un `curl` de `/api/ai/buscar-producto` mostrando `producto.producto_contexto` y el `mensaje` nuevo, y
  un `curl` de `/api/ai/producto-por-anuncio` con un ad_id de prueba.
