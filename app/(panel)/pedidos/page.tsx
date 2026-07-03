import { listOrders, listFailedAttempts } from "@/lib/queries";
import { PageHead, Card } from "@/components/ui";
import { cop } from "@/lib/ai/format";
import { getShopifyCreds, shopifyOrderAdminUrl } from "@/lib/shopify";
import { OrderStatus, DispatchCell } from "./order-actions";

export const dynamic = "force-dynamic";

function dato(b: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) { const v = b?.[k]; if (v != null && String(v).trim()) return String(v); }
  return "—";
}

export default async function PedidosPage() {
  const [pedidos, creds, intentos] = await Promise.all([listOrders(), getShopifyCreds(), listFailedAttempts()]);
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
                  <td>{o.nombre}<div className="t-mut" style={{ fontSize: 11 }}>{o.telefono}{o.cedula ? ` · CC ${o.cedula}` : ""}</div></td>
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

      {intentos.length ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>⚠️ Intentos fallidos ({intentos.length})</h3>
            <span className="t-mut" style={{ fontSize: 12 }}>Pedidos que el bot intentó pero NO se crearon — recupéralos a mano.</span>
          </div>
          <table>
            <thead>
              <tr><th>Fecha</th><th>Cliente</th><th>Teléfono</th><th>Cédula</th><th>Ciudad</th><th>Producto(s)</th><th>Motivo</th></tr>
            </thead>
            <tbody>
              {intentos.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontSize: 12 }}>{a.createdAt ? new Date(a.createdAt).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td>{dato(a.body, "nombre", "cliente", "nombre_cliente", "nombre_wa")}<div className="t-mut" style={{ fontSize: 11 }}>{a.subId.slice(0, 20)}</div></td>
                  <td>{dato(a.body, "telefono", "celular", "whatsapp", "phone")}</td>
                  <td>{dato(a.body, "cedula", "cc", "documento")}</td>
                  <td>{dato(a.body, "ciudad", "municipio")}<div className="t-mut" style={{ fontSize: 11 }}>{dato(a.body, "direccion", "oficina")}</div></td>
                  <td style={{ fontSize: 12, maxWidth: 200 }}>{typeof a.body.items === "string" ? a.body.items : dato(a.body, "producto", "item") !== "—" ? dato(a.body, "producto", "item") : (a.body.items ? JSON.stringify(a.body.items) : "—")}</td>
                  <td style={{ fontSize: 11, color: "#b3261e", maxWidth: 260 }}>{a.motivo || a.resultado || "—"}{!Object.keys(a.body).length && a.rawText ? <div className="t-mut" style={{ fontSize: 10, color: "#666" }}>crudo: {a.rawText.slice(0, 120)}</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </>
  );
}
