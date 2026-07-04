"use client";

import * as React from "react";
import { updateOrderStatus, despacharPedido, type DespachoResult } from "../actions";

export type BoardOrder = {
  id: string; ref: string; nombre: string; telefono: string; cedula: string; ciudad: string; direccion: string;
  estado: string; canal: string; total: number; envio: number; metodoPago: string;
  items: { cantidad: number; name: string }[];
  createdAt: string | null; advisor: string;
  guia: string; transportadora: string; despachadoAt: string | null; clienteNotificado: boolean;
  shopifyOrderName: string;
};

const COP = (n: number) => "$" + Number(n || 0).toLocaleString("es-CO");

/* --- canal --- */
const CANALES: Record<string, { label: string; emoji: string; color: string }> = {
  whatsapp: { label: "WhatsApp", emoji: "🟢", color: "#25D366" },
  messenger: { label: "Messenger", emoji: "🔵", color: "#0084FF" },
  web: { label: "Página web", emoji: "🌐", color: "#7A3CFF" },
};
const canalInfo = (c: string) => CANALES[c] || { label: c || "—", emoji: "•", color: "#888" };

/* --- flujo de estados --- */
const FLUJO = ["remision", "aprobado", "guia", "despachado", "entregado"];
const ESTADO_META: Record<string, { label: string; color: string; bg: string }> = {
  remision: { label: "Remisión", color: "#8a6d00", bg: "#fff4d6" },
  aprobado: { label: "Aprobado", color: "#0a5", bg: "#d9f7e6" },
  guia: { label: "Guía", color: "#2f6bff", bg: "#dde8ff" },
  despachado: { label: "Despachado", color: "#7A3CFF", bg: "#ece0ff" },
  entregado: { label: "Entregado", color: "#0a7d33", bg: "#d6f5df" },
  cancelado: { label: "Cancelado", color: "#b3261e", bg: "#ffe0dd" },
};
const estadoMeta = (e: string) => ESTADO_META[e] || { label: e, color: "#555", bg: "#eee" };

/* --- mensaje para copiar/pegar en el grupo de WhatsApp --- */
function mensajeGuia(o: BoardOrder): string {
  const prod = o.items.map((i) => `${i.cantidad}× ${i.name}`).join(", ");
  return [
    `📦 *PEDIDO ${o.ref}* (contra entrega)`,
    `👤 ${o.nombre}`,
    `🪪 CC ${o.cedula || "—"}`,
    `📱 ${o.telefono}`,
    `📍 ${o.ciudad} — ${o.direccion}`,
    `🛒 ${prod}`,
    `💵 Total a recaudar: ${COP(o.total)}  (envío ${o.envio ? COP(o.envio) : "incluido"})`,
    `🚚 Transportadora: Interrapidísimo`,
  ].join("\n");
}

