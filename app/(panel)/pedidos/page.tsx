import { listOrders, listFailedAttempts } from "@/lib/queries";
import { PageHead, Card } from "@/components/ui";
import { PedidosBoard, type BoardOrder } from "./pedidos-board";

export const dynamic = "force-dynamic";

function dato(b: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) { const v = b?.[k]; if (v != null && String(v).trim()) return String(v); }
  return "—";
}

export default async function PedidosPage() {
  const [pedidos, intentos] = await Promise.all([listOrders(), listFailedAttempts()]);
  const board: BoardOrder[] = pedidos.map((o) => ({
    id: o.id, ref: o.ref, nombre: o.nombre, telefono: o.telefono, cedula: o.cedula,
    ciudad: o.ciudad, direccion: o.direccion, estado: o.estado, canal: o.canal,
    total: o.total, envio: o.envio, metodoPago: o.metodoPago,
    items: o.items.map((i) => ({ cantidad: i.cantidad, name: i.name })),
    createdAt: o.createdAt ? o.createdAt.toISOString() : null, advisor: o.advisor,
    guia: o.guia, transportadora: o.transportadora,
    despachadoAt: o.despachadoAt ? o.despachadoAt.toISOString() : null,
    clienteNotificado: !!o.clienteNotificadoAt, shopifyOrderName: o.shopifyOrderName,
  }));
  return (
    <>
      <PageHead title="Pedidos" subtitle={`${pedidos.length} pedidos · flujo remisión → aprobado → guía`} />
      <Card>
        <PedidosBoard orders={board} />
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
