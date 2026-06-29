# AUDITORÍA — Bot de gallos `f280503` ("animals deluxe")

> PASO 1. Estado real extraído en vivo por la API (`flow-detail`) el 2026-06-18, contrastado con
> el patrón Chatea Pro. Workspace/team `308915`, flow `f280503`, agente `f280503ag119367`.

## 1. Estado actual (lo que HAY)

| Elemento | Cantidad | Detalle |
|---|---|---|
| Bot fields propios | 51 (`ad_*`) | producto activo, pedido, cliente, cobertura, cupón, asesor, params `ad_q_*` |
| Sub-flows | 16 | 15 `SF_AD_*` (uno por función) + `dce` (prueba, borrar) |
| AI Functions | 15 | buscar_producto, recomendar, ver_catalogo/producto/categorias, ver_promociones, verificar_cobertura, aplicar_cupon, registrar_cliente, crear_pedido, estado_pedido, link_pago, asignar_asesor, escalar_humano, pedir_resena |
| AI Agent | 1 | `Vendedor_AnimalsDeluxe` (Victor), gpt-4o-mini, temp 0.2, 15 funciones vinculadas |
| ai_tasks | 0 | — |
| ai_intent_recognition | 0 | — |
| Triggers | 0 | el cliente no entra por ningún disparador configurado |
| Tableros (boards) | 0 | no hay máquina de estados |
| Sequences | 0 | — |
| Main Flow | vacío | solo el nodo Start; el agente aún NO está conectado al Main |

**Cada `SF_AD_*`** hace: external request → `https://animals-deluxe.vercel.app/api/ai/<endpoint>`
con header `x-bridge-token` (ya barrido a producción) → mapea respuesta a bot fields →
envía imagen + `ad_api_mensaje` → `stop_ai_agent`.

## 2. Arquitectura actual vs. Chatea Pro

| Capa Chatea Pro | ¿Lo tenemos? | Nota |
|---|---|---|
| Productos como datos externos (API + token) | ✅ Sí | Pero por **búsqueda fuzzy de texto**, no por `ad_id` de anuncio |
| Prompt de venta POR producto | ❌ No | Hoy hay UN prompt global (Victor); el producto solo aporta `mensaje`/campos |
| `ai_intent_recognition` (enrutar por intención) | ❌ No | Enruta el AI Agent por function-calling (más simple, menos determinístico) |
| `ai_task` recolección de datos (JSON, no inventar) | ❌ No | Hoy el agente extrae los datos "a ojo" en el prompt |
| `ai_task` extractor final (ciudad→departamento) | ❌ No | — |
| Tableros como máquina de estados (`move_to_board`) | ❌ No | No hay estados nuevo/conversación/datos/confirmado/seguimiento/novedad |
| Trigger por anuncio (ad_referral) | ❌ No | No se captura el `ad_id` de WhatsApp Ads |
| Subida de pedido al backend | ✅ Sí (parcial) | La plataforma crea la orden (y Shopify) en `crear-pedido`; el bot solo manda datos |
| Recordatorios / remarketing / `wa_template` | ❌ No | No hay re-enganche fuera de la ventana de 24h |

## 3. Diagnóstico

**Qué está BIEN (no rehacer):**
- El patrón "producto como dato externo vía API con token" ya está y barrido a producción. ✅
- 15 funciones cubren el ciclo (descubrir, recomendar, cobertura, cupón, pedido COD, postventa).
- El agente Victor tiene voz paisa fuerte (alma de Victor) y reglas duras de venta.
- La plataforma ya crea el pedido (y lo espeja a Shopify), así que el bot NO sube pedidos: bien.

**Qué FALTA (lo que lo hace sentir básico / no cierra como pro):**
1. **Datos del producto pobres** → el bot asesora suave (ver `06_ESTUDIO...` y `PROMPT_CURSOR_CONTENIDO_PRODUCTOS.md`). Falta `producto_contexto` rico por producto.
2. **No hay recolección de datos estructurada** (`ai_task` JSON con nombre/ciudad/dirección/teléfono/cantidad, mapa ciudad→departamento, "nunca inventar"). Hoy depende del prompt.
3. **No hay máquina de estados por tableros** → no se sabe en qué punto va cada cliente (nuevo, en conversación, datos completos, pedido confirmado, seguimiento, novedad, asesor) ni se disparan acciones por estado.
4. **No hay identificación por `ad_id`** (anuncio → producto). Solo por keyword/fuzzy.
5. **El Main Flow no tiene al agente conectado** → el bot aún no responde a mensajes entrantes (paso manual pendiente del dueño).
6. **No hay recordatorios / remarketing** (re-enganche del que no respondió) ni `wa_template`.
7. Queda el sub-flow `dce` de prueba (borrar).

**Qué se puede POTENCIAR con patrones Chatea Pro (prioridad):**
- **P1 · Recolección de datos por `ai_task`** (Task 5 + Task 6) → cierre confiable del pedido COD.
- **P1 · `producto_contexto` rico** + (opcional) `ai_task` de asesoría in-flow → asesora a fondo.
- **P2 · Tableros como máquina de estados** + etiquetas → tracking y disparos por estado.
- **P2 · Identificación por `ad_id`** (si corren anuncios click-to-WhatsApp por producto).
- **P3 · Recordatorios/remarketing** con `smart_delay` + `wa_template`.

## 4. Conclusión
El bot actual es un **buen MVP function-based** y ya está conectado a producción. Para llevarlo a
"producto final que vende de verdad" hay que sumarle, en este orden: (1) data de producto rica +
asesoría a fondo, (2) recolección de datos por `ai_task` y cierre, (3) máquina de estados por
tableros, (4) ad_id + recordatorios. No hay que tirar nada: se construye encima.
