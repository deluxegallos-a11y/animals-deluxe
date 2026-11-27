# Bot Rooster Deluxe (pago anticipado) — cómo está armado y cómo se mantiene

Cuenta UChat **f287229** (team 316315) · agente `Vendedor_Anticipado_Victor` (id 152993, gpt-4.1-mini).
Plataforma: tenant `rooster-deluxe` en animalsdeluxe.com (mismo backend que Animals, token `ROOSTER_BRIDGE_TOKEN`).
Pago anticipado: el cliente transfiere los productos ANTES del despacho; el envío se paga al recibir. Eso no cambia.

## 1. Piezas
| Pieza | Dónde | Qué hace |
|---|---|---|
| Catálogo oficial | bot field `catalogo_cod` (f287229v19419481) | Lo genera `scripts/gen-botfields-rooster.ts` desde la base. Única fuente de precios/presentaciones/dosis. |
| Reglas duras | bot field `reglas_cod` (f287229v19419483) | `bot_uchat/08_REGLAS_DURAS_ANTICIPADO.md` (cada regla = error real de un chat). |
| Prompt | `bot_uchat/rooster/{roles,skills,information,limitations}.txt` | Lo que está en el agente. Original en `respaldo_2026-11-26/`. Information lleva los dos chips. |
| Verdad del dueño | `data/verdad-dueno-rooster.json` | Lo confirmado por el dueño + `pendientes` (preguntas abiertas). |
| Cerebro de productos | `lib/ai/brain.ts`, `lib/ai/aliases.ts` (bloque Rooster) | Alias, necesidades, B12≠B15, charla que no elige producto, varios productos. |
| Tests | `tests/brain-rooster-chats.test.ts` | Casos reales 15–26 nov. `npm test` en verde antes de desplegar. |
| Reporte diario | `lib/reporte/diario.ts` + cron `30 5 * * *` (`?tenant=rooster-deluxe`) | Lee los chats por la API de UChat (Rooster no tiene Live Chat) y los juzga con reglas de anticipado. |

## 2. Funciones de UChat que tocan la plataforma
- `buscar_producto` → `SF_buscar_producto`: POST `/api/ai/buscar-producto` con `q` = parámetro `producto`
  (campo `q_producto`, f287229v19419485) y `q_raw` = `{{last_text_input}}` de respaldo.
  Antes mandaba solo el mensaje crudo ("si", "este", "precio") → 80% de búsquedas fallidas.
- `crear_pedido` → `SF_crear_pedido_v5`: PRIMERA acción POST `/api/ai/crear-pedido`
  `{items: pedido_items (f287229v19419487), ciudad, metodo:"anticipado"}` → el pedido nace en
  `por_verificar_pago` SIN datos personales; después el mensaje de cuentas del dueño (igual que antes).
  Antes no registraba nada: 0 pedidos en la plataforma.
- `registrar_cliente` → completa nombre/cédula/teléfono/ciudad/dirección en ese mismo pedido
  (el más reciente por verificar pago, 7 días) cuando el cliente los manda con el comprobante.

## 3. Ajustes del agente (herramientas de calidad UChat)
- Historial `max_rounds` **40** (estaba en 10 → perdía el hilo). `max_tokens` 600. Temperatura 0.2.
- Espera antes de responder (Smart Delay del Main Flow) **7 s** (estaba en 3 → respuestas dobles a mensajes partidos).

## 4. Cambiar precios / productos / dosis
1. Corregir en la plataforma (panel) o en `data/verdad-dueno-rooster.json` (lo del dueño).
2. `node scripts/dump-rooster-catalog.mjs`
3. `npx tsx scripts/gen-botfields-rooster.ts /tmp/rd_bf.json` (falla si pasa 19.500 caracteres)
4. Subir: `PUT https://www.uchat.com.au/api/flow/set-bot-field {var_ns, value}` con `ROOSTER_UCHAT_API_TOKEN`
   (header `User-Agent` obligatorio) y verificar con `GET /api/flow/bot-fields`.
5. `npm test`.

## 5. Editar el prompt o los subflujos (API interna del editor, logueado en Chrome)
- Headers: `x-csrf-token` (meta), `x-xsrf-token` (cookie), `x-flow-ns: f287229`, `x-team-id: 316315`,
  `x-sub-flow-ns`, `x-requested-with: XMLHttpRequest`, credentials include.
- Agente: `POST flowbuilder/bot-ai-agents/update {id}` = leer; con el objeto completo modificado = guardar.
  Medir antes: cada sección < 20.000 (UChat corta en silencio; Limitations < 2.000).
- Funciones: `GET flowbuilder/bot-ai-functions/view/{id}` + `POST …/update` con el objeto completo y `function_params`.
- Nodos: leer con `GET flowbuilder/get-nodes?mode=draft` (¡`mode=draft`!; sin eso devuelve la versión en vivo).
  `POST flowbuilder/update-node` modifica lo que YA existe; una acción nueva se crea con
  `add-new-item {type:"action", obj}` y sus headers con `add-new-item {type:"api_param", obj:{action_ns, type:"header", field, value}}`.
- Antes de editar: botón **Edit Flow** (pasa a borrador). Publicar: `publish-flow` por API NO publica;
  hay que abrir CADA subflujo cambiado en el editor y darle **Publish**, y verificar con `get-nodes?mode=live`.
- Respaldo antes de tocar: `bot_uchat/rooster/respaldo_2026-11-26/` (prompt) y el objeto del agente.

## 6. Pendientes con el dueño (no se inventan)
Ver `pendientes` en `data/verdad-dueno-rooster.json`: domicilio/contra entrega en Medellín, venta por mayor,
espuelas, Tijera Roja, Trueno Oro 100 ml, dosis, "Doppy B12", combos de anuncio como productos, productos repetidos.
Mientras tanto el bot responde "eso te lo confirma el asesor" y escala.
