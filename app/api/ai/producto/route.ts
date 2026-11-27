import { z } from "zod";
import { withBridge } from "@/lib/ai/bridge";
import { getProductBySlug } from "@/lib/ai/data";
import { publicProduct, emptyProduct } from "@/lib/ai/present";
import { cop } from "@/lib/ai/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ slug: z.string().min(1) }),
  async ({ body }) => {
    const p = await getProductBySlug(body.slug);
    if (!p) {
      return { producto: emptyProduct(), mensaje: "No encontré ese producto. ¿Buscamos otro? 🐓" };
    }
    const mensaje =
      `${p.name} — ${cop(p.priceCOP)}\n${p.pitch || p.shortDesc}\n` +
      (p.usage ? `📋 Uso: ${p.usage}\n` : "") +
      `Contraentrega en toda Colombia. ¿Te lo empaco?`;
    return { producto: publicProduct(p), mensaje };
  },
);
