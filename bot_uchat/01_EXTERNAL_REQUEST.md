# 01 · External Request del bot → API de Animals Deluxe

El bot **no** guarda los productos. Cuando el cliente menciona algo, el bot dispara
un external request a la API, recibe la info y vende con ella.

---

## Configuración del External Request

| Campo | Valor |
|---|---|
| **Nombre** | `Buscar_Producto` |
| **Método** | `GET` |
| **URL** | `https://api.animalsdeluxe.com/api/products/search?q={{consulta_cliente}}` |
| **Headers** | `Content-Type: application/json`  ·  `x-api-key: <BOT_API_KEY>` |
| **Timeout** | 8 segundos máx (UChat falla después) |

> `{{consulta_cliente}}` = variable/entidad que el bot extrae del mensaje del cliente
> (lo que pidió). En UChat suele venir de `{{last_text_input}}` o de la entidad que
> capture tu AI Function.

### Body del request
GET no lleva body. Todo viaja en el query param `q`.
UChat hace el URL-encoding automáticamente al usar la variable en la URL.

---

## Respuesta de la API (contrato)

```json
{
  "ok": true,
  "match": "energy-cobra",
  "status": "found",
  "product": {
    "slug": "energy-cobra",
    "name": "Energy Cobra",
    "category": "energia",
    "audience": "Gallos de combate y exhibición",
    "origin": "us",
    "priceCOP": 70000,
    "presentations": [{ "label": "30 ml · ~40 dosis", "priceCOP": 70000 }],
    "image": "energy-cobra.jpg",
    "imageUrl": "https://....supabase.co/storage/v1/object/public/product-images/energy-cobra.jpg",
    "badges": ["Original", "Best Choice", "Fórmula americana"],
    "tagline": "El doping americano que despierta la fiera justo antes del juego.",
    "shortDesc": "Doping en gotas de calidad americana...",
    "benefits": ["Energía instantánea", "Más oxigenación", "Estado de alerta"],
    "usage": "6 a 8 gotas 1 hora antes del juego (4 si es la primera vez).",
    "pitch": "Para el gallo que entrena duro pero llega sin chispa...",
    "disclaimer": "Producto de bienestar y rendimiento. No cura enfermedades.",
    "url": "https://animalsdeluxe.com/producto?id=energy-cobra"
  },
  "suggestions": [
    { "name": "Black Rooster", "slug": "black-rooster", "priceCOP": 70000 }
  ]
}
```

### Valores de `status`
| status | Significado | Qué hace el bot |
|---|---|---|
| `found` | Coincidencia fuerte | Vende ese producto (`product`) |
| `ambiguous` | Coincidencia parcial | Presenta `product` pero ofrece `suggestions` |
| `not_found` | Sin coincidencia | `product` viene vacío → ofrece `suggestions` |
| `empty_query` | No mandó texto | Ofrece `suggestions` (top productos) |

> 🛡️ **Regla de oro respetada:** la API **nunca** devuelve `null` en campos string/array.
> Si no hay match, `product` trae `""` y `[]`, no `null`. Así los mappings de UChat
> no se cuelgan (ver `06_BUGS_Y_TRAMPAS` de tu base de conocimiento).

---

## Mapeo Respuesta → Bot Fields de UChat

Crea estos *bot fields* (tipo texto, salvo donde se indique) y mapéalos:

| JSON path | Bot field UChat | Uso |
|---|---|---|
| `$.status` | `match_status` | Decidir el flujo (found / not_found) |
| `$.match` | `producto_slug` | Tracking |
| `$.product.name` | `producto_nombre` | Mensajes |
| `$.product.priceCOP` | `producto_precio` | Cierre de venta |
| `$.product.presentations` | `producto_presentaciones` | Mostrar tamaños/precios |
| `$.product.shortDesc` | `producto_descripcion` | Enganche |
| `$.product.benefits` | `producto_beneficios` | Listar 2–3 beneficios |
| `$.product.usage` | `producto_uso` | Responder "cómo se usa" |
| `$.product.pitch` | `producto_pitch` | ⭐ Guion de venta principal |
| `$.product.imageUrl` | `producto_imagen` | Enviar imagen |
| `$.product.url` | `producto_url` | Pasar link de la ficha |
| `$.product.disclaimer` | `producto_disclaimer` | Cumplimiento |
| `$.suggestions` | `producto_sugerencias` | Alternativas si no hay match |

---

## Probar el endpoint (curl)

```bash
curl "https://api.animalsdeluxe.com/api/products/search?q=energia%20para%20la%20pelea" \
  -H "x-api-key: TU_BOT_API_KEY"
```

Debe responder `status: "found"` con `Energy Cobra` (o el mejor match).
Tolera errores de tipeo: `enrgy kobra`, `vitamina b12`, `algo pa los mocos`, etc.
