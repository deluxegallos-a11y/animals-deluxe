# Separación Animals Deluxe / Rooster Deluxe — estado real y qué se hizo

> Documento de la misión **M-CERO**. Responde al prompt
> `PROMPT-CLAUDE-CODE-SEPARAR-MARCAS.md`, corrigiendo un supuesto que ya no aplica.

## 1. El supuesto que cambió: no hace falta una columna `marca`

El prompt pedía crear `products.marca ('animals' | 'rooster' | 'ambas')`. **Esa
separación ya existe en la base de datos y se llama `tenant_id`.** El tenant *es*
la marca:

| tenant | payment_mode | productos activos | asesor_wa |
|---|---|---|---|
| `animals-deluxe` | `contra_entrega` | 47 (43 tras `catalog-rules`) | (el de AD) |
| `rooster-deluxe` | `anticipado` | 104 | +57 312 291 1088 |

`products`, `orders`, `customers`, `ad_map`, `categories`, `promotions`,
`coupons`, `advisors` y `product_aliases` **ya llevan `tenant_id`**, y todos los
endpoints `/api/ai/*` ya lo resuelven por `x-bridge-token` (`lib/ai/bridge.ts` →
`runWithTenant` → todas las queries de `data.ts` filtran por tenant).

Agregar `marca` encima habría creado un **segundo eje de verdad** que se
desincroniza del primero en cuanto alguien mueva un producto de tenant. Por eso
no se agregó. El "canal" que pedía el prompt tampoco hace falta: **el
`x-bridge-token` ya es el canal** — el mismo backend sirve a los dos bots.

**Cero DDL. Cero migración. La web pública quedó intacta.**

## 2. Lo que sí faltaba (y era la causa de los bugs)

El aislamiento del catálogo estaba bien, pero el bot se **quedaba mudo** ante lo
que no era suyo:

| Antes | Ahora |
|---|---|
| "botas" → `not_found`, `mensaje: ""` | `status:"otra_marca"` + redirección al WhatsApp de Rooster |
| `crear-pedido` con canilleras → "no encontré" | rechaza el pedido y redirige con el número y la forma de pago |
| El bot adivinaba la forma de pago | `politica_pago` explícito en cada respuesta de producto |
| El panel decía "Animals Deluxe" al admin de Rooster | badge de marca + política de pago reales |

### Módulo nuevo: `lib/ai/marcas.ts`

Detecta que el cliente está pidiendo algo del **otro** negocio y devuelve la
redirección lista. Dos candados, porque el primero solo no alcanzaba:

1. **Exclusividad.** Los dos catálogos comparten ~31 productos (Rooster vende un
   superset). Solo se redirige lo que existe **únicamente** en el otro tenant,
   comparando por slug y por nombre normalizado, ya después de `catalog-rules`.
   Un producto que está activo en las dos marcas **se vende contra entrega y no
   se redirige**.
2. **Contención literal.** El score no separa el acierto del error: `"botas"`
   acierta con fuzzy 1.00 y `"dragon rooster"` se equivoca **también con 1.00**
   (le basta media frase). Se exige que *todos* los tokens del query estén en el
   nombre o las keywords del producto, y que al menos uno no sea genérico
   ("gallos" solo no manda a nadie al otro canal).

También se interroga al catálogo ajeno **sin sus reglas de alias**: esas tablas
están escritas contra el catálogo completo del otro tenant y, sobre el
subconjunto exclusivo, se recuelgan del producto equivocado con toda confianza
(`"la cobra"` → Candados Cobre, `"rooster booster"` → Beak Boost). Son productos
que Animals **sí** vende: redirigirlos sería despedir a un cliente propio.

### Comportamiento verificado contra la DB de producción

```
botas / canilleras     → OTRA MARCA → Botas Canilleras (+57 312 291 1088)
comedero               → OTRA MARCA → Comedero 8 Huecos Pollitos
tijeras / espuelas     → OTRA MARCA → Tijera Roja / Corta Espuela
vitapower              → OTRA MARCA → Vita Power        (bloqueado en AD)
red rooster            → OTRA MARCA → Red Rooster       (bloqueado en AD)
energy cobra / la 77   → PROPIO  (Animals sí los vende)
rooster deluxe max     → PROPIO
vitaminas / proteina   → PROPIO  (necesidad, no redirige)
gallos / hola / ok     → not_found (genérico: nunca redirige)
```

## 3. Contrato nuevo para UChat

