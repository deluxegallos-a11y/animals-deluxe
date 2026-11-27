# Bot Rancho de las Estrellas (venta de gallos, voz de Victor)

Cuenta UChat "Compralo con pipe" (team 279231) · flujo **f276483** · agente `Victor` (id 136937, gpt-4.1).
Respuestas en audio (ElevenLabs). Venta: abono desde $200.000 → galería → saldo → envío en bus.
Respaldo del prompt original: `respaldo_2026-11-26/prompt_completo.txt` (y en localStorage del navegador:
`respaldo_rancho_agente_2026-11-26`, `respaldo_rancho_main_2026-11-26`, `respaldo_rancho_fn_*`).

## Dónde está cada cosa (organizado 27-nov-2026)

| Qué | Archivo (fuente) | Dónde vive en UChat |
|---|---|---|
| Precios, promo, combos, envíos, pagos, líneas, Telegram, Facebook | `data/verdad-dueno-rancho.json` → `lib/rancho/botfields.ts` | bot field `catalogo_cod` (chip arriba de Information) |
| Reglas duras (cada una = error real) | `bot_uchat/09_REGLAS_DURAS_RANCHO.md` | bot field `reglas_cod` |
| Quién es Victor y cómo habla | `prompt/1_persona.txt` | Agente Victor → Persona & Role |
| Qué hace en cada caso (function a usar, guiones, promo, combos, galería, envíos, pagos, escalar) | `prompt/2_skills.txt` | Agente → Skills |
| Conciencia, casos especiales, clientes en espera | `prompt/3_information.txt` | Agente → Product & Service Information (debajo de los 2 chips) |
| Lo que nunca hace | `prompt/4_constraints.txt` | Agente → Constraints |
| Function prompts corregidos | `prompt/5_fn_enviar_cuentas.txt`, `prompt/5_fn_responder.txt` | AI Functions → enviar_cuentas / responder |
| Respaldo del agente antes de reorganizar | `respaldo_2026-11-27/` (fuera de git) | — |

Reglas de la organización: **los precios viven solo en `catalogo_cod`** (el prompt no repite tablas);
el prompt nunca dice números de cuenta ni titular (los manda el subflujo C); teléfonos siempre en dígitos.
Subir catálogo/reglas: `npx tsx scripts/gen-botfields-rancho.ts --subir`. El prompt se pega en UChat y se
verifica **recargando la página** (un guardado sin recargar puede mostrar cambios que no quedaron).

### Pruebas sin avisar a la encargada
Los subflujos **B - Enviar Telegram**, **C - Enviar Cuentas** y **D - Escalar Humano** tienen una condición antes
del aviso de WhatsApp: si el contacto tiene la etiqueta `prueba_bot`, salta al STOP sin avisar.
Chat de prueba: UChat → WebChat Widget → burbuja verde (contacto `f276483u1078026747`, ya con `prueba_bot` y
excluido del reporte diario). Antes de repetir pruebas, quitarle `ya_escalado`, `esperando_pantallazo`, `en_telegram`.

### Pruebas del 27-nov (chat web, mismo flujo que WhatsApp)
Saludo una vez · ráfaga de 2 mensajes = 1 respuesta + imagen de precios una vez · líneas con imagen una vez ·
promo completa · combos agotados sin precios · pedir otra vez la foto = no la repite · padrón = precio + abono +
"¿te paso las cuentas?" · envío Perú 150 USD · vitaminas 315 765 2850 · "muy caro" = promo sin bajar precio ·
cuentas OK · Telegram OK · comprobante = escala y se calla. Ningún aviso a la encargada.
Corregido tras pruebas: a cliente de afuera no se le ofrecen cuentas (Western Union vía encargada); fuera
"¿Te ayudo con algo más?".

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

## Revisión 27-nov-2026 (67 chats / 36 h)
| Error / dato | Causa | Arreglo |
|---|---|---|
| Respuestas dobles (Pablo 8:57, Edwin 6:44, David 00:10) | El cliente escribe otra vez mientras Victor ya está respondiendo (respuesta tardaba ~19 s: Smart Delay 7 s + espera 7 s + ~3 s de IA) | Input complete **10 s** (junta ráfagas de hasta 10 s) y **Smart Delay eliminado** del Main Flow (publicado). Respuesta queda en ~12 s |
| Teléfono del hermano escrito en letras | Constraints #11 obligaba a escribir teléfonos en palabras | Teléfonos SIEMPRE en dígitos (Constraints, Skills, regla dura 13) |
| Envío internacional sin precio | Faltaba el dato del dueño | Ecuador US$50, Perú US$150, Venezuela US$70 por ejemplar; Panamá → sede 6889-5322; pagos de fuera solo Western Union |
| Combos "vuelven en ~2 meses" | Dato viejo | Próxima tanda a finales de diciembre (Skills, Information, enviar_combos) |
| Galería sin abono | — | Todos ponen abono; explicación empática con las palabras de Victor (vive lejos de la finca, galería personalizada; si solo quiere mirar → Telegram/Facebook; abono se descuenta y se devuelve) |

Nota: la duplicación no se puede eliminar al 100 % desde UChat: si el cliente escribe justo mientras Victor está contestando, UChat arranca una segunda respuesta. Revisar los chats del 28-nov.

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
- [x] Herramientas UChat: Input complete 10 s, sin Smart Delay (27-nov), Idle 10, imágenes Process, max_rounds 40, max_tokens 600, Function Prompts, Error Logs revisados y corregidos.
- [~] `npm test` verde (217) · validador OpenAI y revisión del reporte PENDIENTES: la clave de OpenAI en Vercel/local responde 401.
- [~] Reporte diario: código y cron listos; falta `RANCHO_UCHAT_API_TOKEN` en Vercel (lo pone fily) y clave OpenAI válida.
- [ ] Live Chat — NO APLICA (el Rancho atiende en UChat).
