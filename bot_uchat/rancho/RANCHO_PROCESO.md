# Bot Rancho de las Estrellas (venta de gallos, voz de Victor)

Cuenta UChat "Compralo con pipe" (team 279231) · flujo **f276483** · agente `Victor` (id 136937, gpt-4.1).
Respuestas en audio (ElevenLabs). Venta: abono desde $200.000 → galería → saldo → envío en bus.
Respaldo del prompt original: `respaldo_2026-11-26/prompt_completo.txt` (y en localStorage del navegador:
`respaldo_rancho_agente_2026-11-26`, `respaldo_rancho_main_2026-11-26`, `respaldo_rancho_fn_*`).

## Revisión 26-nov-2026 (111 chats / 48 h)
| Error | Causa | Arreglo |
|---|---|---|
| Mensajes repetidos (saludo ×3, imagen ×2, cuentas ×2) | Nodo AI Agent: Input complete timeout vacío, Smart Delay 3 s | 7 s y 7 s (Main Flow, publicado) |
| Pierde el hilo, se enreda | `max_rounds` 10 | 40 · max_tokens 600 |
| No ve fotos ni comprobantes del cliente | Image handling `text_only` | Process immediately |
| Mudo después de mandar cuentas (Zelle, fotos, "estoy en Tarazá", audios) | `enviar_cuentas` pone la etiqueta `esperando_pantallazo` y el filtro del Main Flow la bloqueaba | Filtro solo con `ya_escalado` |
| Cuentas antes de tiempo ("quiero un creston negro" → cuentas) | Descripción de `enviar_cuentas` (casos D/E) y árbol de decisión punto 4 | Solo con precio + proceso dados y "sí" claro; combos agotados no llevan cuentas |
| Fotos: Telegram repetido, cliente sin ver nada | Regla de fotos | 1º imagen de exhibición, 2º Telegram una vez, 3º recordar |
| Inventó envío a Perú "500-700 dólares" | Sin regla de costo internacional | Nunca cifra: escalar |

Se agregó en Information el bloque **CONCIENCIA DE VICTOR** (qué ya mandé, varios mensajes = uno, responder primero
lo que preguntó, seguir el hilo, seguir atendiendo tras cuentas, no inventar líneas ni envío internacional).
Tono y forma de vender: SIN cambios.

## Pendiente del negocio
- Chats con `ya_escalado` quedan mudos hasta que el asesor conteste (hubo clientes con comprobante esperando).
- Rotar el token API de UChat de esta cuenta (se pegó en el chat).

## Bots Venta 2.0 aplicado (26-nov, noche)
| Pieza | Dónde |
|---|---|
| Verdad del dueño | `data/verdad-dueno-rancho.json` (precios, promo, combos agotados, proceso, envíos, pagos, 37 líneas, **pendientes**) |
| Reglas duras (cada una = error real) | `bot_uchat/09_REGLAS_DURAS_RANCHO.md` |
| Bot fields (chips al inicio de Information) | `catalogo_cod` f276483v19424311 · `reglas_cod` f276483v19424313 — `npx tsx scripts/gen-botfields-rancho.ts --subir` |
| Tests | `tests/rancho.test.ts` (precios, combos sin precio, sin envío internacional inventado, reglas, reporte) |
| Function Prompt con CUÁNDO | presentar_general, enviar_exhibicion, enviar_telegram, enviar_lineas, responder, escalar_humano, enviar_cuentas |
| Avisos a la encargada | Plantillas notif_lead_pago / notif_escalamiento / notif_lead_otro_canal fallaban (#131008 parámetro vacío): cada variable lleva texto fijo delante ("Interés:", "Resumen:", "Razón:") |
| Reporte diario | `lib/reporte/diario.ts` marca `rancho-estrellas` (lee chats por API con `RANCHO_UCHAT_API_TOKEN`, juez propio, pedidos = cuentas enviadas) · cron `45 5 * * *` (00:45 Colombia) |

## Lista obligatoria (sección 9 de la skill)
- [x] Verdad del dueño en JSON, sin inventar; pendientes listados para preguntarle.
- [x] Una sola fuente de precios: catálogo en bot field que manda sobre el prompt.
- [ ] Cerebro de productos — NO APLICA: 4 ejemplares fijos, sin búsqueda en catálogo.
- [ ] Marcas separadas — NO APLICA dentro del bot; productos/droga van al número de Rooster y rifas a su número.
- [x] Prompt con tono original + blindaje; Skills 19.860/20.000; catálogo y reglas en bot fields; verificado tras guardar.
- [ ] crear_pedido con candados — NO APLICA: el negocio no registra pedidos en la plataforma; el abono lo confirma la encargada.
- [x] Herramientas UChat: Input complete 7 s, Smart Delay 7 s, Idle 10, imágenes Process, max_rounds 40, max_tokens 600, Function Prompts, Error Logs revisados y corregidos.
- [~] `npm test` verde (217) · validador OpenAI y revisión del reporte PENDIENTES: la clave de OpenAI en Vercel/local responde 401.
- [~] Reporte diario: código y cron listos; falta `RANCHO_UCHAT_API_TOKEN` en Vercel (lo pone fily) y clave OpenAI válida.
- [ ] Live Chat — NO APLICA (el Rancho atiende en UChat).
