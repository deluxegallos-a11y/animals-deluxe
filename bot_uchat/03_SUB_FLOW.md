# 03 · Sub-flow `SF_Match_Producto` (Animals Deluxe)

Mismo patrón probado de tu base de conocimiento (`04_FLUJOS_PATRONES`), adaptado al
contrato de la API de Animals Deluxe. **7 nodos.**

```
Start
 └→ 🔍 External Request GET /api/products/search?q={{last_text_input}}
      └→ ❓ Condición: match_status == "found" o "ambiguous"
           ├─ SÍ → 👋 Saludo "¡Hola {{first_name}}! 😊 Mirá esto:"
           │        └→ 🖼️ Imagen {{producto_imagen}}
           │             └→ 📝 Mensaje combinado (pitch + precio + pregunta de cierre)
           │                  └→ 🏷️ Tag "producto_presentado"
           │                       └→ 🛑 stop_ai_agent (el agente espera al cliente)
           └─ NO  → 💬 Mensaje "No tengo justo eso, pero mirá: {{producto_sugerencias}}"
                     └→ 🛑 stop_ai_agent
```

## Por qué este orden (idéntico a tu regla probada)
1. **API call primero** — llena los bot fields antes de enviar nada.
2. **Saludo nativo de UChat** — `{{first_name}}` solo resuelve en send_message directo.
3. **Imagen separada** — UChat la manda como media attachment.
4. **Un solo mensaje de texto combinado** — evita que el agente "repita".
5. **Tag** — tracking + dispara automatizaciones.
6. **stop_ai_agent** — fuerza la pausa; sin esto el agente dice cosas redundantes.

## Mensaje combinado (nodo 📝)
```
{{producto_pitch}}

✅ {{producto_beneficios}}

💵 {{producto_precio}} · {{producto_presentaciones}}
📦 Contraentrega: pagas cuando recibes.

¿Para qué ciudad sería el envío? 🐓
```

## Notas críticas (de tu base de conocimiento)
- ⚠️ Si el sub-flow está en modo `live`, los `update_node`/`patch_node` por API NO se
  aplican: bórralo y recréalo desde cero.
- ⚠️ El `tag_ns` se selecciona MANUAL en el editor de UChat (no hay endpoint para crear
  tags por API).
- ⚠️ La API ya garantiza strings vacíos (`""`) en vez de `null`, así que los
  `message_item` con `{{var}}` no se cuelgan aunque no haya match.
- ⚠️ Timeout del request ≤ 8s.

## Conexión con el AI Agent
Vincula tu AI Function (la que detecta "el cliente pide un producto") a este sub-flow,
igual que `link_ai_function_to_subflow(...)` en tu helper `uchat_v4.py`.
