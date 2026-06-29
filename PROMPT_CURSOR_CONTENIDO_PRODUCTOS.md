# 🛠️ Prompt para Claude Code — Rellenar TODOS los productos con contenido robusto + `producto_contexto`

> Pégalo en Claude Code dentro de `ANIMALS_DELUXE/`. Objetivo: que cada uno de los 41 productos
> tenga data de venta COMPLETA y a detalle, en la voz del vendedor Victor, y que el external
> request entregue al bot un contexto rico para asesorar a fondo y escalar a muchos productos.

---

## PARTE 1 · Diagnóstico (estado real, ya verificado en el código)

El external request (`/api/ai/buscar-producto`, `present.ts`) ya devuelve el objeto `producto`
con: name, priceCOP, presentations, benefits, ingredients, usage, pitch, faq, tagline, shortDesc,
imageUrl, disclaimer, url. **Pero la data está casi vacía**: en el seed `keywords=[]`, `faq=[]`,
`ingredients=[]`, **no hay campo de objeciones**, y benefits/usage/pitch son de una sola línea.
Por eso el bot "habla suave": no tiene info de dónde asesorar.

**Lo que hay que lograr:** cada producto = un mini-vendedor con data rica, y el endpoint entrega un
bloque `producto_contexto` listo para que el LLM del bot asesore con todo el detalle.

---

## PARTE 2 · Tareas

### 1) Schema (Drizzle + migración)
Agrega a `products`:
- `objeciones` jsonb `$type<Record<string,string>>` default `{}` — claves estándar:
  `muy_caro`, `lo_pienso`, `no_confio`, `no_tengo_plata`, `ya_lo_uso`.
- (Opcional pero recomendado) `presentacion_detalle` no hace falta; usa `presentations`.
Asegura que `keywords`, `faq`, `ingredients` se usen (ya existen en el schema).

### 2) Generar el contenido rico de los 41 productos (script de "enriquecimiento")
Crea `scripts/enrich-products.mjs` que, para CADA producto del catálogo, genere con un LLM
(usa `OPENAI_API_KEY` / Claude API; modelo bueno, ej. gpt-4o o claude) contenido COMPLETO en la
**voz de Victor** (ver Parte 3) y lo guarde en Supabase. Para cada producto produce:

- **`keywords`** (8–15): nombre, plural, **errores de tipeo comunes**, sinónimos, marca, el animal,
  y **la necesidad que resuelve** (ej. "pa la pelea", "antes del juego", "mocos", "lombrices").
- **`benefits`** (4–6): beneficios concretos y persuasivos, orientados a resultado en el animal
  (no características frías).
- **`usage`**: modo de uso/dosis a detalle, con la primera vez y advertencias.
- **`faq`** (≥5): preguntas reales del gallero con respuesta corta en voz de Victor
  (efecto, dosis, adicción, original, compatibilidad, para qué etapa).
- **`objeciones`** (las 5 claves): respuesta de Victor a cada una (con ROI/contraentrega/originalidad).
- **`pitch`**: 1–2 frases de gancho potentes.
- Mantén precio/presentaciones/imagen tal cual.

Reglas: **NO inventar que cura enfermedades** (bienestar y rendimiento). Respetar el tipo de animal
y la categoría. Español paisa. Idempotente (volver a correr no duplica; hace UPDATE por slug).

### 3) `producto_contexto` (el bloque que asesora)
En `lib/ai/present.ts` agrega `buildContexto(p)` que arme un texto compacto (≤1500 chars) y exponlo
en `producto.producto_contexto` (y opcionalmente como `producto_contexto` top-level) en
`/api/ai/buscar-producto`, `/api/ai/recomendar` y `/api/ai/producto`. Formato EXACTO:

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

### 4) `mensaje` más rico (la presentación)
En `/api/ai/buscar-producto` arma el `mensaje` así (sigue en voz Victor, WhatsApp-ready):
```
{name} 🔥 {pitch}
✅ {benefit1}
✅ {benefit2}
✅ {benefit3}
💵 {precio} · {presentación principal} · contraentrega (pagás al recibir)
¿Te lo aparto, mi rey? 🐓
```
`recomendar` devuelve 2–3 productos con su gancho. NUNCA `mensaje` vacío ni null.

### 5) Panel
En `/productos`, formulario: campos para keywords (tags), benefits (lista), usage, faq (Q/A),
objeciones (las 5 claves). Validación de mínimos: ≥8 keywords, ≥4 beneficios, ≥5 FAQs, 5 objeciones.
Botón "🤖 Autogenerar con IA" por producto (reusa el generador del paso 2).

---

## PARTE 3 · LA VOZ (cómo debe sonar TODO el contenido generado) — esto es Victor

El contenido de cada producto debe sonar como **Victor, vendedor gallero paisa** (mismo del prompt
del agente). Reglas de estilo para la generación:

- **Paisa colombiano, voseo:** "vos, decime, mirá, pagás, te rinde". Apelativos: "mi rey, parcero,
  hermano, mi león". Muletillas: "vea pues, de una, bacano".
- **Vendedor que empuja al cierre:** beneficios orientados a resultado en el gallo/animal (más
  fondo, más reflejos, llega encendido al careo), no fichas técnicas frías.
