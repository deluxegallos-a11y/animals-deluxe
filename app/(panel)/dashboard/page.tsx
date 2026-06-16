import { getDashboard } from "@/lib/queries";
import { PageHead, Card, CardHead, Tag } from "@/components/ui";
import { cop } from "@/lib/ai/format";

export const dynamic = "force-dynamic";

const ESTADO_VAR: Record<string, "ok" | "pend" | "fail" | "blue"> = {
  pagado: "ok", entregado: "ok", confirmado: "blue", despachado: "blue",
  pendiente_confirmacion: "pend", cancelado: "fail",
};

export default async function DashboardPage() {
  const d = await getDashboard();
  return (
    <>
      <PageHead title="Dashboard" subtitle="Resumen de tu tienda Animals Deluxe 🐓" />

      <div className="grid kpis">
        <Card>
          <div className="kpi-label">📦 Pedidos hoy</div>
          <div className="kpi-big">{d.pedidosHoy}</div>
          <div className="kpi-sub">{d.pedidosSemana} esta semana</div>
        </Card>
        <Card>
          <div className="kpi-label">💵 Ingresos (confirmados)</div>
          <div className="kpi-big" style={{ fontSize: 28 }}>{cop(d.ingresosCop)}</div>
          <div className="kpi-sub">contraentrega + anticipado</div>
        </Card>
        <Card>
          <div className="kpi-label">🙋 Leads nuevos</div>
          <div className="kpi-big">{d.leadsNuevos}</div>
          <div className="kpi-sub">últimos 7 días</div>
        </Card>
        <Card>
          <div className="kpi-label">🔥 Top producto</div>
          <div className="kpi-big" style={{ fontSize: 20 }}>{d.topProductos[0]?.name || "—"}</div>
          <div className="kpi-sub">{d.topProductos[0]?.cantidad ?? 0} unidades</div>
        </Card>
      </div>

      <div className="twocol" style={{ marginTop: 18 }}>
        <Card>
          <CardHead icon="🧾" title="Últimos pedidos" />
          {d.ultimosPedidos.length ? (
            <table>
              <thead><tr><th>Ref</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead>
              <tbody>
                {d.ultimosPedidos.map((o) => (
                  <tr key={o.ref}>
                    <td><b>{o.ref}</b></td>
                    <td>{o.nombre}</td>
                    <td>{cop(o.total)}</td>
                    <td><Tag variant={ESTADO_VAR[o.estado] || "pend"}>{o.estado.replace(/_/g, " ")}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty"><div className="ico">🧾</div><h4>Sin pedidos aún</h4><p>Cuando el bot cree pedidos, aparecerán aquí.</p></div>
          )}
        </Card>

        <Card>
          <CardHead icon="🏆" title="Top productos" />
          {d.topProductos.map((t, i) => (
            <div className="row" key={t.name + i}>
              <div className="coin bg-amb">{i + 1}</div>
              <div><div className="nm">{t.name}</div></div>
              <div className="right"><div className="p">{t.cantidad} uds</div></div>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