`buscar-producto` puede devolver un `status` nuevo. **Los flujos existentes no se
tocan**: `found` / `ambiguous` / `not_found` siguen igual.

```jsonc
{
  "status": "otra_marca",
  "matched_by": "otra_marca",
  "mensaje": "👉 *Botas Canilleras* no lo manejamos en este canal.\n…",
  "otra_marca": {
    "marca": "rooster-deluxe",
    "marca_nombre": "Rooster Deluxe",
    "politica_pago": "anticipado",
    "whatsapp": "+573122911088",
    "whatsapp_link": "https://wa.me/573122911088",
    "producto": "Botas Canilleras"
  },
  "producto": { /* vacío, nunca null */ },
  "opciones": [], "sugerencias": []
}
```

`crear-pedido` devuelve la misma forma con `ok:false`, `status:"otra_marca"`,
`requiere_asesor:true` y `otra_marca.productos[]`.

**Para el bot basta con mostrar `mensaje`.** Si querés un subflujo dedicado,
ramificá por `status == "otra_marca"`.

### `politica_pago` en toda respuesta de producto

```jsonc
{ "politica_pago": "contra_entrega",
  "politica_pago_texto": "Contra entrega: pagás al recibir el pedido.",
  "marca": "animals-deluxe", "marca_nombre": "Animals Deluxe" }
```

Sale del **tenant**, no del producto — salvo que el producto sea
`solo_anticipado`, en cuyo caso reporta `anticipado`, que es como se cobra de
verdad. El bot ya no tiene que adivinarlo.

## 3.bis PERFIL DE MARCA (segunda tanda)

`store_config` y `config_empresa` eran **una sola fila compartida por las dos
marcas**. Ninguna de las dos tiene `tenant_id`. Consecuencias reales:

| Fuga | Efecto |
|---|---|
| `store_config.nombre` | el bot de Rooster se presentaba como **"Animals Deluxe"** |
| `store_config.whatsapp` | daba el número de Animals (573026333595) a clientes de Rooster |
| `mensaje_bienvenida` | saludo de **contra entrega** en un canal de pago anticipado |
| `cuentas_bancarias` | riesgo de mandar al cliente a la cuenta de la otra marca |
| `cod_form` | upsell de contraentrega activo en la marca que cobra por adelantado |
| `config_empresa` | guías y facturas de Rooster con el **NIT, la razón social y el CONSECUTIVO DE FACTURA de Animals Deluxe** (prefijo "AD") |

**Arreglado sin DDL**, porque el perfil de cada marca ya vive en la fila `tenants`:

- `getStoreConfig()` ahora superpone la identidad del tenant (nombre, WhatsApp,
  saludo según `payment_mode`, cuentas, `cod_form`). El tenant por defecto
  (Animals) sigue leyendo la fila tal cual — **cero cambios para Animals**.
- `config_empresa` se separa por su PK de texto: Animals conserva la fila
  `'default'`; cada otra marca usa su slug y arranca con **consecutivo de factura
  propio** (prefijo `RD` para Rooster). Nunca se cae a la fila de Animals:
  compartir numeración rompe la contabilidad de las dos.

Verificado en vivo:

```
animals-deluxe  → "Animals Deluxe"  · 573026333595  · "…contraentrega en toda Colombia"
rooster-deluxe  → "Rooster Deluxe"  · +573122911088 · "…Pago anticipado y despacho a todo el país"
```

> **Pendiente de DDL:** `supabase/05-perfiles-por-marca.sql` deja `store_config` y
> `config_empresa` con `tenant_id` propio para que el panel pueda **editar** el
> perfil de cada marca por separado. No se pudo aplicar: `SUPABASE_ACCESS_TOKEN`
> está rotado (HTTP 401) y `app_runtime` no es dueño de las tablas
> (`must be owner of table store_config`). Con un token nuevo:
> `node scripts/apply-sql-mgmt.mjs supabase/05-perfiles-por-marca.sql`

## 4. Panel

Los datos ya estaban aislados por login (`tenant_users.email` → tenant). Lo que
faltaba era que **se viera**: la esquina decía "Animals Deluxe" incluso al admin
de Rooster. Ahora el nombre, las iniciales y un badge **CONTRA ENTREGA /
PAGO ANTICIPADO** salen del tenant real, y el panel de Rooster muestra una banda
recordando que hay que verificar el comprobante antes de despachar.

> No se hizo un selector de marca: requeriría quitar el `UNIQUE` de
> `tenant_users.email` (DDL) y mapear un email a dos tenants. Queda pendiente si
> alguna vez querés ver las dos marcas desde un solo login.

