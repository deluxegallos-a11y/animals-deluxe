import { listOrders } from "@/lib/queries";
import { PageHead, Card } from "@/components/ui";
import { cop } from "@/lib/ai/format";
import { OrderStatus } from "./order-actions";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const pedidos = await listOrders();
  return (
    <>
      <PageHead title="Pedidos" subtitle={`${pedidos.length} pedidos · contraentrega`} />
      <Card>
        {pedidos.length ? (
          <table>
            <thead>
              <tr><th>Ref</th><th>Cliente</th><th>Ciudad</th><th>Items</th><th>Total</th><th>Asesor</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {pedidos.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.ref}</b><div className="t-mut" style={{ fontSize: 11 }}>{o.metodoPago}</div></td>
                  <td>{o.nombre}<div className="t-mut" style={{ fontSize: 11 }}>{o.telefono}</div></td>
                  <td>{o.ciudad}<div className="t-mut" style={{ fontSize: 11 }}>{o.direccion}</div></td>
                  <td style={{ fontSize: 12 }}>{o.items.map((it) => `${it.cantidad}× ${it.name}`).join(", ") || "—"}</td>
                  <td><b>{cop(o.total)}</b><div className="t-mut" style={{ fontSize: 11 }}>envío {cop(o.envio)}{o.descuento ? ` · -${cop(o.descuento)}` : ""}</div></td>
                  <td>{o.advisor || "—"}</td>
                  <td><OrderStatus id={o.id} estado={o.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty"><div className="ico">🧾</div><h4>Sin pedidos</h4><p>Los pedidos que cree el bot aparecerán aquí.</p></div>
        )}
      </Card>
    </>
  );
}
