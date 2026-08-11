import { z } from "zod";
import { withBridge } from "@/lib/ai/bridge";
import { cotizarEnvio, getProducts } from "@/lib/ai/data";
import { FREE_SHIPPING_SLUGS } from "@/lib/ai/shipping";
import { cop } from "@/lib/ai/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const POST = withBridge(
  z.object({
    ciudad: z.string().min(1),
    items: z
      .array(
        z.object({
          slug: z.string().min(1),
          cantidad: z.number().int().positive().optional().default(1),
        }),
      )
      .optional()
      .default([]),
    metodo: z.enum(["contraentrega", "anticipado"]).optional(),
  }),
  async ({ body, tenant }) => {
    // Método: lo que mande el bot; si no, el modo del tenant.
    const metodo = body.metodo ?? (tenant.paymentMode === "anticipado" ? "anticipado" : "contraentrega");
    // Si vienen ítems, cotizamos con valor real (sobreflete + recargo + gratis).
    let subtotalCop = 0;
    let unidades = 0;
    let envioGratis = false;
    let desconocidos: string[] = [];
    if (body.items.length) {
      const catalog = await getProducts();
      const resolved = body.items.map((it) => {
        const p = catalog.find((x) => x.slug === it.slug);
        const precio = p?.presentations[0]?.priceCOP ?? p?.priceCOP ?? 0;
        return { slug: it.slug, cantidad: it.cantidad, precio, envioGratis: p?.envioGratis, existe: !!p };
      });
      // Un slug que NO está en el catálogo de ESTE tenant vale $0, y un pedido que
      // suma $0 parecía "todo envío-incluido" → el bot prometía ENVÍO GRATIS por un
      // simple slug mal escrito (o de otro tenant: red-dopping-mamba es de Rooster,
      // en Animals es red-copping-mamba). Nunca se regala el envío por no reconocer
      // un producto: si algo no resuelve, se cobra flete y se avisa cuáles fueron.
      desconocidos = resolved.filter((r) => !r.existe).map((r) => r.slug);
      // Base del 7% = solo los productos que SÍ pagan envío (excluye envío-incluido).
      subtotalCop = resolved.reduce((s, r) => s + ((r.envioGratis || FREE_SHIPPING_SLUGS.has(r.slug)) ? 0 : r.precio * r.cantidad), 0);
      unidades = resolved.reduce((s, r) => s + r.cantidad, 0);
      envioGratis = !desconocidos.length && subtotalCop <= 0; // todos los items son envío-incluido
    }

    const c = await cotizarEnvio(body.ciudad, {
      subtotalCop,
      unidades: unidades || undefined,
      metodo,
      envioGratis,
    });

    const pago = metodo === "anticipado" ? "el pago es por adelantado" : "es contraentrega (pagas al recibir)";
    const flete = c.envio_gratis ? "el envío te sale *GRATIS* 🎉" : `el envío te sale en *${cop(c.costo_envio)}*`;
    let mensaje: string;
    if (!c.ciudad_encontrada) {
      // Ciudad desconocida → confirmar cobertura (no afirmar que es apartada).
      mensaje = `${cap(pago)}. A *${c.ciudad}* déjame confirmarte la cobertura exacta 🚚: el envío sería aprox *${cop(c.costo_envio)}* y la entrega *${c.tiempo}*. ¿Me confirmas la dirección y lo revisamos?`;
    } else if (c.requiere_confirmar) {
      // Zona apartada (San Andrés/Amazonas/Chocó…): tiempos largos / recogida en oficina.
      mensaje = `A ${c.ciudad} sí llegamos 🚚, pero es zona apartada: la entrega tarda *${c.tiempo}* y ${flete} (a veces es recogida en oficina). ${cap(pago)}. ¿Te confirmo y lo armamos?`;
    } else {
      mensaje = `¡Sí llegamos a ${c.ciudad}! 🚚 ${cap(flete)}, entrega en *${c.tiempo}* y ${pago}. ¿Te armo el pedido?`;
    }

    return {
      // legacy (compat)
      cobertura: c.cobertura,
      contraentrega: c.contraentrega,
      // contrato del bot
      cubre: c.cubre,
      zona: c.zona,
      costo_envio: c.costo_envio,
      envio_gratis: c.envio_gratis,
      tiempo: c.tiempo,
      dias_min: c.dias_min,
      dias_max: c.dias_max,
      requiere_confirmar: c.requiere_confirmar,
      // Slugs que no existen en el catálogo de este tenant: el flete de arriba es
      // un estimado sin ellos. El bot debe volver a identificar esos productos.
      productos_desconocidos: desconocidos,
      mensaje,
    };
  },
);