---

# 5. REPORTE PARA REVISIÓN DE FILY

## 5.1 Los 5 productos hoy bloqueados en Animals Deluxe

Están en `lib/ai/catalog-rules.ts`. Con este cambio **ya no desaparecen en
silencio**: el cliente que los pida es redirigido a Rooster Deluxe.

| slug bloqueado | precio | equivalente en Rooster | ¿redirige hoy? |
|---|---|---|---|
| `red-rooster` | 35.000 | Red Rooster (35.000) | ✅ sí |
| `vitapower` | 25.000 | Vita Power (25.000) | ✅ sí |
| `plume-king-shampoo` | 40.000 | Shampoo Plume King (40.000) | ✅ sí |
| `gallo-purga-plus` | 120.000 | Gallo Purga (120.000) | ⚠️ ver 5.3 |
| `rooster-xt-impulsor` | 70.000 | **no existe en Rooster** | ❌ ver 5.3 |

## 5.2 Los 16 productos exclusivos de Animals Deluxe (contra entrega puro)

No existen en el catálogo de Rooster. Estos son el núcleo real del negocio COD:

`black-rooster` · `combo-4-tapas` · `combo-del-mes` · `combo-potenciador` ·
`equipo-de-campeones` · `the-avian-pro` (Etapa de cuido) · `horse-deluxe` ·
`kit-entreno-recovery` · `more-muscle-dogs` · `more-muscle-dogs-3m` ·
`nutripeep-refoce` · `purge-beach` · `rooscer-b12-complete` ·
`rooster-xt-impulsor` · `ultra-gallo` · `vitapower`

## 5.3 ⚠️ Cosas que necesitan tu decisión

1. **`rooster-xt-impulsor`** — lo marcaste como solo-anticipado, pero **no está
   en el catálogo de Rooster Deluxe**. Hoy el cliente que lo pida recibe
   `not_found`. O se crea en Rooster, o se desbloquea en Animals. Ahora mismo no
   se vende en ningún canal.
2. **`gallo purga`** — el bot ya no lo ofrece, pero la regla de necesidad
   "desparasitante" le propone **Purge Beach** en su lugar. Si eso te sirve como
   venta alternativa, queda así; si preferís que redirija a Rooster, se quita la
   regla.
3. **`more-muscle-dogs` duplicado** — hay dos productos con el mismo nombre
   ("More Muscle Dogs Premium", ambos $100.000): `more-muscle-dogs` y
   `more-muscle-dogs-3m`. El de 3 meses debería llamarse distinto o el bot va a
   dudar entre los dos.
4. **Los 31 solapados NO son contaminación — son los más vendidos de Animals.**
   Se verificó contra la evidencia dura: los **47 productos están publicados en
   Shopify** (animalsdeluxe.com) y **46 tienen pedidos COD reales** (998 ítems
   vendidos en total). Los solapados encabezan la lista:

   | producto | también en Rooster | pedidos COD |
   |---|---|---|
   | `energy-cobra` | sí | **125** |
   | `american-rooster-fury` | sí | **55** |
   | `super-b12-max` | sí | **32** |
   | `weight-muscle-protein` | sí | **29** |
   | `champions-choice` | sí | 14 |
   | `dragon-rooster` | sí | 12 |
   | `rooster-booster` | sí | 9 |

   Además, el catálogo semilla original de Animals
   (`data/catalogo-productos.json`, 42 productos) **ya los traía** — no entraron
   por el sembrado de Rooster.

   Conclusión: las dos marcas **sí venden varios de los mismos productos
   físicos**, por canales de pago distintos. Lo que de verdad las diferencia son
   los **~57 productos exclusivos de Rooster** (botas, canilleras, comederos,
   antibióticos, vermífugos, alimentos), y esos ya redirigen solos.

   Si aun así querés sacar alguno de los 31 del canal contra entrega, agregá su
   slug a `BLOQUEADOS_POR_TENANT` en `lib/ai/catalog-rules.ts` y queda redirigido
   automáticamente — **decime cuáles y lo hago**. No los toqué por mi cuenta
   porque borrar `energy-cobra` (125 pedidos) del bot apagaría el producto más
   vendido del negocio.

### Lista completa de los 31 solapados