- **Frases marca para objeciones:** "es contraentrega, pagás cuando lo tenés en la mano",
  "original, fórmula americana, acá no manejamos copias", "te rinde X dosis, sale baratico por uso".
- **Cumplimiento:** bienestar y rendimiento. PROHIBIDO decir que cura enfermedades. Si el tema es
  salud, hablar de apoyo/bienestar y sugerir veterinario.
- **Nada de:** mexicanismos, inglés, frases de bot ("estoy para ayudarte"), promesas médicas.
- Frases cortas, 1–2 emojis (🐓🔥💪✅📦).

---

## PARTE 4 · EJEMPLO DE ORO (Energy Cobra) — replica ESTE nivel de detalle en los 41

```json
{
  "slug": "energy-cobra",
  "keywords": ["energy cobra","enrgy cobra","enrgy kobra","cobra","energizante","energizante gallo",
    "energia","doping","doping gallo","gotas de energia","pa la pelea","antes del juego","americano",
    "oxigenacion","resistencia gallo","gallo sin fondo"],
  "pitch": "El doping americano que enciende la fiera justo antes del juego: oxígeno, reflejos y fondo cuando más se necesita.",
  "benefits": [
    "Energía instantánea para que entre encendido al careo",
    "Más oxigenación en sangre = más fondo, no se ahoga",
    "Reflejos y estado de alerta arriba",
    "Más resistencia en el pico de la pelea",
    "No genera adicción: lo usás solo cuando lo necesitás",
    "Fórmula americana original, no copia"
  ],
  "usage": "6 a 8 gotas directo en el pico 1 hora antes del juego. Si es la primera vez, arrancá con 4 goticas y subí de a poco pa que el gallo se acostumbre. No lo combines con otro energizante el mismo día.",
  "faq": [
    {"q":"¿Crea adicción?","a":"No, mi rey. No genera dependencia; lo usás solo cuando lo necesitás pa el careo."},
    {"q":"¿Cuántas dosis trae?","a":"El frasco de 30 ml rinde unas 40 dosis, te dura un montón."},
    {"q":"¿En cuánto hace efecto?","a":"Se lo das 1 hora antes y entra al juego encendido, con oxígeno y reflejos arriba."},
    {"q":"¿Sirve pa un gallo nuevo en esto?","a":"Sí, pero arrancá con 4 goticas la primera vez y lo vas acostumbrando."},
    {"q":"¿Es original americano?","a":"Original, fórmula americana. Acá no manejamos copias, parcero."}
  ],
  "objeciones": {
    "muy_caro": "Mirá, son 70 mil pero rinde ~40 dosis, sale baratico por careo. Un gallo que llega sin fondo te cuesta más una pelea perdida. Es inversión pa tu ejemplar.",
    "lo_pienso": "Tranquilo parcero, te lo aparto sin compromiso y arrancás cuando querás. Eso sí, es de los que más sale.",
    "no_confio": "Es original americano y es contraentrega: pagás cuando lo tenés en la mano. Cero riesgo, mi rey.",
    "no_tengo_plata": "De una te entiendo. Mirá que es contraentrega, no pagás nada ahora; cuando llegue lo pagás. ¿Te lo aparto?",
    "ya_lo_uso": "¡Bacano! Entonces sabés cómo rinde. ¿Te mando otro frasco pa que no te quedés sin él antes del careo?"
  },
  "producto_contexto": "PRODUCTO: Energy Cobra — 70000 COP\nPRESENTACIONES: 30 ml · ~40 dosis: 70000\nPARA: Gallos de combate y exhibición · CATEGORÍA: Energizantes & Doping · ORIGEN: us\nGANCHO: El doping americano que enciende la fiera justo antes del juego.\nBENEFICIOS: Energía instantánea · Más oxigenación (más fondo) · Reflejos y alerta · Más resistencia · No genera adicción · Fórmula americana original\nMODO DE USO: 6-8 gotas en el pico 1 hora antes del juego (4 la primera vez, ir acostumbrando). No combinar con otro energizante el mismo día.\nFAQS: ¿Adicción? No. | ¿Dosis? ~40 por frasco de 30ml. | ¿Efecto? 1 hora antes, entra encendido. | ¿Gallo nuevo? Sí, arrancar con 4 gotas. | ¿Original? Americano original.\nOBJECIONES: muy_caro: rinde ~40 dosis, inversión; lo_pienso: se lo aparto sin compromiso; no_confio: contraentrega, paga al recibir; no_tengo_plata: contraentrega, no paga ahora.\nNOTA: Producto de bienestar y rendimiento. No cura enfermedades."
}
```

---

## PARTE 5 · Qué devolver al terminar
- Confirmación de que los 41 productos quedaron enriquecidos (keywords ≥8, benefits ≥4, faq ≥5,
  objeciones 5) y re-sincronizados a Shopify.
- `curl` de `/api/ai/buscar-producto?q=energia` mostrando `producto.producto_contexto` y el `mensaje` nuevo.
- Que `recomendar` y `producto` también devuelvan `producto_contexto`.

> Nota: el lado UChat (mapear `producto.producto_contexto` a un bot field `ad_prod_contexto`, y
> ajustar el prompt/AI Task para asesorar desde ahí) lo hago yo en el bot. Tú solo asegura que el
> endpoint **entregue** ese contexto rico y completo.
