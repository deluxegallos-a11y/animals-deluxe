# 05 · Estudio — Cómo el bot entiende TODOS los productos (keywords estilo Androbot) + Shopify

> Síntesis del conocimiento del proyecto (Androbot/Androvende, backend-bridge, plantilla de
> producto, acciones Shopify de UChat) aplicado a Animals Deluxe. Responde: cómo el bot entiende
> cada producto por palabras clave, cómo lo trae con su foto, cómo vende cada uno a detalle, y
> cómo se conecta con Shopify para montar el pedido contraentrega automáticamente.

---

## 1. La idea base (validada en Androbot): el bot NO sabe productos, la plataforma sí

El bot en UChat **no almacena productos**. Por cada mensaje del cliente dispara un **external
request** a la plataforma; la plataforma resuelve qué producto es y devuelve TODO (texto de
venta + imagen + precio + variante de Shopify). El bot solo **lee** esos campos y vende.

```
Cliente WhatsApp → Bot (función) → Plataforma (matching + Shopify) → devuelve producto+imagen+mensaje → Bot vende
```

Esto ya está montado: 15 funciones del bot → 15 endpoints `/api/ai/*`. Lo que falta para que
"entienda muchos productos" es **el motor de matching por keywords en la plataforma** y que cada
producto tenga su data rica + su ID de Shopify.

---

## 2. Cómo entiende QUÉ producto es (matching por palabras clave — cascada Androbot)

El cliente escribe de mil formas ("energy cobra", "enrgy kobra", "algo pa la energía del gallo",
"el rojo ese americano"). El matching vive en la plataforma, en **cascada** (de la KB
`07_BACKEND_INTEGRATION`):

```
1. normalize(q)        → minúsculas, sin tildes, sin signos, stopwords fuera
2. matchByKeywords     → busca en el array keywords[] de cada producto   ← PRIMERO
3. matchByTrigram      → pg_trgm (similitud, tolera errores de tipeo)
4. matchByFullText     → búsqueda de texto completo
5. matchByEmbedding    → semántico (pgvector) como último recurso
```

Umbral → `status`: `found` (match fuerte) · `ambiguous` (parcial → manda alternativas) ·
`not_found` (manda top sugerencias). **Nunca devuelve null** (cuelga UChat): strings vacíos `""`.

### Lo que CADA producto necesita para ser "encontrable"
El campo clave es **`keywords[]`** (mínimo 5–15 por producto). Incluye: nombre, plural,
sinónimos, **errores comunes de tipeo**, marcas/términos equivalentes, y **la necesidad** que
resuelve. Ejemplos para Animals Deluxe:

| Producto | keywords[] sugeridas |
|---|---|
| Energy Cobra | `["energy cobra","enrgy kobra","cobra","energizante","energia","doping","gotas energia","pa la pelea","cobra roja","americano"]` |
| CyanoMax B12 5500 | `["b12","cyanomax","vitamina b12","cianocobalamina","musculo","fortalecer","inyectable b12","5500"]` |
| Clear Chicks | `["mocos","moquillo","respiratorio","gripa","estornudo","clear chicks","respira","secrecion nasal"]` |
| Gallo Purga Plus | `["purga","purgante","desparasitante","lombrices","parasitos","gallo purga","limpiar estomago"]` |
| More Muscle Dogs | `["perro","musculo perro","suplemento perro","more muscle","masa muscular canino"]` |
| Horse Deluxe | `["caballo","equino","horse deluxe","proteina caballo","lisina","musculo caballo"]` |

> **Regla de oro del matching (Animals Deluxe):** NO tratar `perro/caballo/pollo` como stopword
> (son justo lo que distingue la categoría). `gallo` sí es ruido (casi todo es de gallos).

---

## 3. Cómo lo TRAE con su foto y habla de él a detalle (data rica por producto)

De la **plantilla Androvende**: cada producto es un "mini-vendedor". Si un campo está vacío el
bot NO inventa. Cada producto debe tener:

| Campo | Para qué lo usa el bot |
|---|---|
| `nombre` + `keywords[]` | encontrarlo |
| `imageUrl` (o `imagen_principal`) | el sub-flow la envía como foto |
| `mensaje_presentacion` / `pitch` | el texto RICO con gancho + 3-5 beneficios + precio (lo que VE el cliente) |
| `descripcion_corta` | responder "¿qué es / qué trae?" |
| `pregunta_final` | enganche que termina en `?` (pide ciudad / cierra) |
| `precio` + `presentaciones[]` | precio y tamaños |
| `usage` / modo de uso | responder "¿cómo se usa / qué dosis?" |
| `faqs[]` (mín. 5) | responder dudas SIN escalar |
| `objeciones_frecuentes` | manejar "muy caro / lo pienso / no confío" |
| `disclaimer` | cumplimiento (bienestar, no cura) |

El **mensaje `mensaje`** que devuelve cada endpoint debe venir ya redactado en **paisa**, listo
para WhatsApp (lo arma la plataforma con pitch+beneficios+precio). El bot (Victor) lo relata y
sigue vendiendo. Por eso la calidad del bot depende de que la plataforma mande estos campos bien.

El sub-flow de presentación ya está construido así (7 nodos): **external request → imagen →
mensaje → stop_ai_agent** (el bot espera en silencio a que el cliente responda).

---

## 4. Conexión con Shopify (catálogo real + pedido automático)

Como el catálogo real está en **Shopify**, cada producto debe llevar su **`shopify_product_id`**
y, por presentación/variante, su **`shopify_variant_id`**. Así el bot puede armar el carrito y
crear el pedido en Shopify automáticamente.

