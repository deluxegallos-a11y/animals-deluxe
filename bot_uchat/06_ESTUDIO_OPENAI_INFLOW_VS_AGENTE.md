# 06 · Estudio — Asesoría profunda por producto: OpenAI in-flow (patrón Pipe/Chatby) vs AI Agent

> Problema observado: cuando el cliente pide un producto, el bot "habla un poquito" pero no entra
> con contexto grande; la dinámica queda básica. Análisis + diseño recomendado para que el bot
> asesore a fondo cada producto y eso **escale a muchos productos**.

---

## 1. Diagnóstico — por qué se siente suave

Dos causas reales (independientes):

1. **El sub-flow manda un `mensaje` estático y luego `stop_ai_agent`.** Si la plataforma devuelve
   un `mensaje` corto, la presentación es corta. Nadie la elabora.
2. **Al AI Agent solo le mapeamos campos delgados** (nombre, precio, pitch, imagen). NO recibe
   beneficios, modo de uso, FAQs ni objeciones. Por eso no responde dudas a fondo: no tiene la data.

> Regla base: **el bot solo es tan bueno como la info que le llega del external request.** Hoy le
> llega poca. Eso hay que arreglarlo SÍ o SÍ, gane quien gane el debate de arquitectura.

---

## 2. El patrón que propones (OpenAI in-flow, estilo Pipe/Chatby)

En tu bot "Compralo con Pipe" el flujo hace: external request llena las etiquetas → **nodo OpenAI
"Crear finalización de chat"** que genera la respuesta a partir de esas etiquetas → guarda en
`{{respuesta IA1}}` → la envía → un **Condition** lee `respuesta IA1` (contiene `VENTA_CERRADA`,
"Gracias por proporcionar tus datos", etc.) y ramifica el estado de la venta. Es una **máquina de
estados conversacional** donde cada turno = una llamada LLM con un prompt construido al momento.

**En UChat el equivalente del nodo OpenAI de Chatby es un `AI Task`** (prompt + input → texto en
una variable). O sea, esto es 100% replicable aquí.

### Por qué es bueno (y escala a muchos productos)
- ✅ El LLM **siempre** tiene el contexto completo y fresco del producto (se inyecta en cada turno).
  Nada de "se me olvidó" o "quedó en el aire". Asesoría concreta y consistente.
- ✅ Escala a N productos sin tocar el bot: la data vive en la plataforma; el flujo solo inyecta la
  que llegó.
- ✅ Control total del prompt por turno + ramificación determinística con Conditions sobre la salida
  (estado de venta claro: presentando / tomando datos / cerrada).
- ✅ Portable (tu Chatby ya lo prueba).

### El costo (lo honesto)
- ⚠️ Pierdes el **function-calling automático** del AI Agent: tú decides en el flujo cuándo buscar
  producto vs tomar pedido vs cobertura. Necesitas una capa de **enrutamiento de intención** (un AI
  Task clasificador, o el AI Agent SOLO para enrutar).
- ⚠️ Más nodos (loops + conditions) y más tokens por turno (mandas el contexto cada vez).

---

## 3. Tres niveles de solución (de simple a potente)

| Nivel | Qué se hace | Esfuerzo | Gana |
|---|---|---|---|
| **N1 · `mensaje` rico** | La plataforma arma el `mensaje` completo (gancho + 3-5 beneficios + uso + precio + pregunta) en paisa. | Bajo (solo backend) | ~70% del "se siente suave" en la PRESENTACIÓN |
| **N2 · `producto_contexto` al agente** | El external request devuelve un bloque `producto_contexto` (todo lo vendible) y se mapea a UN bot field que el agente LEE para responder dudas/objeciones a fondo. | Medio | Asesoría profunda en preguntas de seguimiento, manteniendo function-calling |
| **N3 · AI Task in-flow (tu idea)** | En los sub-flows de presentación, un **AI Task** genera la respuesta desde `producto_contexto` + el mensaje del cliente, en bucle, con conditions de estado. | Alto | Máximo control y consistencia; máquina de estados como Chatby |

