import Link from "next/link";
import { listOrders, listFailedAttempts, listProducts, countOrders, rangoPedidos, ORDERS_PAGE } from "@/lib/queries";
import { PageHead, Card } from "@/components/ui";
import { PedidosBoard, type BoardOrder, type CatProd } from "./pedidos-board";

export const dynamic = "force-dynamic";

/** Conserva el rango de fechas activo al pedir más pedidos de esa ventana. */
function qs(sp: PedidosSP, limit: number): string {
  const p = new URLSearchParams({ limit: String(limit) });
  if (sp?.range) p.set("range", sp.range);
  if (sp?.from) p.set("from", sp.from);
  if (sp?.to) p.set("to", sp.to);
  return p.toString();
}

function dato(b: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) { const v = b?.[k]; if (v != null && String(v).trim()) return String(v); }
  return "—";
}

type PedidosSP = { limit?: string; range?: string; from?: string; to?: string };

export default async function PedidosPage({ searchParams }: { searchParams: Promise<PedidosSP> }) {
  // Ventana de pedidos cargados. El board filtra en el cliente, así que si la
  // ventana se queda corta hay pedidos que NO se pueden ni buscar → "Ver más".
  const sp = await searchParams;
  const pedido = parseInt(sp?.limit || "", 10);
  const limit = Number.isFinite(pedido) && pedido > 0 ? pedido : ORDERS_PAGE;
  // El rango de fechas se resuelve en el servidor: así "Aplicar" sobre una
  // fecha vieja trae esos pedidos aunque queden fuera de la ventana reciente.
  const range = sp?.range || "hoy";
  const { desde, hasta, label: rangoLabel } = rangoPedidos(range, sp?.from, sp?.to);
  const [pedidos, intentos, prods, total] = await Promise.all([
    listOrders({ limit, desde, hasta }), listFailedAttempts(), listProducts(), countOrders({ desde, hasta }),
  ]);
  const hayMas = total > pedidos.length;
  const catalog: CatProd[] = prods.filter((p) => p.activo).map((p) => ({
    slug: p.slug, name: p.name,
    presentaciones: (p.presentations || []).map((x) => ({ label: x.label, precio: x.priceCOP })),
  }));
  const board: BoardOrder[] = pedidos.map((o) => ({
    id: o.id, ref: o.ref, nombre: o.nombre, telefono: o.telefono, cedula: o.cedula,
    ciudad: o.ciudad, direccion: o.direccion, estado: o.estado, canal: o.canal,
    total: o.total, envio: o.envio, metodoPago: o.metodoPago,
    items: o.items.map((i) => ({ cantidad: i.cantidad, name: i.name })),
    createdAt: o.createdAt ? o.createdAt.toISOString() : null, advisor: o.advisor,
    guia: o.guia, transportadora: o.transportadora,
    despachadoAt: o.despachadoAt ? o.despachadoAt.toISOString() : null,
    clienteNotificado: !!o.clienteNotificadoAt, shopifyOrderName: o.shopifyOrderName,
    facturaNumero: o.facturaNumero, envioGuia: o.envioGuia, envioStatus: o.envioStatus, envioImpreso: o.envioImpreso,
    copiadoAt: o.copiadoAt ? o.copiadoAt.toISOString() : null,
  }));
  return (
    <>
      <PageHead
        title="Pedidos"
        subtitle={
          hayMas
            ? `${rangoLabel} · mostrando ${pedidos.length} de ${total} pedidos`
            : `${rangoLabel} · ${total} pedido${total === 1 ? "" : "s"} · flujo remisión → aprobado → guía`
        }
      />
      <Card>
        <PedidosBoard orders={board} catalog={catalog} range={range} from={sp?.from} to={sp?.to} rangoLabel={rangoLabel} />
        {hayMas ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 14 }}>
            <span className="t-mut" style={{ fontSize: 12 }}>
              Faltan {total - pedidos.length} pedidos más antiguos por cargar.
            </span>
            <Link href={`/pedidos?${qs(sp, pedidos.length + ORDERS_PAGE)}`} className="pbctrl-new" style={{ textDecoration: "none" }}>
              Ver más
            </Link>
            <Link href={`/pedidos?${qs(sp, total)}`} className="t-mut" style={{ fontSize: 12 }}>
              Cargar todos ({total})
            </Link>
          </div>
        ) : null}
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