function sameDay(iso: string | null, ref: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

export function PedidosBoard({ orders }: { orders: BoardOrder[] }) {
  const [dia, setDia] = React.useState<"hoy" | "ayer" | "todos">("hoy");
  const [canal, setCanal] = React.useState<"todos" | "whatsapp" | "messenger" | "web">("todos");
  const [copiado, setCopiado] = React.useState<string>("");

  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);

  const filtrados = orders.filter((o) => {
    const okDia = dia === "todos" || (dia === "hoy" ? sameDay(o.createdAt, hoy) : sameDay(o.createdAt, ayer));
    const okCanal = canal === "todos" || o.canal === canal;
    return okDia && okCanal;
  });

  // KPIs sobre el filtro de día
  const delDia = orders.filter((o) => dia === "todos" || (dia === "hoy" ? sameDay(o.createdAt, hoy) : sameDay(o.createdAt, ayer)));
  const kpiCanal = (c: string) => delDia.filter((o) => o.canal === c).length;
  const kpiEstado = (e: string) => delDia.filter((o) => o.estado === e).length;
  const recaudo = filtrados.reduce((s, o) => s + o.total, 0);

  async function copiar(o: BoardOrder) {
    try { await navigator.clipboard.writeText(mensajeGuia(o)); setCopiado(o.id); setTimeout(() => setCopiado(""), 2000); }
    catch { setCopiado("err-" + o.id); setTimeout(() => setCopiado(""), 2000); }
  }

  return (
    <div>
      {/* ---- Filtros ---- */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div className="seg" style={{ display: "inline-flex", gap: 4, background: "#f1f1f4", padding: 4, borderRadius: 12 }}>
          {(["hoy", "ayer", "todos"] as const).map((d) => (
            <button key={d} onClick={() => setDia(d)} className={dia === d ? "on" : ""}
              style={{ padding: "7px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: dia === d ? "#fff" : "transparent", boxShadow: dia === d ? "0 1px 4px rgba(0,0,0,.1)" : "none", textTransform: "capitalize" }}>
              {d === "hoy" ? "Hoy" : d === "ayer" ? "Ayer" : "Todos"}
            </button>
          ))}
        </div>
        <div style={{ display: "inline-flex", gap: 6 }}>
          {(["todos", "whatsapp", "messenger", "web"] as const).map((c) => {
            const info = c === "todos" ? { label: "Todos los canales", emoji: "📋", color: "#555" } : canalInfo(c);
            const active = canal === c;
            return (
              <button key={c} onClick={() => setCanal(c)}
                style={{ padding: "7px 12px", borderRadius: 20, border: `1.5px solid ${active ? info.color : "#e2e2e6"}`, cursor: "pointer", fontWeight: 700, fontSize: 12.5, background: active ? info.color + "18" : "#fff", color: active ? info.color : "#555" }}>
                {info.emoji} {c === "todos" ? "Todos" : info.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- KPIs ---- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        <Kpi label={dia === "hoy" ? "Pedidos hoy" : dia === "ayer" ? "Pedidos ayer" : "Pedidos"} value={String(delDia.length)} sub={`Recaudo filtrado: ${COP(recaudo)}`} accent="#111" />
        <Kpi label="🟢 WhatsApp" value={String(kpiCanal("whatsapp"))} accent="#25D366" />
        <Kpi label="🔵 Messenger" value={String(kpiCanal("messenger"))} accent="#0084FF" />
        <Kpi label="🌐 Web" value={String(kpiCanal("web"))} accent="#7A3CFF" />
        <Kpi label="📝 Remisión / 📦 Guía" value={`${kpiEstado("remision")} / ${kpiEstado("guia")}`} sub={`Aprobados: ${kpiEstado("aprobado")}`} accent="#e0a92e" />
      </div>

      {/* ---- Tabla ---- */}
      {filtrados.length ? (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Hora</th><th>Canal</th><th>Ref</th><th>Cliente</th><th>Ciudad</th><th>Productos</th><th>Total</th><th>Estado</th><th>Acción</th></tr>
            </thead>
            <tbody>
              {filtrados.map((o) => {
                const cinfo = canalInfo(o.canal);
                const em = estadoMeta(o.estado);
                return (
                  <tr key={o.id}>
                    <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{o.createdAt ? new Date(o.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "—"}<div className="t-mut" style={{ fontSize: 10 }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" }) : ""}</div></td>
                    <td><span style={{ fontSize: 11.5, fontWeight: 700, color: cinfo.color }}>{cinfo.emoji} {cinfo.label}</span></td>
                    <td><b style={{ fontSize: 12.5 }}>{o.ref}</b>{o.shopifyOrderName ? <div className="t-mut" style={{ fontSize: 10 }}>{o.shopifyOrderName}</div> : null}</td>
                    <td style={{ minWidth: 150 }}>{o.nombre || "—"}<div className="t-mut" style={{ fontSize: 11 }}>{o.telefono}{o.cedula ? ` · CC ${o.cedula}` : ""}</div></td>
                    <td style={{ fontSize: 12 }}>{o.ciudad}<div className="t-mut" style={{ fontSize: 10.5 }}>{o.direccion}</div></td>
                    <td style={{ fontSize: 12, maxWidth: 180 }}>{o.items.map((i) => `${i.cantidad}× ${i.name}`).join(", ") || "—"}</td>
                    <td><b>{COP(o.total)}</b><div className="t-mut" style={{ fontSize: 10.5 }}>envío {o.envio ? COP(o.envio) : "incl."}</div></td>
                    <td><span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, color: em.color, background: em.bg }}>{em.label}</span></td>
                    <td><AccionCell o={o} copiado={copiado} onCopiar={() => copiar(o)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty"><div className="ico">🧾</div><h4>Sin pedidos {dia === "hoy" ? "hoy" : dia === "ayer" ? "ayer" : ""}{canal !== "todos" ? ` por ${canalInfo(canal).label}` : ""}</h4><p>Cuando entren pedidos por el bot o la web, aparecen aquí.</p></div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #ececf0", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
      <div style={{ fontSize: 12, color: "#777", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

function AccionCell({ o, copiado, onCopiar }: { o: BoardOrder; copiado: string; onCopiar: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  async function avanzar(next: string) {
    setBusy(true); await updateOrderStatus(o.id, next); setBusy(false);
  }

  const btn = (bg: string): React.CSSProperties => ({ padding: "6px 11px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, color: "#fff", background: bg, opacity: busy ? 0.6 : 1 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 190 }}>
      {o.estado === "remision" && (
        <button style={btn("#0a9d4a")} disabled={busy} onClick={() => avanzar("aprobado")}>✓ Aprobar</button>
      )}
      {o.estado === "aprobado" && (
        <button style={btn("#2f6bff")} disabled={busy} onClick={() => avanzar("guia")}>📦 Pasar a guía</button>
      )}
      {(o.estado === "guia" || o.estado === "despachado") && (
        <>
          <button style={btn("#111")} onClick={onCopiar}>{copiado === o.id ? "✓ Copiado" : copiado === "err-" + o.id ? "✗ error" : "📋 Copiar datos WhatsApp"}</button>
          {o.estado === "guia" && <DespachoInline o={o} />}
        </>
      )}
      {o.estado === "entregado" && <span className="t-mut" style={{ fontSize: 12 }}>✅ Entregado</span>}
      {o.estado !== "cancelado" && o.estado !== "entregado" && (
        <button style={{ ...btn("#fff"), color: "#b3261e", border: "1px solid #f0c8c4", background: "#fff" }} disabled={busy} onClick={() => { if (confirm("¿Cancelar este pedido?")) avanzar("cancelado"); }}>Cancelar</button>
      )}
      {msg ? <span style={{ fontSize: 11, color: "#0a7d33" }}>{msg}</span> : null}
    </div>
  );
}

/* Despacho rápido: guía + transportadora + avisar al cliente (marca despachado). */
function DespachoInline({ o }: { o: BoardOrder }) {
  const [open, setOpen] = React.useState(false);
  const [guia, setGuia] = React.useState(o.guia || "");
  const [transp, setTransp] = React.useState(o.transportadora || "Interrapidísimo");
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState<DespachoResult | null>(null);
  if (!open) return <button style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 11.5, fontWeight: 600 }} onClick={() => setOpen(true)}>🚚 Despachar + avisar</button>;
  return (
    <div style={{ display: "grid", gap: 4, background: "#fafafa", padding: 6, borderRadius: 8 }}>
      <input placeholder="N.º guía" value={guia} onChange={(e) => setGuia(e.target.value)} style={{ fontSize: 12, padding: "5px 7px", border: "1px solid #ddd", borderRadius: 6 }} />
      <input placeholder="Transportadora" value={transp} onChange={(e) => setTransp(e.target.value)} style={{ fontSize: 12, padding: "5px 7px", border: "1px solid #ddd", borderRadius: 6 }} />
      <button disabled={busy || !guia.trim()} onClick={async () => { setBusy(true); const r = await despacharPedido(o.id, guia.trim(), transp.trim()); setBusy(false); setRes(r); }}
        style={{ padding: "6px", borderRadius: 7, border: "none", background: "#0a9d4a", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
        {busy ? "Enviando…" : "Marcar despachado y avisar"}
      </button>
      {res ? <span style={{ fontSize: 10.5, color: res.ok ? "#0a7d33" : "#b3261e" }}>{res.ok ? (res.notify?.ok ? "Despachado · cliente avisado ✅" : "Despachado ✅ (aviso pendiente)") : res.error}</span> : null}
    </div>
  );
}
