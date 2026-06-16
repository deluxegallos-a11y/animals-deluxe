import { listConversations } from "@/lib/queries";
import { PageHead, Card, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

const EST: Record<string, "ok" | "pend" | "fail"> = { activa: "ok", escalada: "fail", cerrada: "pend" };

export default async function ConversacionesPage() {
  const convos = await listConversations();
  const escaladas = convos.filter((c) => c.c.estado === "escalada").length;
  return (
    <>
      <PageHead title="Conversaciones" subtitle={`${convos.length} conversaciones · ${escaladas} escaladas`} />
      <Card>
        {convos.length ? (
          <table>
            <thead><tr><th>Cliente</th><th>Teléfono</th><th>Estado</th><th>Asignada a</th><th>Último mensaje</th></tr></thead>
            <tbody>
              {convos.map((row) => (
                <tr key={row.c.id}>
                  <td><b>{row.cust?.nombre || "Cliente"}</b></td>
                  <td>{row.cust?.telefono || "—"}</td>
                  <td><Tag variant={EST[row.c.estado || "activa"] || "ok"}>{row.c.estado}</Tag></td>
                  <td>{row.adv?.nombre || "—"}</td>
                  <td className="t-mut">{row.c.ultimoMensajeAt ? new Date(row.c.ultimoMensajeAt).toLocaleString("es-CO") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty"><div className="ico">💬</div><h4>Sin conversaciones</h4><p>Las conversaciones del bot y las escaladas a asesor aparecerán aquí.</p></div>
        )}
      </Card>
    </>
  );
}
