"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus, bulkUpdateStatus, despacharPedido, crearPedidoManual } from "../actions";
import { crearGuia, crearGuiasBulk, obtenerPdfGuia, obtenerPdfGuiasBulk, cancelarGuia, pasarAOrdenDeVenta, cotizarPedido, marcarCopiado, type Transportadora } from "./mp-actions";
import { fechaCO, soloFechaCO, horaCO } from "@/lib/fecha";
import { Download, Copy } from "lucide-react";

export type BoardOrder = {
  id: string; ref: string; nombre: string; telefono: string; cedula: string; ciudad: string; direccion: string;
  estado: string; canal: string; total: number; envio: number; metodoPago: string;
  items: { cantidad: number; name: string }[];
  createdAt: string | null; advisor: string;
  guia: string; transportadora: string; despachadoAt: string | null; clienteNotificado: boolean;
  shopifyOrderName: string;
  facturaNumero: number | null; envioGuia: string; envioStatus: string; envioImpreso: boolean;
  copiadoAt: string | null;
};
const abrirImpresion = (tipo: string, refs: string[]) => { if (refs.length) window.open(`/pedidos/imprimir?tipo=${tipo}&refs=${refs.join(",")}`, "_blank"); };
export type CatProd = { slug: string; name: string; presentaciones: { label: string; precio: number }[] };

const COP = (n: number) => "$" + Number(n || 0).toLocaleString("es-CO");

const CHAN: Record<string, { label: string; color: string; ic: string }> = {
  whatsapp: { label: "WhatsApp", color: "#16C784", ic: "📱" },
  messenger: { label: "Messenger", color: "#0084FF", ic: "💬" },
  web: { label: "Página web", color: "#7A3CFF", ic: "🌐" },
  asesor: { label: "Asesor (manual)", color: "#F79009", ic: "✍️" },
};
const chan = (c: string) => CHAN[c] || { label: c || "—", color: "#8A93A5", ic: "•" };

const EST: Record<string, { label: string; color: string; bg: string }> = {
  remision: { label: "Remisión de venta", color: "#B54708", bg: "#FFF4E5" },
  aprobado: { label: "Orden de venta", color: "#067647", bg: "#E6F9F1" },
  guia: { label: "En guía", color: "#1E50E6", bg: "#EAF0FF" },
  despachado: { label: "Despachado", color: "#6941C6", bg: "#F4EBFF" },
  entregado: { label: "Entregado", color: "#067647", bg: "#E6F9F1" },
  cancelado: { label: "Cancelado", color: "#B42318", bg: "#FEECEB" },
};
const est = (e: string) => EST[e] || { label: e || "—", color: "#475467", bg: "#F2F4F7" };

/* mensaje para pegar en el grupo de WhatsApp */
function mensajeGuia(o: BoardOrder): string {
  const prod = o.items.map((i) => `${i.cantidad}× ${i.name}`).join(", ");
  const anticipado = o.metodoPago === "anticipado";
  return [
    `📦 *PEDIDO ${o.ref}* (${anticipado ? "pago anticipado" : "contra entrega"})`,
    `👤 ${o.nombre || "—"}`,
    `🪪 CC ${o.cedula || "—"}`,
    `📱 ${o.telefono || "—"}`,
    `📍 ${o.ciudad || "—"} — ${o.direccion || "—"}`,
    `🛒 ${prod || "—"}`,
    anticipado
      ? `💳 YA PAGÓ (anticipado) · valor ${COP(o.total)}`
      : `💵 A RECAUDAR (producto): ${COP(o.total)}\n🚚 Flete: lo cobra la transportadora aparte${o.envio ? ` (aprox ${COP(o.envio)})` : ""}`,
  ].join("\n");
}

function faltantes(o: BoardOrder): string[] {
  const f: string[] = [];
  if (!o.nombre?.trim()) f.push("nombre");
  if (!o.telefono?.trim()) f.push("teléfono");
  if (!o.cedula?.trim()) f.push("cédula");
  if (!o.ciudad?.trim()) f.push("ciudad");
  if (!o.direccion?.trim()) f.push("dirección");
  if (!o.items.length) f.push("productos");
  return f;
}

const RANGOS: { k: string; label: string }[] = [
  { k: "hoy", label: "Hoy" }, { k: "ayer", label: "Ayer" }, { k: "semana", label: "7 días" },
  { k: "mes", label: "Este mes" }, { k: "30d", label: "30 días" }, { k: "todos", label: "Todos" },
];