---

## 4. Recomendación (lo que yo haría) — híbrido pragmático

**Paso 1 (ya): N1 + N2.** Resuelven el 80% del problema con poco riesgo:
- La plataforma devuelve, además de `mensaje`, un **`producto_contexto`** (texto compacto con TODO:
  nombre, presentaciones, beneficios, uso, FAQs, objeciones, disclaimer).
- Mapear `producto_contexto` a un bot field `ad_prod_contexto`.
- Prompt de Victor: "Cuando hay producto activo, asesora usando TODO lo que está en
  {{ad_prod_contexto}}: responde dudas con sus FAQs, maneja objeciones con sus argumentos."
  → el agente deja de quedar "en el aire" porque ahora SÍ tiene la info.

**Paso 2 (si quieres el techo): N3 para los turnos de presentación.**
- En `SF_AD_buscar_producto` y `SF_AD_recomendar`, después del external request, agregar un **AI
  Task** "Asesor de producto" con prompt = persona de Victor + "asesora SOLO con este contexto:
  {{ad_prod_contexto}}" + `{{last_text_input}}` → salida a `ad_respuesta_ia`. Enviar imagen +
  `ad_respuesta_ia` (en vez del `mensaje` estático). Así cada presentación es dinámica, rica y
  pegada al producto exacto.
- Mantener el **AI Agent solo para enrutar** (decide buscar_producto / recomendar / cobertura /
  crear_pedido) y para el cierre. Lo pesado de "asesorar el producto" lo hace el AI Task con
  contexto completo. → Lo mejor de los dos mundos: el agente enruta, el AI Task da profundidad.

**Bucle por producto (lo que pediste):** cliente pide producto → external request llena
`ad_prod_contexto` → AI Task asesora desde ahí → cliente pregunta otra cosa del mismo producto → el
agente/AI Task responde con el mismo contexto → cliente pide OTRO producto → external request
recarga `ad_prod_contexto` → y sigue el bucle, hasta que el estado avanza (pide ciudad → datos →
cierre contraentrega).

---

## 5. 📨 Encargo para Claude Code (plataforma)

> "En `/api/ai/buscar-producto`, `/api/ai/recomendar` y `/api/ai/producto`, agrega al objeto de
> respuesta un campo **`producto_contexto`**: un bloque de texto compacto (≤1500 chars) que
> compile TODO lo vendible del producto para que un LLM lo use como contexto. Formato sugerido:
>
> ```
> PRODUCTO: {name} — {precio} COP (presentaciones: {label:precio, ...})
> PARA: {audience}. CATEGORÍA: {category}.
> PITCH: {pitch}
> BENEFICIOS: {benefits unidos por ' · '}
> MODO DE USO: {usage}
> FAQS: {q: a | q: a ...}
> OBJECIONES: {muy_caro: ... | lo_pienso: ... | no_confio: ...}
> DISCLAIMER: {disclaimer}
> ```
>
> Debe venir relleno y sin null. Mantén también el `mensaje` (presentación lista para WhatsApp).
> Asegúrate de que cada producto tenga `benefits`, `usage`, `faq[]` y `objeciones_frecuentes`
> poblados (valida mínimos en el panel: ≥3 beneficios, ≥3 FAQs, ≥3 objeciones)."

---

## 6. Veredicto
Tu instinto es correcto: el problema es que la info no llega rica al LLM. La estructura de Pipe
(OpenAI in-flow alimentado por las etiquetas) es **muy buena y escalable** para asesorar muchos
productos a fondo — es el techo de control. Pero antes de meter toda esa máquina de estados, el
**90% del "se siente suave" se arregla** haciendo que la plataforma mande `producto_contexto` rico
y que el bot lo use (N1+N2). Recomiendo: N1+N2 ya, y N3 (AI Task in-flow) para llevar la
presentación al máximo. Así el cliente sale **bien asesorado de cada producto**, con la dinámica
sólida y no a medias.
