# Integración del carrito → checkout

El carrito (`components/store/cart.tsx`) está desacoplado del checkout vía
`lib/cart-service.ts`. Hoy usa **WhatsApp contraentrega**; la arquitectura
ya está lista para conectar **Shopify Storefront API** sin tocar la UI.

## Hoy (activo): WhatsApp contraentrega
- `checkoutWhatsApp(items, wa)` arma un `https://wa.me/<wa>?text=...` con todo el
  carrito (producto, presentación, cantidad, subtotal) y abre WhatsApp.
- El número sale del WhatsApp configurado en el panel (`store_config.whatsapp`),
  que la página pública pasa como prop `wa`.

## Mañana: Shopify Storefront API (checkout real)
Pasos para conectarlo (sin rediseñar nada):

1. **Credenciales** (env):
   - `NEXT_PUBLIC_SHOPIFY_DOMAIN` (ej. `animals-deluxe.myshopify.com`)
   - `SHOPIFY_STOREFRONT_TOKEN` (Storefront API access token)
2. **Mapear presentación → variantId**: cada `CartItem` ya tiene `variantId?`.
   Llénalo al agregar al carrito (el panel ya guarda `shopify_variant_id` por
   presentación en `products.presentations[].shopifyVariantId`).
3. **Implementar `checkoutShopify(items)`** en `lib/cart-service.ts`:
   ```graphql
   mutation cartCreate($lines: [CartLineInput!]!) {
     cartCreate(input: { lines: $lines }) {
       cart { checkoutUrl }
     }
   }
   ```
   con `lines = items.map(i => ({ merchandiseId: i.variantId, quantity: i.qty }))`.
   Devolver `cart.checkoutUrl` y redirigir.
4. **Botón**: en el drawer, cambiar/duplicar el CTA para llamar `checkoutShopify`
   (un flag de config decide WhatsApp vs Shopify).

No hace falta cambiar el estado del carrito ni el drawer: solo el `cartService`.
