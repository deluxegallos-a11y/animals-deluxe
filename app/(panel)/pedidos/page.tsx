import { listOrders } from "@/lib/queries";
import { PageHead, Card } from "@/components/ui";
import { cop } from "@/lib/ai/format";
import { getShopifyCreds, shopifyOrderAdminUrl } from "@/lib/shopify";
import { OrderStatus, DispatchCell } from "./order-actions";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const [pedidos, creds] = await Promise.all([listOrders(), getShopifyCreds()]);
  const domain = creds?.domain || "";
  return (
    <>
      <PageHead title="Pedidos" subtitle={`${pedidos.length} pedidos · contraentrega`} />
      <Card>
        {pedidos.length ? (
          <table>
            <thead>
              <tr><th>Ref</th><th>Shopify</th><th>Cliente</th><th>Ciudad</th><th>Items</th><th>Total</th><th>Asesor</th><th>Estado</th><th>Despacho / Guía</th></tr>
            </thead>
            <tbody>
              {pedidos.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.ref}</b><div className="t-mut" style={{ fontSize: 11 }}>{o.metodoPago}</div></td>
                  <td>
                    {o.shopifyOrderName ? (
                      domain && o.shopifyOrderId ? (
                        <a href={shopifyOrderAdminUrl(domain, o.shopifyOrderId)} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                          {o.shopifyOrderName} ↗
                        </a>
                      ) : <b>{o.shopifyOrderName}</b>
                    ) : <span className="t-mut" style={{ fontSize: 11 }}>—</span>}
                  </td>
                  <td>{o.nombre}<div className="t-mut" style={{ fontSize: 11 }}>{o.telefono}</div></td>
                  <td>{o.ciudad}<div className="t-mut" style={{ fontSize: 11 }}>{o.direccion}</div></td>
                  <td style={{ fontSize: 12 }}>{o.items.map((it) => `${it.cantidad}× ${it.name}`).join(", ") || "—"}</td>
                  <td><b>{cop(o.total)}</b><div className="t-mut" style={{ fontSize: 11 }}>envío {cop(o.envio)}{o.descuento ? ` · -${cop(o.descuento)}` : ""}</div></td>
                  <td>{o.advisor || "—"}</td>
                  <td><OrderStatus id={o.id} estado={o.estado} /></td>
                  <td>
                    <DispatchCell
                      id={o.id}
                      guia={o.guia}
                      transportadora={o.transportadora}
                      despachadoAt={o.despachadoAt ? o.despachadoAt.toISOString() : null}
                      notificado={!!o.clienteNotificadoAt}
                    />
                  </td>
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
