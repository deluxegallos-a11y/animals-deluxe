import { listCustomers } from "@/lib/queries";
import { PageHead, Card, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

const EST: Record<string, "ok" | "pend" | "blue"> = { cliente: "ok", interesado: "blue", nuevo: "pend" };

export default async function ClientesPage() {
  const leads = await listCustomers();
  return (
    <>
      <PageHead title="Clientes / Leads" subtitle={`${leads.length} contactos`} />
      <Card>
        {leads.length ? (
          <table>
            <thead><tr><th>Nombre</th><th>Teléfono</th><th>Ciudad</th><th>Canal</th><th>Estado</th><th>Último contacto</th></tr></thead>
            <tbody>
              {leads.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.nombre || "—"}</b></td>
                  <td>{c.telefono || "—"}</td>
                  <td>{c.ciudad || "—"}</td>
                  <td>{c.canalOrigen}</td>
                  <td><Tag variant={EST[c.estado || "nuevo"] || "pend"}>{c.estado}</Tag></td>
                  <td className="t-mut">{c.ultimoContacto ? new Date(c.ultimoContacto).toLocaleDateString("es-CO") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty"><div className="ico">🙋</div><h4>Sin leads aún</h4><p>Cada persona que escriba al bot aparecerá aquí.</p></div>
        )}
      </Card>
    </>
  );
}