| producto (Animals) | $ AD | equivalente Rooster | $ RD |
|---|---|---|---|
| American Rooster Fury | 150.000 | Rooster Fury | 150.000 |
| ATP Fighter Rooster | 250.000 | ATP Fighter Rooster | 250.000 |
| ATP Rooster Gold | 180.000 | ATP Rooster Gold | 180.000 |
| Champions Choice | 60.000 | Champions Choice | 60.000 |
| Clear Chicks | 25.000 | Clear Chicks Gotas | 25.000 |
| Cure Chest for Rooster | 40.000 | Cure Chest For Rooster Gotas | 40.000 |
| CyanoMax B12 5500 | 70.000 | Ultra Gallo B12 5500 | 50.000 |
| Dragon Mamba | 150.000 | Dopping Dragón Mamba | 150.000 |
| Dragon Rooster | 80.000 | Dragon Rooster | 80.000 |
| Energy Cobra | 70.000 | Energy Cobra | 70.000 |
| Gallo Post Recovery | 80.000 | Gallo Post Recovery | 80.000 |
| Gallo Purga Plus 🔒 | 120.000 | Gallo Purga | 120.000 |
| Nordic Rooster Vitamins | 180.000 | Nordic Rooster | 250.000 |
| Omega-3 for Rooster | 75.000 | Omega 3 | 75.000 |
| Plume King Shampoo 🔒 | 40.000 | Shampoo Plume King | 40.000 |
| RED DOPPING MAMBA | 50.000 | Red Dopping Mamba | 50.000 |
| Rooster And Worm | 60.000 | Rooster End Worm | 60.000 |
| Rooster Booster | 250.000 | Rooster Booster | 250.000 |
| Rooster DELUXE | 80.000 | Rooster Deluxe Suplement | 45.000 |
| Rooster Deluxe Chicks | 45.000 | Rooster Deluxe Chicks | 45.000 |
| Rooster Deluxe Shampoo | 40.000 | Rooster Deluxe Suplement | 45.000 |
| Rooster Deluxe Supplement | 80.000 | Rooster Deluxe Suplement | 45.000 |
| Rooster Smallpox | 35.000 | Rooster Smallpox | 35.000 |
| Rooster Strength | 50.000 | Rooster Strength | 50.000 |
| Super B12 Max | 180.000 | Super B12 Max | 180.000 |
| Super Cobra 500 | 100.000 | Super Cobra 500 | 100.000 |
| Super Energizante B15 5500 Ultra | 100.000 | Super Energizante B15 5500 Ultra | 100.000 |
| Super Energy 77 Dopping | 80.000 | Super Energy 77 | 80.000 |
| Super Trainer (Pre-entreno) | 80.000 | Super Trainer | 80.000 |
| Vitalmin Rooster | 80.000 | Vitalmin Rooster | 80.000 |
| Weight Muscle Protein | 80.000 | Weight Muscle | 80.000 |

🔒 = ya bloqueado en Animals.

**Ojo con los precios que NO coinciden** (`CyanoMax` 70k vs 50k, `Nordic Rooster`
180k vs 250k, los `Rooster Deluxe *` 80k vs 45k): o son productos distintos con
nombre parecido, o hay un precio desactualizado en una de las dos marcas.

## 5.4 Categorías 100% de Rooster Deluxe

Nada de esto puede salir nunca en el bot de contra entrega — y hoy ya redirige:

`implementos` (20) · `comederos` (4) · `alimentos-y-cuido` (3) ·
`antibioticos-curacion` (15) · `vermifugos-desparasitantes` (8) ·
`higiene-cuidado` (4) · `recuperacion` (1)

---

## 6. Cómo mover un producto de marca

**No hay columna que editar.** Dos caminos:

- **Bloquearlo en Animals** (sigue existiendo, pero el bot redirige): agregá el
  slug a `BLOQUEADOS_POR_TENANT["animals-deluxe"]` en `lib/ai/catalog-rules.ts`
  y corré `npm test`.
- **Moverlo de verdad**: `UPDATE products SET tenant_id = <rooster> WHERE slug = …`
  Ojo: `orders`/`order_items` viejos lo siguen referenciando.

## 7. Tests

`tests/marcas.test.ts` — 20 casos contra los catálogos reales congelados de los
dos tenants. Suite completa: **135/135**, `tsc --noEmit` limpio, `next build` OK.

## 8. Sigue pendiente (fuera de esta misión)

- Lista de goteros con **mínimo 2 unidades** (columna `min_unidades` ya existe,
  falta poblarla) — Misión 6.3.
- Tarifario Interrapidísimo para apartadas.
- Bot de UChat para el canal anticipado (el backend ya lo sirve con el
  `ROOSTER_BRIDGE_TOKEN`).
