import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { livechatRespuestasRapidas, products } from "@/lib/db/schema";
import { asesoresDelTenant, contexto, espaciosVisibles, SinAcceso } from "@/lib/livechat/datos";
import { LivechatUI } from "./livechat-ui";
import { InicioNeo } from "@/components/neo";
import "./livechat.css";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://animalsdeluxe.com";

export default async function LivechatPage() {
  let ctx;
  try {
    ctx = await contexto();
  } catch (e) {
    return <Aviso titulo="Live Chat no disponible" texto={e instanceof SinAcceso ? e.message : "Falta aplicar la migración supabase/06-livechat.sql"} />;
  }
  const espacios = espaciosVisibles(ctx);
  if (!ctx.config.activo || !espacios.length) {
    return <Aviso titulo="Live Chat sin configurar" texto="Esta marca no tiene líneas de UChat conectadas (tenants.livechat). Ver supabase/06-livechat.sql." />;
  }
  const [asesores, respuestas, catalogo] = await Promise.all([
    asesoresDelTenant(ctx.tenantId),
    db!.select().from(livechatRespuestasRapidas).where(eq(livechatRespuestasRapidas.tenantId, ctx.tenantId)).orderBy(asc(livechatRespuestasRapidas.atajo)),
    db!.select({ id: products.id, name: products.name, priceCop: products.priceCop, image: products.image, imageUrl: products.imageUrl })
      .from(products).where(and(eq(products.tenantId, ctx.tenantId), eq(products.activo, true))).orderBy(asc(products.name)),
  ]);
  return (
    <>
    <InicioNeo />
    <LivechatUI
      rol={ctx.rol}
      yo={{ asesorId: ctx.asesorId, nombre: ctx.asesorNombre }}
      espacios={espacios.map((e) => ({ codigo: e.codigo, nombre: e.nombre, conIa: e.con_ia, reparto: e.reparto }))}
      asesores={asesores}
      respuestas={respuestas.map((r) => ({ id: r.id, atajo: r.atajo, texto: r.texto }))}
      productos={catalogo.map((p) => ({
        id: p.id, nombre: p.name, precio: p.priceCop,
        imagen: p.imageUrl || (p.image ? (/^https?:\/\//.test(p.image) ? p.image : `${SITE}/products/${p.image}`) : ""),
      }))}
    />
    </>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="card" style={{ padding: 28 }}>
      <div className="empty"><div className="ico">💬</div><h4>{titulo}</h4><p>{texto}</p></div>
    </div>
  );
}