/* ---------- Descarga de la lista filtrada (CSV que Excel abre bien) ---------- */
const CSV_COLS: { h: string; v: (o: BoardOrder) => string | number }[] = [
  { h: "Referencia", v: (o) => o.ref },
  { h: "Fecha", v: (o) => (o.createdAt ? soloFechaCO(o.createdAt) : "") },
  { h: "Hora", v: (o) => (o.createdAt ? horaCO(o.createdAt) : "") },
  { h: "Estado", v: (o) => est(o.estado).label },
  { h: "Canal", v: (o) => chan(o.canal).label },
  { h: "Cliente", v: (o) => o.nombre },
  { h: "Teléfono", v: (o) => o.telefono },
  { h: "Cédula", v: (o) => o.cedula },
  { h: "Ciudad", v: (o) => o.ciudad },
  { h: "Dirección", v: (o) => o.direccion },
  { h: "Productos", v: (o) => o.items.map((i) => `${i.cantidad} x ${i.name}`).join(" | ") },
  { h: "Unidades", v: (o) => o.items.reduce((n, i) => n + (i.cantidad || 0), 0) },
  { h: "Método de pago", v: (o) => (o.metodoPago === "anticipado" ? "Anticipado" : "Contraentrega") },
  { h: "Total", v: (o) => o.total || 0 },
  { h: "Flete", v: (o) => o.envio || 0 },
  { h: "Guía", v: (o) => o.envioGuia || o.guia || "" },
  { h: "Transportadora", v: (o) => o.transportadora || "" },
  { h: "Despachado", v: (o) => (o.despachadoAt ? fechaCO(o.despachadoAt, { dateStyle: "short", timeStyle: "short" }) : "") },
  { h: "Factura", v: (o) => (o.facturaNumero != null ? String(o.facturaNumero) : "") },
  { h: "Asesor", v: (o) => o.advisor || "" },
];
/** Excel en es-CO usa `;`. Se escapa con comillas y se antepone BOM para las tildes. */
function aCSV(rows: BoardOrder[]): string {
  const cel = (x: string | number) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const lineas = [CSV_COLS.map((c) => cel(c.h)).join(";")];
  for (const o of rows) lineas.push(CSV_COLS.map((c) => cel(c.v(o))).join(";"));
  return "\uFEFF" + lineas.join("\r\n");
}
function descargarCSV(rows: BoardOrder[], nombre: string) {
  const url = URL.createObjectURL(new Blob([aCSV(rows)], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Nombre de archivo legible: pedidos-2026-08-31.csv / pedidos-2026-08-01_a_2026-08-31.csv */
function nombreArchivo(range: string, from?: string, to?: string) {
  const hoyISO = new Date().toISOString().slice(0, 10);
  if (range === "custom" && from) return `pedidos-${from}${to && to !== from ? `_a_${to}` : ""}.csv`;
  return `pedidos-${range || "hoy"}-${hoyISO}.csv`;
}
async function copy(text: string) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }

/* ============ Selector de rango de fechas (mismo patrón que el dashboard) ============ */
function RangoPedidos({ range, from, to }: { range: string; from?: string; to?: string }) {
  const router = useRouter();
  const [f, setF] = React.useState(from || "");
  const [t, setT] = React.useState(to || "");
  // Si el rango llega por URL (volver atrás, recargar), los inputs lo reflejan.
  React.useEffect(() => { setF(from || ""); setT(to || ""); }, [from, to]);
  const aplicar = () => { if (f) router.push(`/pedidos?range=custom&from=${f}${t ? `&to=${t}` : ""}`); };
  return (
    <div className="dash-range">
      {RANGOS.map((r) => (
        <button key={r.k} type="button" className={"dash-rbtn" + (range === r.k ? " on" : "")} onClick={() => router.push(`/pedidos?range=${r.k}`)}>
          {r.label}
        </button>
      ))}
      <div className="dash-custom">
        <input type="date" value={f} max={t || undefined} onChange={(e) => setF(e.target.value)} onKeyDown={(e) => e.key === "Enter" && aplicar()} aria-label="Desde" />
        <span className="sep">→</span>
        <input type="date" value={t} min={f || undefined} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === "Enter" && aplicar()} aria-label="Hasta" />
        <button type="button" className={"dash-rbtn apply" + (range === "custom" ? " on" : "")} disabled={!f} onClick={aplicar}>Aplicar</button>
      </div>
    </div>
  );
}

export function PedidosBoard({ orders, catalog, range, from, to, rangoLabel }: {
  orders: BoardOrder[]; catalog: CatProd[]; range: string; from?: string; to?: string; rangoLabel: string;
}) {
  const router = useRouter();
  const [canal, setCanal] = React.useState<"todos" | "whatsapp" | "messenger" | "web" | "asesor">("todos");
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [guiaFor, setGuiaFor] = React.useState<string | null>(null);
  const [estadoF, setEstadoF] = React.useState<string>("remision");
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [toast, setToast] = React.useState("");

  // El rango de fechas ya lo aplicó el servidor; aquí solo se filtra dentro de él.
  const conGuia = (o: BoardOrder) => !!o.envioGuia || o.envioStatus === "guia_generada";
  const delDia = orders;
  const filtrados = delDia.filter((o) => {
    if (canal !== "todos" && o.canal !== canal) return false;
    if (estadoF !== "todos") {
      if (estadoF === "guia_generada") { if (!conGuia(o)) return false; }
      else if (estadoF === "sin_guia") { if (conGuia(o) || o.estado === "cancelado") return false; }
      else if (o.estado !== estadoF) return false;
    }
    if (q.trim()) { const s = q.toLowerCase(); return [o.nombre, o.ref, o.telefono, o.ciudad, o.cedula].some((v) => (v || "").toLowerCase().includes(s)); }
    return true;
  });

  const kCanal = (c: string) => delDia.filter((o) => o.canal === c).length;
  const kEst = (e: string) => delDia.filter((o) => o.estado === e).length;
  const kGuia = delDia.filter(conGuia).length;
  const recaudo = filtrados.reduce((s, o) => s + o.total, 0);

  const open = orders.find((o) => o.id === openId) || null;
  const selList = filtrados.filter((o) => sel.has(o.id));

  function toggle(id: string) { setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleAll() { setSel((p) => (p.size === filtrados.length ? new Set() : new Set(filtrados.map((o) => o.id)))); }
  function flash(m: string) { setToast(m); setTimeout(() => setToast(""), 2200); }

  async function bulk(estado: string) {
    setBulkBusy(true); const r = await bulkUpdateStatus([...sel], estado); setBulkBusy(false);
    setSel(new Set()); flash(`${r.count} pedido(s) → ${est(estado).label}`);
  }
  async function bulkCopy() {
    const txt = selList.map(mensajeGuia).join("\n\n━━━━━━━━━━\n\n");
    const ok = await copy(txt);
    if (ok) { await marcarCopiado(selList.map((o) => o.id)); setSel(new Set()); }
    flash(ok ? `📋 ${selList.length} copiado(s) a WhatsApp` : "No se pudo copiar");
  }
  async function bulkGuias() {
    setBulkBusy(true); const r = await crearGuiasBulk([...sel]); setBulkBusy(false);
    setSel(new Set()); flash(`🚚 Guías: ${r.creadas} creadas · ${r.pendientes} pendientes (sin token) · ${r.errores} error`);
  }
  async function bulkPdf() {
    setBulkBusy(true);
    try {
      const r = await obtenerPdfGuiasBulk([...sel]);
      if (!r.guias.length) { flash("Ninguno de los seleccionados tiene guía lista"); return; }
      // Abre cada PDF en una pestaña (el navegador puede pedir permiso para varias)
      r.guias.forEach((g, i) => setTimeout(() => { try { window.open(g.pdfUrl, "_blank"); } catch { /* */ } }, i * 350));
      flash(`📥 ${r.guias.length} guía(s) abierta(s)${r.faltantes ? ` · ${r.faltantes} sin guía lista` : ""}`);
      setSel(new Set());
    } catch { flash("No se pudieron descargar las guías"); }
    finally { setBulkBusy(false); }
  }

  return (
    <div>
      {/* Flujo por estados — organizador principal */}
      <div className="pbflow">
        {[
          { k: "remision", label: "Remisiones de venta", n: kEst("remision") },
          { k: "aprobado", label: "Órdenes de venta", n: kEst("aprobado") },
          { k: "guia_generada", label: "Con guía", n: kGuia },
          { k: "despachado", label: "Despachados", n: kEst("despachado") },
          { k: "todos", label: "Todos", n: delDia.length },
        ].map((f, i, arr) => (
          <React.Fragment key={f.k}>
            <button className={"pbflow-tab" + (estadoF === f.k ? " on" : "")} onClick={() => { setEstadoF(f.k); setSel(new Set()); }}>
              <span className="l">{f.label}</span><span className="n">{f.n}</span>
            </button>
            {i < arr.length - 1 ? <span className="pbflow-arrow" aria-hidden>›</span> : null}
          </React.Fragment>
        ))}
      </div>

      {/* Rango de fechas — lo resuelve el servidor, así que también trae pedidos viejos */}
      <RangoPedidos range={range} from={from} to={to} />

      {/* Controles */}
      <div className="pbctrl">
        <input className="pbctrl-search" placeholder="Buscar por nombre, ref, teléfono o cédula…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="pbctrl-canal" value={canal} onChange={(e) => setCanal(e.target.value as typeof canal)}>
          <option value="todos">Todos los canales</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="messenger">Messenger</option>
          <option value="web">Página web</option>
          <option value="asesor">Asesor</option>
        </select>
        <button
          className="pbctrl-dl"
          disabled={!filtrados.length}
          title={filtrados.length ? `Descargar ${filtrados.length} pedido(s) de ${rangoLabel} en Excel/CSV` : "No hay pedidos que descargar"}
          onClick={() => { descargarCSV(filtrados, nombreArchivo(range, from, to)); flash(`⬇️ ${filtrados.length} pedido(s) descargado(s)`); }}
        >
          <Download size={15} aria-hidden /> Descargar lista{filtrados.length ? ` (${filtrados.length})` : ""}
        </button>
        <button className="pbctrl-new" onClick={() => setManualOpen(true)}>+ Crear pedido</button>
      </div>

      {/* Barra de acciones masivas */}
      {sel.size > 0 && (
        <div className="pb-bulk">
          <span className="cnt">{sel.size} seleccionado{sel.size > 1 ? "s" : ""}</span>
          <span className="sp" />
          <button className="ghost" disabled={bulkBusy} onClick={() => bulk("aprobado")}>✓ Orden de venta</button>
          <button style={{ background: "var(--blue)" }} disabled={bulkBusy} onClick={bulkGuias}>🚚 Crear guías MiPaquete</button>
          <button style={{ background: "var(--green)" }} disabled={bulkBusy} onClick={bulkPdf}>{bulkBusy ? "…" : "📥 Descargar guías MiPaquete"}</button>
          <button className="ghost" onClick={() => abrirImpresion("factura", selList.map((o) => o.ref))}>🖨️ Facturas</button>
          <button className="ghost" onClick={() => abrirImpresion("guia", selList.map((o) => o.ref))}>📄 Guías</button>
          <button className="ghost" onClick={() => window.open(`/pedidos/imprimir?tipo=sticker&refs=${selList.map((o) => o.ref).join(",")}`, "_blank")}>🏷️ Stickers 4×4</button>
          <button className="ghost" onClick={bulkCopy}>📋 WhatsApp</button>
          <button className="ghost" onClick={() => setSel(new Set())}>✕</button>
        </div>
      )}

      {/* Lista */}
      {filtrados.length ? (
        <>
          <div className="pb-headrow">
            <span><input type="checkbox" className="pb-check" checked={sel.size === filtrados.length && filtrados.length > 0} onChange={toggleAll} /></span>
            <span>Canal</span><span>Cliente</span><span>Estado</span><span>Hora</span><span style={{ textAlign: "right" }}>Total</span><span />
          </div>
          <div className="pb-list">
            {filtrados.map((o) => {
              const c = chan(o.canal); const e = est(o.estado); const falta = faltantes(o).length;
              return (
                <div key={o.id} className={"pb-row" + (sel.has(o.id) ? " sel" : "")} onClick={() => router.push(`/pedidos/${o.id}`)}>
                  <span onClick={(ev) => ev.stopPropagation()}><input type="checkbox" className="pb-check" checked={sel.has(o.id)} onChange={() => toggle(o.id)} /></span>
                  <span className="pb-chan"><span className="dot" style={{ background: c.color }}>{c.ic}</span>{c.label}</span>
                  <span className="pb-cli">
                    <div className="nm">
                      <span className="nmt">{o.nombre || "— sin nombre —"}</span>
                      {falta ? <span title={`Faltan: ${faltantes(o).join(", ")}`} style={{ color: "#F79009", flex: "0 0 auto" }}>⚠</span> : null}
                      {o.copiadoAt ? <span className="pb-tag ok" title={`Copiado a WhatsApp ${horaCO(o.copiadoAt)}`}>✓ copiado</span> : null}
                      {o.despachadoAt ? <span className="pb-tag ship">🚚 despachado</span> : null}
                    </div>
                    <div className="meta">{o.ref} · {o.telefono || "sin tel"} · {o.ciudad || "sin ciudad"}{o.envioGuia ? <span style={{ color: "#1E50E6", fontWeight: 700 }}> · guía {o.envioGuia}</span> : null}</div>
                  </span>
                  <span><span className="pb-pill" style={{ color: e.color, background: e.bg }}>{e.label}</span></span>
                  <span className="pb-time">{o.createdAt ? horaCO(o.createdAt) : "—"}<div className="d">{o.createdAt ? soloFechaCO(o.createdAt, { day: "2-digit", month: "2-digit" }) : ""}</div></span>
                  <span className="pb-total">{COP(o.total)}<div className="e">flete aparte{o.envio ? ` ~${COP(o.envio)}` : ""}</div></span>
                  <span className="pb-chev" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <button className="pb-copybtn" onClick={async (ev) => { ev.stopPropagation(); const ok = await copy(mensajeGuia(o)); if (ok) await marcarCopiado([o.id]); flash(ok ? "📋 Copiado a WhatsApp" : "No se pudo copiar"); }} title="Copiar datos para WhatsApp" aria-label="Copiar datos para WhatsApp"><Copy size={15} aria-hidden /></button>
                    ›
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="empty"><div className="ico">🧾</div><h4>Sin pedidos · {rangoLabel}{canal !== "todos" ? ` por ${chan(canal).label}` : ""}</h4><p>Cuando entren pedidos por el bot o la web, aparecen aquí.</p></div>
      )}

      {toast && <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "#101828", color: "#fff", padding: "11px 20px", borderRadius: 12, fontWeight: 700, fontSize: 13.5, zIndex: 80, boxShadow: "var(--shadow)" }}>{toast}</div>}

      {open && <DetailModal o={open} onClose={() => setOpenId(null)} onToast={flash} onGuia={(id) => { setOpenId(null); setGuiaFor(id); }} />}
      {manualOpen && <ManualOrderModal catalog={catalog} onClose={() => setManualOpen(false)} onToast={flash} />}
      {guiaFor && <GuiaModal order={orders.find((o) => o.id === guiaFor)!} onClose={() => setGuiaFor(null)} onToast={flash} />}
    </div>
  );
}

/* ---- Crear pedido manual (asesor humano) ---- */
/* ---- Generar guía: cotiza MiPaquete y elige transportadora ---- */
function GuiaModal({ order, onClose, onToast }: { order: BoardOrder; onClose: () => void; onToast: (m: string) => void }) {
  const [loading, setLoading] = React.useState(true);
  const [transp, setTransp] = React.useState<Transportadora[]>([]);
  const [sel, setSel] = React.useState("");
  const [source, setSource] = React.useState("");
  const [sinDane, setSinDane] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [genErr, setGenErr] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const r = await cotizarPedido(order.id);
      if (!alive) return;
      setLoading(false);
      if (!r.ok) { setErr(r.error || "Error al cotizar"); return; }
      setSource(r.source || ""); setSinDane(!!r.sinDane);
      const list = r.transportadoras || [];
      setTransp(list); if (list[0]) setSel(list[0].id);
    })();
    return () => { alive = false; };
  }, [order.id]);

  async function generar() {
    const chosen = sel || transp[0]?.id || "";
    setGenErr(""); setBusy(true);
    try {
      const r = await crearGuia(order.id, false, chosen);
      if (r.ok) {
        if (r.pdfUrl) { try { window.open(r.pdfUrl, "_blank"); } catch { /* */ } }
        onToast(r.pending ? "Guía en pendiente 📦" : `Guía ${r.guideNumber || "generada"} ✅`);
        onClose();
      } else { setGenErr(r.error || "MiPaquete rechazó la guía."); }
    } catch (e) {
      setGenErr("No se pudo conectar con MiPaquete. Intenta de nuevo. (" + String(e).slice(0, 80) + ")");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-ov" onClick={onClose}>
      <div className="pb-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="pb-mhead" style={{ background: "linear-gradient(135deg,#2f6bff,#1e50e6)" }}>
          <button className="close" onClick={onClose}>×</button>
          <div className="ref" style={{ fontSize: 18 }}>🚚 Generar guía · {order.ref}</div>
          <div className="tags"><span className="tag">{order.nombre || "—"} · {order.ciudad || "—"}</span></div>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-2)" }}>¿Con qué transportadora?</div>
          {loading ? <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Cotizando con MiPaquete…</div>
            : err ? <div style={{ color: "#b3261e", fontSize: 13 }}>{err}</div>
              : (
                <>
                  {sinDane ? <div style={{ background: "#FFF4E5", border: "1px solid #F79009", color: "#B54708", borderRadius: 10, padding: "8px 12px", fontSize: 12 }}>No tengo el DANE de “{order.ciudad}” — la guía sale con costo estimado local.</div> : null}
                  {source === "local" && !sinDane ? <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Costos estimados (sin conexión MiPaquete).</div> : null}
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {transp.map((t, i) => (
                      <label key={t.id + i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${sel === t.id ? "#2f6bff" : "var(--line-2)"}`, background: sel === t.id ? "#e8f0ff" : "#fff", cursor: "pointer" }}>
                        <input type="radio" name="transp" checked={sel === t.id} onChange={() => setSel(t.id)} style={{ accentColor: "#2f6bff" }} />
                        <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{t.company || "Transportadora"}{i === 0 ? <span style={{ fontSize: 10.5, color: "#067647", marginLeft: 6 }}>más barato</span> : null}</span>
                        <span style={{ textAlign: "right" }}><b style={{ fontSize: 15 }}>{COP(t.total)}</b>{t.comision ? <div style={{ fontSize: 10.5, color: "var(--muted)" }}>flete {COP(t.flete)} + recaudo {COP(t.comision)}</div> : <div style={{ fontSize: 10.5, color: "var(--muted)" }}>flete</div>}</span>
                      </label>
                    ))}
                  </div>
                  {genErr ? <div style={{ background: "#FEECEB", border: "1px solid #F04438", color: "#B42318", borderRadius: 11, padding: "11px 14px", fontSize: 12.5, fontWeight: 600, lineHeight: 1.45 }}>⚠️ {genErr}</div> : null}
                  <button style={{ padding: 15, borderRadius: 13, border: "none", background: (busy || !transp.length) ? "#A9C6FF" : "linear-gradient(180deg,#3B82F6,#1E50E6)", color: "#fff", fontWeight: 800, fontSize: 15.5, cursor: (busy || !transp.length) ? "default" : "pointer", boxShadow: "0 10px 20px -6px rgba(47,107,255,.55)" }} disabled={busy || !transp.length} onClick={generar}>{busy ? "Generando guía…" : "🚚 Generar guía con " + (transp.find((t) => t.id === (sel || transp[0]?.id))?.company || "transportadora")}</button>
                </>
              )}
        </div>
      </div>
    </div>
  );
}

function ManualOrderModal({ catalog, onClose, onToast }: { catalog: CatProd[]; onClose: () => void; onToast: (m: string) => void }) {
  const [f, setF] = React.useState({ nombre: "", cedula: "", telefono: "", ciudad: "", departamento: "", direccion: "", slug: "", presentacion: "", cantidad: "1", subId: "" });
  const [pq, setPq] = React.useState("");
  const [showList, setShowList] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [errs, setErrs] = React.useState<string[]>([]);
  const [dup, setDup] = React.useState<{ ref: string } | null>(null);

  const prod = catalog.find((p) => p.slug === f.slug);
  const opts = catalog.filter((p) => p.name.toLowerCase().includes(pq.toLowerCase())).slice(0, 8);
  const up = (k: string, v: string) => { setF((s) => ({ ...s, [k]: v })); setErrs((e) => e.filter((x) => x !== k)); };
  const fld = (k: string): React.CSSProperties => ({ borderColor: errs.includes(k) ? "#F04438" : undefined, boxShadow: errs.includes(k) ? "0 0 0 3px #FEECEB" : undefined });

  async function guardar(force: boolean) {
    setBusy(true);
    try {
      const r = await crearPedidoManual({
        nombre: f.nombre, cedula: f.cedula, telefono: f.telefono, ciudad: f.ciudad, departamento: f.departamento,
        direccion: f.direccion, slug: f.slug, presentacion: f.presentacion, cantidad: parseInt(f.cantidad) || 1, subId: f.subId,
      }, force);
      if (r.ok) { onToast(`✅ Pedido ${r.ref} creado${r.duplicate ? " (reusado)" : ""}`); onClose(); return; }
      if (r.duplicate && r.ref) { setDup({ ref: r.ref }); return; }
      if (r.campos) { setErrs(r.campos); onToast("Completa los campos en rojo"); return; }
      onToast(r.error || "Error");
    } catch {
      onToast("❌ No se pudo crear (revisa la conexión e intenta de nuevo)");
    } finally {
      setBusy(false); // nunca se queda cargando
    }
  }

  return (
    <div className="pb-ov" onClick={onClose}>
      <div className="pb-modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="pb-mhead" style={{ background: "linear-gradient(135deg,#F79009,#B54708)" }}>
          <button className="close" onClick={onClose}>×</button>
          <div className="ref" style={{ fontSize: 19 }}>➕ Crear pedido manual</div>
          <div className="tags"><span className="tag">✍️ Asesor · lo sube un humano</span></div>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input className="crm-input" style={fld("nombre")} placeholder="Nombre completo *" value={f.nombre} onChange={(e) => up("nombre", e.target.value)} />
            <input className="crm-input" style={fld("cedula")} placeholder="Cédula *" value={f.cedula} onChange={(e) => up("cedula", e.target.value)} />
            <input className="crm-input" style={fld("telefono")} placeholder="Celular *" value={f.telefono} onChange={(e) => up("telefono", e.target.value)} />
            <input className="crm-input" placeholder="Departamento" value={f.departamento} onChange={(e) => up("departamento", e.target.value)} />
            <input className="crm-input" style={fld("ciudad")} placeholder="Ciudad *" value={f.ciudad} onChange={(e) => up("ciudad", e.target.value)} />
            <input className="crm-input" style={{ ...fld("direccion") }} placeholder="Dirección / oficina *" value={f.direccion} onChange={(e) => up("direccion", e.target.value)} />
          </div>

          {/* Producto (buscador del catálogo real) */}
          <div style={{ position: "relative" }}>
            <input className="crm-input" style={fld("slug")} placeholder="Producto * (busca en el catálogo)" value={f.slug ? (prod?.name || "") : pq}
              onFocus={() => setShowList(true)}
              onChange={(e) => { setPq(e.target.value); up("slug", ""); setShowList(true); }} />
            {showList && !f.slug && pq && opts.length ? (
              <div className="pp-drop" style={{ position: "absolute", left: 0, right: 0, zIndex: 3 }}>
                {opts.map((p) => <div key={p.slug} className="pp-opt" onClick={() => { up("slug", p.slug); setF((s) => ({ ...s, presentacion: p.presentaciones[0]?.label || "" })); setShowList(false); setPq(""); }}>{p.name}</div>)}
              </div>
            ) : null}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <select className="crm-input" value={f.presentacion} onChange={(e) => up("presentacion", e.target.value)} disabled={!prod}>
              {prod ? prod.presentaciones.map((x) => <option key={x.label} value={x.label}>{x.label} — {COP(x.precio)}</option>) : <option>Elige un producto</option>}
            </select>
            <input className="crm-input" type="number" min={1} placeholder="Cantidad" value={f.cantidad} onChange={(e) => up("cantidad", e.target.value)} />
          </div>
          <input className="crm-input" placeholder="(opcional) sub_id / WhatsApp del cliente — para enlazar su conversación" value={f.subId} onChange={(e) => up("subId", e.target.value)} />

          {dup ? (
            <div style={{ background: "#FFF4E5", border: "1px solid #F79009", borderRadius: 12, padding: 12, fontSize: 13 }}>
              ⚠️ Ya existe un pedido similar <b>{dup.ref}</b> creado hace poco. ¿Crear de todas formas?
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="pb-btn gp" style={{ padding: "8px 14px" }} disabled={busy} onClick={() => guardar(true)}>Sí, crear igual</button>
                <button className="pb-btn out" style={{ padding: "8px 14px" }} onClick={() => setDup(null)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button className="pb-btn gp" disabled={busy} onClick={() => guardar(false)}>{busy ? "Creando…" : "Crear pedido"}</button>
          )}
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Se crea con flete por valor ($20.000 + 7%), ref AD-XXXX, y dispara el evento de compra a Meta. Aparece marcado como <b>✍️ Asesor</b>.</div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ ic, num, lbl, sub, color }: { ic: string; num: string; lbl: string; sub?: string; color: string }) {
  return (
    <div className="pb-kpi" style={{ ["--accent" as string]: color } as React.CSSProperties}>
      <div className="ic">{ic}</div>
      <div className="num">{num}</div>
      <div className="lbl">{lbl}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

function DetailModal({ o, onClose, onToast, onGuia }: { o: BoardOrder; onClose: () => void; onToast: (m: string) => void; onGuia: (id: string) => void }) {
  const [busy, setBusy] = React.useState(false);
  const [showMsg, setShowMsg] = React.useState(false);
  const [guia, setGuia] = React.useState(o.guia || "");
  const e = est(o.estado); const c = chan(o.canal);
  const falta = faltantes(o); const completo = falta.length === 0;

  async function move(estado: string) { setBusy(true); await updateOrderStatus(o.id, estado); setBusy(false); onToast(`Pedido → ${est(estado).label}`); onClose(); }
  async function ordenVenta() { setBusy(true); await pasarAOrdenDeVenta(o.id); setBusy(false); onToast("→ Orden de venta ✅"); onClose(); }
  const guiaMp = () => onGuia(o.id);
  async function copiar() { onToast((await copy(mensajeGuia(o))) ? "📋 Datos copiados" : "No se pudo copiar"); }
  async function descargarGuiaMp() {
    setBusy(true);
    try { const r = await obtenerPdfGuia(o.id); if (r.ok && r.pdfUrl) window.open(r.pdfUrl, "_blank"); else onToast(r.error || "Guía no lista"); }
    catch { onToast("No se pudo conectar con MiPaquete"); }
    finally { setBusy(false); }
  }
  async function cancelarGuiaMp() {
    if (!confirm("¿Cancelar esta guía?\n\nMiPaquete no permite cancelar por API: esto la cancela aquí y podrás regenerarla, pero cancélala TAMBIÉN en el portal de MiPaquete para que no la despachen.")) return;
    setBusy(true);
    try { const r = await cancelarGuia(o.id); if (r.ok) { if (r.avisoMp && r.portalUrl) { if (confirm(`Guía cancelada en la plataforma.\n\nMiPaquete no cancela por API — abre su portal y cancela la guía N.º ${r.guideNumber} allá.\n\n¿Abrir MiPaquete ahora?`)) window.open(r.portalUrl, "_blank"); } onToast("Guía cancelada ✅"); onClose(); } else onToast(r.error || "No se pudo cancelar"); }
    catch { onToast("No se pudo cancelar"); }
    finally { setBusy(false); }
  }
  async function despachar() {
    if (!guia.trim()) { setShowMsg(true); return; }
    setBusy(true); const r = await despacharPedido(o.id, guia.trim(), o.transportadora || "Interrapidísimo"); setBusy(false);
    onToast(r.ok ? (r.notify?.ok ? "Despachado · cliente avisado ✅" : "Despachado ✅") : (r.error || "Error")); onClose();
  }

  const ck = (label: string, val: string, ok: boolean) => (
    <div className={"pb-ck " + (ok ? "ok" : "no")}><span className="b">{ok ? "✓" : "!"}</span><span className="v"><b>{label}:</b> {val || "falta"}</span></div>
  );

  return (
    <div className="pb-ov" onClick={onClose}>
      <div className="pb-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="pb-mhead" style={{ background: `linear-gradient(135deg, ${e.color}, ${e.color}cc)` }}>
          <button className="close" onClick={onClose}>×</button>
          <div className="ref">{o.ref}</div>
          <div className="tags">
            <span className="tag">{c.ic} {c.label}</span>
            <span className="tag" style={{ background: "rgba(255,255,255,.32)" }}>{e.label}</span>
            <span className="tag">{o.createdAt ? fechaCO(o.createdAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span>
          </div>
        </div>

        <div className="pb-mbody">
          {/* Revisión de datos */}
          <div className="pb-checklist" style={{ borderColor: completo ? "var(--green)" : "var(--amber)" }}>
            <div className="h" style={{ color: completo ? "var(--green)" : "var(--amber)" }}>{completo ? "✅ Datos completos — listo para remisión" : `⚠️ Faltan datos: ${falta.join(", ")}`}</div>
            <div className="grid">
              {ck("Nombre", o.nombre, !!o.nombre?.trim())}
              {ck("Teléfono", o.telefono, !!o.telefono?.trim())}
              {ck("Cédula", o.cedula, !!o.cedula?.trim())}
              {ck("Ciudad", o.ciudad, !!o.ciudad?.trim())}
              {ck("Dirección", o.direccion, !!o.direccion?.trim())}
              {ck("Productos", `${o.items.length}`, o.items.length > 0)}
            </div>
          </div>

          {/* Datos de entrega */}
          <div className="pb-sec">
            <div className="st">📍 Entrega</div>
            <div className="pb-kv"><span className="k">Ciudad</span><span className="val">{o.ciudad || "—"}</span></div>
            <div className="pb-kv"><span className="k">Dirección</span><span className="val">{o.direccion || "—"}</span></div>
            <div className="pb-kv"><span className="k">Teléfono</span><span className="val">{o.telefono || "—"}</span></div>
            <div className="pb-kv"><span className="k">Cédula</span><span className="val">{o.cedula || "—"}</span></div>
          </div>

          {/* Productos */}
          <div className="pb-sec">
            <div className="st">🛒 Productos</div>
            {o.items.length ? o.items.map((i, k) => (
              <div className="pb-prod" key={k}><span><b>{i.cantidad}×</b> {i.name}</span></div>
            )) : <div className="pb-kv"><span className="k">Sin productos</span></div>}
            <div className="pb-tot"><span>Envío</span><span>{o.envio ? COP(o.envio) : "Incluido"}</span></div>
            <div className="pb-tot big"><span>Total contra entrega</span><span>{COP(o.total)}</span></div>
          </div>
        </div>

        {/* Mensaje para copiar (guía) */}
        {(o.estado === "guia" || o.estado === "despachado" || showMsg) && (
          <div className="pb-msg">{mensajeGuia(o)}</div>
        )}

        {/* Estado de guía / factura */}
        {(o.envioGuia || o.envioStatus || o.facturaNumero) && (
          <div style={{ margin: "0 24px", fontSize: 12, color: "var(--ink-2)", display: "flex", gap: 12, flexWrap: "wrap" }}>
            {o.facturaNumero ? <span>🧾 Factura #{o.facturaNumero}</span> : null}
            {o.envioGuia ? <span>🚚 Guía {o.envioGuia}</span> : o.envioStatus === "pendiente" ? <span style={{ color: "var(--amber)" }}>📦 Guía pendiente (falta token MiPaquete)</span> : null}
          </div>
        )}

        {/* Impresión (siempre) */}
        <div className="pb-mfoot" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 12, flexWrap: "wrap" }}>
          <button className="pb-btn dk" style={{ flex: 1 }} onClick={() => abrirImpresion("factura", [o.ref])}>🖨️ Imprimir factura</button>
          {(o.envioGuia || o.envioStatus === "guia_generada") ? <button className="pb-btn gp" style={{ flex: 1 }} disabled={busy} onClick={descargarGuiaMp}>📥 Descargar guía MiPaquete</button> : null}
          <button className="pb-btn dk" style={{ flex: 1 }} onClick={() => abrirImpresion("guia", [o.ref])}>🖨️ Guía (interno)</button>
          {(o.envioGuia || o.envioStatus === "guia_generada") ? <button className="pb-btn out" style={{ flex: 1 }} disabled={busy} onClick={cancelarGuiaMp}>❌ Cancelar guía</button> : null}
        </div>

        {/* Copiar datos para WhatsApp — SIEMPRE disponible (acción principal) */}
        <div className="pb-mfoot">
          <button className="pb-btn gp" style={{ flex: 1, fontSize: 15 }} onClick={copiar}>📋 Copiar datos para WhatsApp</button>
        </div>

        {/* Acciones según estado */}
        <div className="pb-mfoot">
          {o.estado === "remision" && (
            <button className="pb-btn gp" disabled={busy || !completo} onClick={ordenVenta} title={completo ? "" : "Completa los datos primero"}>{completo ? "✓ Pasar a orden de venta" : "Completa los datos primero"}</button>
          )}
          {o.estado === "aprobado" && (
            <button className="pb-btn bl" disabled={busy} onClick={guiaMp}>🚚 Crear guía MiPaquete</button>
          )}
          {(o.estado === "guia" || o.estado === "despachado") && (
            <>
              <button className="pb-btn dk" onClick={copiar}>📋 Copiar WhatsApp</button>
              {!o.envioGuia && o.estado === "guia" ? <button className="pb-btn bl" disabled={busy} onClick={guiaMp}>🚚 Generar guía</button> : null}
              {o.estado === "guia" && (
                <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 200 }}>
                  <input className="pb-search" style={{ margin: 0, minWidth: 0, flex: 1 }} placeholder="N.º guía (opcional)" value={guia} onChange={(ev) => setGuia(ev.target.value)} />
                  <button className="pb-btn gp" style={{ flex: "0 0 auto", minWidth: 0, padding: "12px 16px" }} disabled={busy} onClick={despachar}>🚚 Despachar</button>
                </div>
              )}
            </>
          )}
          {o.estado === "entregado" && <div style={{ flex: 1, textAlign: "center", color: "var(--green)", fontWeight: 800, padding: 8 }}>✅ Entregado</div>}
          {o.estado !== "cancelado" && o.estado !== "entregado" && (
            <button className="pb-btn out" disabled={busy} onClick={() => { if (confirm("¿Cancelar este pedido?")) move("cancelado"); }}>Cancelar</button>
          )}
        </div>
      </div>
    </div>
  );
}
