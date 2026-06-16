import { z } from "zod";
import { withBridge, audit, logEvent } from "@/lib/ai/bridge";
import { getProducts } from "@/lib/ai/data";
import { searchProducts } from "@/lib/ai/search";
import { publicProduct, suggestion, emptyProduct } from "@/lib/ai/present";
import { cop } from "@/lib/ai/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ q: z.string().optional().default("") }),
  async ({ body }) => {
    const catalog = await getProducts();
    const r = searchProducts(body.q, catalog);

    const sugerencias = r.ranked
      .filter((x) => x.product.slug !== r.product?.slug)
      .slice(0, 3)
      .map((x) => suggestion(x.product));

    await logEvent("busqueda_producto", { q: body.q, status: r.status, match: r.product?.slug || "" });

    if (!r.product) {
      return {
        status: r.status,
        match: "",
        producto: emptyProduct(),
        sugerencias: sugerencias.length ? sugerencias : catalog.slice(0, 3).map(suggestion),
        mensaje: body.q
          ? `No tengo exactamente eso, pero mira estas opciones que vuelan 🐓: ${(sugerencias.length ? sugerencias : catalog.slice(0, 3).map(suggestion)).map((s) => s.name).join(", ")}. ¿Cuál te muestro?`
          : "¿Para qué animal y qué buscas? Tengo energía, vitaminas, respiratorio, desparasitantes y más. 🐓",
      };
    }

    const p = r.product;
    await audit("buscar_producto", "products", { slug: p.slug, q: body.q });

    const mensaje =
      `${p.name} — ${cop(p.priceCOP)} 🔥\n` +
      `${p.tagline || p.shortDesc}\n` +
      (p.benefits.length ? `✅ ${p.benefits.slice(0, 3).join(" · ")}\n` : "") +
      `Es contraentrega: pagas al recibir. ¿Te lo aparto? 🐓`;

    return {
      status: r.status,
      match: p.slug,
      producto: publicProduct(p),
      sugerencias,
      mensaje,
    };
  },
);
