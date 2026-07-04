"use client";

import * as React from "react";
import { updateOrderStatus, bulkUpdateStatus, despacharPedido } from "../actions";

export type BoardOrder = {
  id: string; ref: string; nombre: string; telefono: string; cedula: string; ciudad: string; direccion: string;
  estado: string; canal: string; total: number; envio: number; metodoPago: string;
  items: { cantidad: number; name: string }[];
  createdAt: string | null; advisor: string;
  guia: string; transportadora: string; despachadoAt: string | null; clienteNotificado: boolean;
  shopifyOrderName: string;
};

const COP = (n: number) => "$" + Number(n || 0).toLocaleString("es-CO");

const CHAN: Record<string, { label: string; color: string; ic: string }> = {
  whatsapp: { label: "WhatsApp", color: "#16C784", ic: "📱" },
  messenger: { label: "Messenger", color: "#0084FF", ic: "💬" },
  web: { label: "Página web", color: "#7A3CFF", ic: "🌐" },
};
const chan = (c: string) => CHAN[c] || { label: c || "—", color: "#8A93A5", ic: "•" };

const EST: Record<string, { label: string; color: string; bg: string }> = {
  remision: { label: "Remisión", color: "#B54708", bg: "#FFF4E5" },
  aprobado: { label: "Aprobado", color: "#067647", bg: "#E6F9F1" },
  guia: { label: "En guía", color: "#1E50E6", bg: "#EAF0FF" },
  despachado: { label: "Despachado", color: "#6941C6", bg: "#F4EBFF" },
  entregado: { label: "Entregado", color: "#067647", bg: "#E6F9F1" },
  cancelado: { label: "Cancelado", color: "#B42318", bg: "#FEECEB" },
};
const est = (e: string) => EST[e] || { label: e || "—", color: "#475467", bg: "#F2F4F7" };

