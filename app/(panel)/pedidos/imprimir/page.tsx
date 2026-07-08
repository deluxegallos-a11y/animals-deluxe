import { listOrders, getConfigEmpresa, getBodegaDefault } from "@/lib/queries";
import { AutoPrint } from "./auto-print";

export const dynamic = "force-dynamic";
const COP = (n: number) => "$" + Number(n || 0).toLocaleString("es-CO");
const fecha = (d: Date | null) => (d ? new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }) : new Date().toLocaleDateString("es-CO"));

export default async function ImprimirPage({ searchParams }: { searchParams: Promise<{ tipo?: string; refs?: string; sticker?: string }> }) {
  const { tipo = "factura", refs = "", sticker = "" } = await searchParams;
  const wanted = refs.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const [all, cfg, bod] = await Promise.all([listOrders(), getConfigEmpresa(), getBodegaDefault()]);
  const pedidos = wanted.length ? all.filter((o) => wanted.includes(o.ref.toUpperCase())) : [];

  const marca = cfg?.nombreMarca || "Animals Deluxe";
  const esSticker = tipo === "sticker" || sticker === "1";
  const showFactura = !esSticker && (tipo === "factura" || tipo === "ambos");
  const showGuia = !esSticker && (tipo === "guia" || tipo === "ambos");
  const titulo = `${esSticker ? "Stickers 4×4" : tipo === "guia" ? "Guías" : tipo === "ambos" ? "Facturas + Guías" : "Facturas"} · ${pedidos.length} documento(s)`;

  // ---- Modo STICKER 4×4 (impresora térmica) ----
  if (esSticker) {
    return (
      <div className="print-root sticker-root">
        <AutoPrint titulo={titulo} />
        <style>{`@media print { @page { size: 4in 4in; margin: 0; } }`}</style>
        {!pedidos.length ? <div style={{ padding: 20 }}>No se encontraron pedidos para: {refs || "(sin refs)"}.</div> : null}
        {pedidos.map((o) => (
          <div key={o.id} className="stk">
            <div className="stk-top">
              <span className="stk-transp">{o.transportadora || "COORDINADORA"}</span>
              <span className="stk-cod">{o.metodoPago === "anticipado" ? "PAGADO" : "CONTRA ENTREGA"}</span>
            </div>
            {o.envioGuia ? <div className="stk-guia">GUÍA {o.envioGuia}</div> : null}
            <div className="stk-dest">
              <div className="stk-nm">{o.nombre || "—"}</div>
              <div className="stk-ciu">{o.ciudad || "—"}</div>
              <div className="stk-dir">{o.direccion || "—"}</div>
              <div className="stk-tel">Tel {o.telefono || "—"} · CC {o.cedula || "—"}</div>
            </div>
            <div className="stk-bot">
              <div className="stk-rec"><span>{o.metodoPago === "anticipado" ? "PAGO" : "RECAUDAR"}</span><b>{o.metodoPago === "anticipado" ? "—" : COP(o.total)}</b></div>
              <div className="stk-ref">*{o.ref}*</div>
            </div>
            <div className="stk-rem">De: {bod?.name || marca} · {cfg?.whatsapp || ""}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="print-root">
      <AutoPrint titulo={titulo} />
      {!pedidos.length ? <div className="print-doc"><p>No se encontraron pedidos para: {refs || "(sin refs)"}.</p></div> : null}

      {pedidos.map((o) => (
        <div key={o.id}>
          {showFactura && (
            <div className="print-doc">
              <div className="pf-head">
                <div>
                  <div className="pf-marca">{marca}</div>
                  <div className="pf-sub">{cfg?.razonSocial || marca}{cfg?.nit ? ` · NIT ${cfg.nit}` : ""}</div>
                  <div className="pf-sub">{cfg?.direccionFiscal || "Medellín, Antioquia"} · {cfg?.whatsapp || ""} · {cfg?.sitioWeb || "animalsdeluxe.com"}</div>
                </div>
                <div className="pf-facbox">
                  <div className="pf-factit">FACTURA DE VENTA</div>
                  <div className="pf-facno">{cfg?.prefijoFactura || "AD"}-{o.facturaNumero ?? (o.ref.replace(/[^0-9]/g, "") || "—")}</div>
                  <div className="pf-sub">Ref: {o.ref} · {fecha(o.createdAt)}</div>
                  <div className="pf-sub">{o.metodoPago === "anticipado" ? "Pago anticipado" : "Contra entrega"}</div>
                </div>
              </div>

              <div className="pf-cli">
                <div><b>Cliente:</b> {o.nombre || "—"}</div>
                <div><b>Cédula:</b> {o.cedula || "—"} · <b>Tel:</b> {o.telefono || "—"}</div>
                <div><b>Envío a:</b> {o.ciudad || "—"} — {o.direccion || "—"}</div>
              </div>

              <table className="pf-table">
                <thead><tr><th>Cant.</th><th>Producto</th><th className="r">Vr. unit.</th><th className="r">Subtotal</th></tr></thead>
                <tbody>
                  {o.items.map((it, i) => (
                    <tr key={i}><td>{it.cantidad}</td><td>{it.name}{it.presentacion ? ` · ${it.presentacion}` : ""}</td><td className="r">{COP(it.precio)}</td><td className="r">{COP(it.precio * it.cantidad)}</td></tr>
                  ))}
                </tbody>
              </table>

              <div className="pf-tot">
                <div><span>Subtotal</span><b>{COP(o.subtotal)}</b></div>
                {o.descuento ? <div><span>Descuento</span><b>-{COP(o.descuento)}</b></div> : null}
                <div><span>Envío</span><b>{o.envio ? COP(o.envio) : "Incluido"}</b></div>
                <div className="big"><span>TOTAL{o.metodoPago === "anticipado" ? "" : " a pagar al recibir"}</span><b>{COP(o.total)}</b></div>
              </div>
              <div className="pf-pie">{cfg?.pieFactura || "¡Gracias por tu compra! 🐓"}</div>
            </div>
          )}

          {showGuia && (
            <div className="print-doc pg">
              <div className="pg-head">
                <div className="pg-marca">📦 {marca}</div>
                <div className="pg-transp">{o.transportadora || "COORDINADORA"}{o.envioGuia ? ` · Guía ${o.envioGuia}` : ""}</div>
              </div>
              {!o.envioGuia ? <div className="pg-pend">⏳ GUÍA PENDIENTE — se genera al conectar el token de MiPaquete. Esta es la etiqueta interna del despacho.</div> : null}
              <div className="pg-grid">
                <div className="pg-box">
                  <div className="pg-lbl">REMITENTE</div>
                  <div className="pg-l1">{bod?.name || "Animals Deluxe - Bodega Medellín"}</div>
                  <div className="pg-l2">{bod?.address || "Medellín, Antioquia"}</div>
                  <div className="pg-l2">Tel: {cfg?.whatsapp || "573026333595"}</div>
                </div>
                <div className="pg-box dest">
                  <div className="pg-lbl">DESTINATARIO</div>
                  <div className="pg-dest">{o.nombre || "—"}</div>
                  <div className="pg-l1">{o.ciudad || "—"}</div>
                  <div className="pg-l2">{o.direccion || "—"}</div>
                  <div className="pg-l2">Tel: {o.telefono || "—"} · CC {o.cedula || "—"}</div>
                </div>
              </div>
              <div className="pg-info">
                <div><span>Contenido</span><b>{o.items.map((i) => `${i.cantidad}× ${i.name}`).join(", ") || "—"}</b></div>
                <div className="pg-money">
                  <div><span>{o.metodoPago === "anticipado" ? "Pago" : "RECAUDAR (COD)"}</span><b>{o.metodoPago === "anticipado" ? "Anticipado" : COP(o.total)}</b></div>
                  <div><span>Ref</span><b>{o.ref}</b></div>
                </div>
              </div>
              <div className="pg-code">*{o.ref}*</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