UChat tiene **acciones Shopify nativas** (de la KB `02_API_INTERNA/03_shapes_actions.md`):

| Acción | Función |
|---|---|
| `x_empty_cart` | vaciar carrito |
| `x_add_item_to_cart` | agregar item (`variant_id`, `quantity`) |
| `x_get_cart_items` | leer carrito |
| `apply_discount_code` | aplicar cupón |
| `x_draft_order_create_from_cart` | crear **draft order** → devuelve `invoice_url` (link de pago) |

### Dos caminos de cierre (los dos válidos):

**A) Contraentrega (COD, el principal):** el bot toma los 4 datos del cliente y llama
`crear_pedido` → la **plataforma** crea la **orden en Shopify** vía Admin API (con line items por
`shopify_variant_id`, datos de envío del cliente, `financial_status: pending`, tag `COD`) y
devuelve `ref`. El cliente paga al recibir. No necesita checkout.

**B) Pago anticipado (opcional):** se arma el carrito en Shopify (`x_add_item_to_cart` ×N) y
`x_draft_order_create_from_cart` devuelve el `invoice_url`; el bot manda ese link como botón
"Pagar ahora". O Wompi.

> Recomendación: que **la plataforma** (no UChat) hable con Shopify Admin API para crear la orden
> COD — así el bot solo manda los datos y la plataforma centraliza la lógica (igual que el patrón
> backend-bridge). Las acciones Shopify nativas de UChat quedan como alternativa para el carrito
> de pago anticipado.

---

## 5. 🔌 QUÉ NECESITO DE LA PLATAFORMA (esto es lo que me tenés que pasar)

Para que el bot se comunique de verdad, necesito **3 cosas** apenas despliegues la plataforma:

1. **La URL pública** de la plataforma (ej. `https://animalsdeluxe.vercel.app`).
   → con eso hago el "barrido" y reemplazo el placeholder en las 15 external requests del bot.
2. **El `BRIDGE_TOKEN`** (el secreto del header `x-bridge-token`).
   → lo pongo en cada external request para que la plataforma autorice al bot.
3. **Confirmación del contrato de campos** — que cada `/api/ai/*` devuelva EXACTO los nombres que
   el bot ya mapea (`status`, `match`, `producto.name`, `producto.priceCOP`, `producto.imageUrl`,
   `producto.pitch`, `producto.mensaje`/`mensaje`, `sugerencias`, `pedido.ref`, `cobertura`,
   `costo_envio`, `cupon.valido`, `asesor.nombre`). Si se renombra un campo, el bot deja de leerlo.

Para la parte Shopify, además: el **dominio de la tienda Shopify** y que los productos lleven
`shopify_product_id` + `shopify_variant_id`.

---

## 6. 📨 ENCARGO PARA CLAUDE CODE (pegáselo tal cual)

> "En la plataforma de Animals Deluxe, agrega al modelo de producto estos campos y úsalos:
>
> 1. **`keywords` (text[] / jsonb)** por producto: 5–15 términos (nombre, sinónimos, errores de
>    tipeo comunes, marca, y la necesidad que resuelve). Genera keywords automáticas al crear un
>    producto (desde nombre + categoría + audiencia) y permite editarlas en el panel.
> 2. **Motor de matching en cascada** en `/api/ai/buscar-producto` y `/api/ai/recomendar`:
>    normalize(q) → match por `keywords` → `pg_trgm` (ya tienes `search_text` con índice GIN) →
>    full-text → (opcional) embeddings. Devuelve `status: found|ambiguous|not_found`, el
>    `producto` y `sugerencias[]`. NO trates perro/caballo/pollo como stopword. Nunca devuelvas null.
> 3. **Campo `mensaje`** en CADA endpoint redactado en **paisa, listo para WhatsApp** (gancho +
>    2-3 beneficios + precio + pregunta de cierre), construido desde `pitch`+`benefits`+`priceCOP`.
> 4. **Data rica por producto** (para que el bot venda a detalle): `pitch`/`mensaje_presentacion`,
>    `benefits[]`, `usage`, `faq[]` (mín 5), `objeciones_frecuentes` (claves: muy_caro, lo_pienso,
>    no_confio, no_tengo_plata), `imageUrl` pública. Valida mínimos en el panel.
> 5. **Shopify:** agrega `shopify_product_id` y, por presentación, `shopify_variant_id`. En
>    `/api/ai/crear-pedido`, además de guardar el pedido en la DB, **crea la orden en Shopify** vía
>    Admin API (line items por `shopify_variant_id` + datos de envío del cliente + tag `COD` +
>    `financial_status: pending`) y devuelve `ref` = nombre/número de la orden Shopify. Para pago
>    anticipado, expón un endpoint que cree el draft order y devuelva `invoice_url`.
> 6. Mantén EXACTOS los nombres de campos del contrato `/api/ai/*` (el bot ya mapea esos paths).
>
> Cuando termines, pásame: la URL pública, el BRIDGE_TOKEN, y un `curl` de
> `/api/ai/buscar-producto` mostrando el JSON con `mensaje`, `producto.imageUrl` y
> `shopify_variant_id`."

---

## 7. Resumen de decisiones pendientes (tuyas)
- **Catálogo:** ¿Shopify es la fuente de verdad del catálogo (recomendado, ya que la tienda está
  en Shopify) y la plataforma/panel sincroniza/lee de ahí? ¿O el panel de la plataforma es el que
  manda y empuja a Shopify? Define esto para que Claude Code lo construya bien.
- **Pago:** contraentrega ya; anticipado (Wompi o draft order de Shopify) cuando quieras activarlo.
