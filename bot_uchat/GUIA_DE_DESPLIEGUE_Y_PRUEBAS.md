# GUÍA DE DESPLIEGUE Y PRUEBAS — Bot Animals Deluxe (`f280503`)

> Paso 5 de la skill UChat Bot Architect. Qué quedó construido, cómo dejarlo respondiendo, el guion
> de prueba E2E por WhatsApp y qué falta de cada lado.

## 1. Estado: qué quedó construido (lado bot, ya publicado)
- **50 bot fields `ad_*`** + `ad_prod_contexto` (la ficha completa del producto activo).
- **15 sub-flows `SF_AD_*`**, cada uno con su external request a `https://animals-deluxe.vercel.app/api/ai/*`
  + `x-bridge-token` real (barrido a producción) + mapeos a bot fields.
- `buscar_producto`, `recomendar` y `ver_producto` mapean `producto.producto_contexto` → `ad_prod_contexto`.
- **15 AI Functions** (con `function_params`).
- **AI Agent `Vendedor_AnimalsDeluxe`** (Victor, gpt-4o-mini, temp 0.2): alma paisa + reglas de venta +
  regla "asesora con `ad_prod_contexto`" (beneficios, uso, FAQs, objeciones del producto).

## 2. Lado plataforma (en curso por Claude Code, con `PROMPT_CURSOR_MASTER_PLATAFORMA.md`)
- Enriquecer los 41 productos (keywords, benefits, usage, faq, objeciones) en voz de Victor.
- Devolver `producto.producto_contexto` en buscar/recomendar/producto + `mensaje` rico.
- Endpoint `POST /api/ai/producto-por-anuncio` (ad_id) + campo `ad_ids` por producto.

## 3. Para que el bot RESPONDA (acción del dueño — 2 clics)
En UChat → **Main Flow** → después del nodo **Start**, agrega una acción **AI Agent →
Vendedor_AnimalsDeluxe** → **Publicar**. (En modo "live" la API no permite cablear el Main de forma
fiable; por eso va manual.) Sin esto el bot no contesta los mensajes entrantes.

## 4. Guion de prueba E2E por WhatsApp (haz estos mensajes y verifica)
Escríbele al WhatsApp del bot, uno por uno:

| # | Tú escribes | Qué debe hacer Victor (esperado) |
|---|---|---|
| 1 | `hola` | Saluda paisa, NO repite, pregunta qué busca. Sin inventar producto. |
| 2 | `algo pa la energía de mi gallo en la pelea` | Invoca `recomendar`/`buscar_producto` → envía **imagen + presentación** (Energy Cobra u opción) y se calla (silencio post-presentación). |
| 3 | `¿cómo se usa?` | Responde con el **modo de uso** del producto (desde `ad_prod_contexto`), no genérico. |
| 4 | `está caro` | Maneja la objeción "muy_caro" con argumento (rinde X dosis / contraentrega), NO escala. |
| 5 | `¿es original?` | Responde desde FAQs/objeciones (original, fórmula americana). |
| 6 | `lo quiero, estoy en Medellín` | Invoca `verificar_cobertura` → confirma contraentrega ("pagás al recibir") + envío. |
| 7 | `Juan Pérez, calle 10 #5-20 barrio Centro, 3001234567` | Extrae los 4 datos, hace **ECO** ("te leo pa confirmar…") y pide confirmación. |
| 8 | `sí, correcto` | Invoca `crear_pedido` → confirma con `ref`, "te lo despacho contraentrega". (En prod: crea la orden en Shopify.) |
| 9 | `¿quiero pagar adelantado?` | Llama `asignar_asesor (pago anticipado)` → manda cuentas + "un asesor confirma". |
| 10 | `tengo un reclamo con mi pedido` | `escalar_humano` SILENCIOSO ("ya lo reviso y te confirmo"), sin nombrar a nadie. |

**Criterios de aprobado:** (a) trae el producto con foto, (b) responde dudas con datos reales del
producto (no en el aire), (c) maneja objeciones, (d) toma ciudad+datos y cierra contraentrega con
`ref`, (e) escala bien. Si el paso 3/4/5 sale genérico → es que la plataforma aún no manda
`producto_contexto` (revisar con un `curl` a `/api/ai/buscar-producto`).

## 5. Verificación técnica (curl)
```bash
curl -s -X POST https://animals-deluxe.vercel.app/api/ai/buscar-producto \
  -H "Content-Type: application/json" -H "x-bridge-token: <BRIDGE_TOKEN>" \
  -d '{"sub_id":"test","q":"energia para la pelea"}' | jq '.producto.producto_contexto, .mensaje'
```
Debe traer `producto_contexto` lleno y un `mensaje` rico. Si `producto_contexto` viene vacío,
Claude Code aún no terminó la TAREA 3 del master.

## 6. Fase 2 (cuando quieras subir a "vende como pro" — patrón Chatea Pro)
Lo monto yo en UChat cuando la plataforma tenga `producto_contexto` + `ad_id`:
- **Recolección de datos por `ai_task`** (JSON: nombre/ciudad/dirección/teléfono/cantidad, mapa
  ciudad→departamento, "nunca inventar").
- **Tableros como máquina de estados** (`move_to_board`): nuevo → en conversación → datos completos →
  pedido confirmado → seguimiento → novedad → asesor; cada estado dispara su acción.
- **Captura de `ad_id`** del referral de WhatsApp Ads → `producto-por-anuncio` (un anuncio → un producto).
- **Recordatorios/remarketing** (`smart_delay` + `wa_template`) para el que no respondió.

## 7. Pendientes de seguridad
- Rotar el token de Supabase expuesto (`sbp_75a2…`).
- (Higiene) regenerar `BRIDGE_TOKEN` tras conectar y re-barrer.