/* mensaje para pegar en el grupo de WhatsApp */
function mensajeGuia(o: BoardOrder): string {
  const prod = o.items.map((i) => `${i.cantidad}× ${i.name}`).join(", ");
  return [
    `📦 *PEDIDO ${o.ref}* (contra entrega)`,
    `👤 ${o.nombre}`,
    `🪪 CC ${o.cedula || "—"}`,
    `📱 ${o.telefono}`,
    `📍 ${o.ciudad} — ${o.direccion}`,
    `🛒 ${prod}`,
    `💵 Total a recaudar: ${COP(o.total)} (envío ${o.envio ? COP(o.envio) : "incluido"})`,
    `🚚 Interrapidísimo`,
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

function sameDay(iso: string | null, ref: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}
async function copy(text: string) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }

export function PedidosBoard({ orders }: { orders: BoardOrder[] }) {
  const [dia, setDia] = React.useState<"hoy" | "ayer" | "todos">("hoy");
  const [canal, setCanal] = React.useState<"todos" | "whatsapp" | "messenger" | "web">("todos");
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [toast, setToast] = React.useState("");

  const hoy = new Date(); const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  const inDia = (o: BoardOrder) => dia === "todos" || sameDay(o.createdAt, dia === "hoy" ? hoy : ayer);

  const delDia = orders.filter(inDia);
  const filtrados = delDia.filter((o) => {
    if (canal !== "todos" && o.canal !== canal) return false;
    if (q.trim()) { const s = q.toLowerCase(); return [o.nombre, o.ref, o.telefono, o.ciudad, o.cedula].some((v) => (v || "").toLowerCase().includes(s)); }
    return true;
  });

  const kCanal = (c: string) => delDia.filter((o) => o.canal === c).length;
  const kEst = (e: string) => delDia.filter((o) => o.estado === e).length;
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
    flash((await copy(txt)) ? `📋 ${selList.length} guía(s) copiada(s)` : "No se pudo copiar");
  }

  return (
    <div>
      {/* KPIs */}
      <div className="pb-kpis">
        <Kpi ic="🧾" num={String(delDia.length)} lbl={dia === "hoy" ? "Pedidos hoy" : dia === "ayer" ? "Pedidos ayer" : "Pedidos totales"} sub={`Recaudo: ${COP(recaudo)}`} color="#101828" />
        <Kpi ic="📱" num={String(kCanal("whatsapp"))} lbl="WhatsApp" color="#16C784" />
        <Kpi ic="💬" num={String(kCanal("messenger"))} lbl="Messenger" color="#0084FF" />
        <Kpi ic="🌐" num={String(kCanal("web"))} lbl="Página web" color="#7A3CFF" />
        <Kpi ic="📦" num={`${kEst("remision")}·${kEst("guia")}`} lbl="Remisión · En guía" sub={`Aprobados: ${kEst("aprobado")}`} color="#F79009" />
      </div>

      {/* Toolbar */}
      <div className="pb-toolbar">
        <div className="pb-seg">
          {(["hoy", "ayer", "todos"] as const).map((d) => (
            <button key={d} className={dia === d ? "on" : ""} onClick={() => { setDia(d); setSel(new Set()); }}>{d === "hoy" ? "Hoy" : d === "ayer" ? "Ayer" : "Todos"}</button>
          ))}
        </div>
        <div className="pb-chips">
          {(["todos", "whatsapp", "messenger", "web"] as const).map((c) => {
            const info = c === "todos" ? { label: "Todos", color: "#475467", ic: "📋" } : chan(c);
            const on = canal === c;
            return <button key={c} className={"pb-chip" + (on ? " on" : "")} style={on ? { background: info.color } : { color: info.color }} onClick={() => setCanal(c)}>{info.ic} {info.label}</button>;
          })}
        </div>
        <input className="pb-search" placeholder="🔍 Buscar por nombre, ref, teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* Barra de acciones masivas */}
      {sel.size > 0 && (
        <div className="pb-bulk">
          <span className="cnt">{sel.size} seleccionado{sel.size > 1 ? "s" : ""}</span>
          <span className="sp" />
          <button className="ghost" disabled={bulkBusy} onClick={() => bulk("aprobado")}>✓ Aprobar</button>
          <button style={{ background: "var(--blue)" }} disabled={bulkBusy} onClick={() => bulk("guia")}>📦 Generar guías (pasar a guía)</button>
          <button className="ghost" onClick={bulkCopy}>📋 Copiar guías</button>
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
                <div key={o.id} className={"pb-row" + (sel.has(o.id) ? " sel" : "")} onClick={() => setOpenId(o.id)}>
                  <span onClick={(ev) => ev.stopPropagation()}><input type="checkbox" className="pb-check" checked={sel.has(o.id)} onChange={() => toggle(o.id)} /></span>
                  <span className="pb-chan"><span className="dot" style={{ background: c.color }}>{c.ic}</span>{c.label}</span>
                  <span className="pb-cli">
                    <div className="nm">{o.nombre || "— sin nombre —"} {falta ? <span title={`Faltan: ${faltantes(o).join(", ")}`} style={{ color: "#F79009" }}>⚠</span> : null}</div>
                    <div className="meta">{o.ref} · {o.telefono || "sin tel"} · {o.ciudad || "sin ciudad"}</div>
                  </span>
                  <span><span className="pb-pill" style={{ color: e.color, background: e.bg }}>{e.label}</span></span>
                  <span className="pb-time">{o.createdAt ? new Date(o.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "—"}<div className="d">{o.createdAt ? new Date(o.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" }) : ""}</div></span>
                  <span className="pb-total">{COP(o.total)}<div className="e">envío {o.envio ? COP(o.envio) : "incl."}</div></span>
                  <span className="pb-chev">›</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="empty"><div className="ico">🧾</div><h4>Sin pedidos {dia === "hoy" ? "hoy" : dia === "ayer" ? "ayer" : ""}{canal !== "todos" ? ` por ${chan(canal).label}` : ""}</h4><p>Cuando entren pedidos por el bot o la web, aparecen aquí.</p></div>
      )}

      {toast && <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "#101828", color: "#fff", padding: "11px 20px", borderRadius: 12, fontWeight: 700, fontSize: 13.5, zIndex: 80, boxShadow: "var(--shadow)" }}>{toast}</div>}

      {open && <DetailModal o={open} onClose={() => setOpenId(null)} onToast={flash} />}
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

function DetailModal({ o, onClose, onToast }: { o: BoardOrder; onClose: () => void; onToast: (m: string) => void }) {
  const [busy, setBusy] = React.useState(false);
  const [showMsg, setShowMsg] = React.useState(false);
  const [guia, setGuia] = React.useState(o.guia || "");
  const e = est(o.estado); const c = chan(o.canal);
  const falta = faltantes(o); const completo = falta.length === 0;

  async function move(estado: string) { setBusy(true); await updateOrderStatus(o.id, estado); setBusy(false); onToast(`Pedido → ${est(estado).label}`); onClose(); }
  async function copiar() { onToast((await copy(mensajeGuia(o))) ? "📋 Datos copiados" : "No se pudo copiar"); }
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
            <span className="tag">{o.createdAt ? new Date(o.createdAt).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span>
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

        {/* Acciones según estado */}
        <div className="pb-mfoot">
          {o.estado === "remision" && (
            <button className="pb-btn gp" disabled={busy || !completo} onClick={() => move("aprobado")} title={completo ? "" : "Completa los datos primero"}>{completo ? "✓ Aprobar pedido" : "Completa los datos para aprobar"}</button>
          )}
          {o.estado === "aprobado" && (
            <button className="pb-btn bl" disabled={busy} onClick={() => move("guia")}>📦 Pasar a guía</button>
          )}
          {(o.estado === "guia" || o.estado === "despachado") && (
            <>
              <button className="pb-btn dk" onClick={copiar}>📋 Copiar datos WhatsApp</button>
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
