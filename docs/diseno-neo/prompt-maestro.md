# Prompt maestro · Panel Animals Deluxe «Neo AI Pro» (oct-2026)

Fuente de verdad del rediseño del panel (`.adm`). Referencias: **Tienda Core** (sistema visual
congelado «Pro v2»: blanco + azul noche + azul eléctrico) y **Motos Colombia** (marco, Live Chat
y la persona **Neo AI**). Método: skill `fily-framer` (dirección con números, QA en bucle).

## Narrativa
«Un centro de mando donde la IA (Neo AI) vende por WhatsApp 24/7 y el equipo solo entra a cerrar.»
Lo que siente el admin: calma, control, precisión. Nada grita; el azul solo aparece donde hay
significado (acción, foco, ítem activo, cifra clave).

## Tokens (claro)
| Token | Valor |
|---|---|
| Lienzo | `#F2F3F6` + glow radial `rgba(26,92,255,.10)` arriba-derecha y `.06` abajo-izquierda |
| Superficie | `#FFFFFF` · superficie-2 `#FAFAFB` · línea `rgba(10,10,10,.07)` · input `rgba(10,10,10,.14)` |
| Tinta | `#0A0A0A` · tinta-2 `#3A3A3F` · muted `#6E6E73` (4.9:1 sobre blanco) |
| Marca | 50 `#EEF3FF` · 100 `#DCE6FF` · 400 `#4F7FFF` · **500 `#1A5CFF`** · 600 `#0047FF` · 700 `#0038CC` · noche `#020A26` |
| Estado | ok `#187A43`/`#E6F6EC` · vigilar `#A06200`/`#FFF4D6` · urgente `#C2281D`/`#FDECEA` |
| Grafito (protagonista) | `linear-gradient(160deg,#15161B,#23252C)` con rejilla de puntos enmascarada |

Oscuro: lienzo `#030920`, superficie `#0A1433`, superficie-2 `#0E1A40`, línea `rgba(255,255,255,.10)`,
muted `#A3AECF`. Nunca negro neutro.

## Tipografía
- UI: **Inter** (next/font) con `cv11, ss01`; antetítulos, encabezados de tabla y teclas: **Geist Mono**.
- h1 página: 32px / 600 / -0.035em / 1.06 · antetítulo: mono 11px / 600 / +0.08em / uppercase / marca-700.
- KPI: 32–34px / 600 / -0.04em, `tabular-nums` en TODA cifra.
- Cuerpo 14px/1.5; etiquetas 12–13px muted.

## Forma y profundidad
- Radios: tarjetas 24 · héroe/grafito 28 · paneles hundidos 18 · botones e inputs 13 · shell lateral 26 · chips 999.
- Sombra en capas (contacto + ambiente + proyección):
  `0 1px 2px rgba(10,10,10,.05), 0 6px 16px -8px rgba(10,10,10,.08), 0 24px 48px -28px rgba(10,10,10,.14)`
  + realce `inset 0 1px 0 rgba(255,255,255,.9)`. Flotante (modales/popovers) con proyección azul `rgba(0,56,204,.28)`.

## Shell
- **Barra lateral**: cápsula de vidrio flotante (`blur 18px saturate 1.6`, radio 26, margen 12px),
  272px abierta / **92px riel** (recordado en localStorage). Ítem activo = baldosa con degradado
  marca 500→700, realce interior y glow `0 6px 16px -6px rgba(0,71,255,.7)`. Grupos con título mono 10px.
  Tarjeta **Neo AI** al pie: cara de puntos, «en vivo».
- **Barra superior** 68px transparente: migas `Marca › Área`, buscador 44px `clamp(220px,26vw,360px)` con `⌘K`,
  botones-ícono 44px radio 14, chip de forma de pago, avatar.
- Contenido: máx 1320px, padding 24/28.

## Componentes
- Botón primario «volumen»: `linear-gradient(180deg,#4F7FFF,#1A5CFF 45%,#0047FF)`, realce arriba, sombra abajo,
  glow azul; hover `translateY(-1px)`; active `scale(.98)`. Secundario: blanco + borde línea. Alto 40.
- Inputs radio 13, foco `0 0 0 4px rgba(26,92,255,.16)`.
- Chips 999, `3px 10px`, 12px/600.
- Tablas: cabecera mono 11px uppercase muted, filas 14px, hover `rgba(26,92,255,.04)`.
- KPI: tarjeta blanca, etiqueta 13px muted, cifra 32px, ícono en baldosa 40px; **un solo protagonista
  grafito por fila** (el dato que más importa).
- Vacíos: panel hundido + rejilla de puntos + una línea + acción.

## Neo AI (persona)
- `CaraNeo`: anillo de puntos + dos ojos cuadrados azules que parpadean (4.5s) + boca de puntos (SVG, sin imágenes).
- `EnVivo`: punto verde con latido 1.8s. `NeoEscribiendo`: tres puntos que saltan 1.1s (140/280ms).
- En el Live Chat: los mensajes de la IA se firman «Neo AI» con la cara; burbuja `#EEF3FF→#E9EFFF`;
  humano = azul `#2F6BFF→#0047FF`. «Neo AI está escribiendo…» cuando el cliente escribió hace <90s y el bot está activo.
- Pie: «Powered by Neo AI».

## Movimiento
- Solo `transform`/`opacity`. Entrada `.entrar`: opacity 0→1 + translateY 8→0, 420ms `cubic-bezier(.16,1,.3,1)`,
  stagger 60ms. Hover tarjetas: lift 2px 200ms. Skeleton: brillo 2.2s.
- `prefers-reduced-motion`: todo estático.

## QA (criterio de hecho)
Capturas 1440×900 y 390×844 de dashboard, pedidos, productos, clientes, live chat, anuncios, configuración
(claro y oscuro). Sin desbordes (botón «Ver tienda», títulos de KPI), contraste AA medido, foco visible,
sin errores de consola, `tsc` + tests + build verdes.
