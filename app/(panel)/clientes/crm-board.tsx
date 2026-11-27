"use client";

import * as React from "react";
import { cambiarEtapaCliente, guardarNotasCliente, crearClienteManual, importarClientes, crearCuponSegmento, enviarWhatsAppSegmento, setProductosCliente } from "../actions";
import { soloFechaCO } from "@/lib/fecha";

type Prod = { slug: string; name: string };
export type BoardCustomer = {
  id: string; nombre: string; telefono: string; ciudad: string; canal: string;
  etapa: string; etapaManual: string; notas: string; tags: string[];
  numPedidos: number; totalGastado: number; ultimaCompra: string | null;
  productosComprados: Prod[]; productosInteres: Prod[];
  compradosPedidos: Prod[]; compradosManualSlugs: string[]; interesSlugs: string[];
  interacciones: number; createdAt: string | null; ultimoContacto: string | null;
};

const COP = (n: number) => "$" + Number(n || 0).toLocaleString("es-CO");

const STAGES = [
  { key: "nuevo", label: "Nuevos", em: "🌱", color: "#8A93A5" },
  { key: "pidio_info", label: "Pidió info", em: "💬", color: "#F79009" },
  { key: "interesado", label: "Interesados", em: "👀", color: "#EAB308" },
  { key: "comprador", label: "Compradores", em: "🛍️", color: "#7A3CFF" },
  { key: "recompra", label: "Recompra", em: "🔁", color: "#2F6BFF" },
  { key: "perdido", label: "Perdidos", em: "💤", color: "#F04438" },
];
const stageOf = (k: string) => STAGES.find((s) => s.key === k) || { key: k, label: k, em: "•", color: "#8A93A5" };
const CHAN: Record<string, { label: string; color: string; ic: string }> = {
  whatsapp: { label: "WhatsApp", color: "#16C784", ic: "📱" }, messenger: { label: "Messenger", color: "#0084FF", ic: "💬" },
  web: { label: "Web", color: "#7A3CFF", ic: "🌐" }, manual: { label: "Manual", color: "#8A93A5", ic: "✍️" }, import: { label: "Importado", color: "#8A93A5", ic: "📥" },
};
const chan = (c: string) => CHAN[c] || { label: c || "—", color: "#8A93A5", ic: "•" };
// Por código de punto (Array.from), no por unidad UTF-16: un nombre con emoji
// partía el par sustituto y el servidor y el navegador pintaban distinto.
const initials = (n: string) => {
  const limpio = (n || "").replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  return limpio.split(/\s+/).slice(0, 2).map((w) => Array.from(w)[0] || "").join("").toUpperCase() || "👤";
};
const avColor = (n: string) => { let h = 0; for (const ch of n || "x") h = (h * 31 + ch.charCodeAt(0)) % 360; return `linear-gradient(135deg,hsl(${h} 70% 58%),hsl(${(h + 40) % 360} 70% 48%))`; };
async function copy(t: string) { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } }

export function CrmBoard({ rows, catalog }: { rows: BoardCustomer[]; catalog: Prod[] }) {
  const [stage, setStage] = React.useState<string>("");
  const [canal, setCanal] = React.useState<string>("todos");
  const [prod, setProd] = React.useState<string>("");
  const [q, setQ] = React.useState("");
  const [view, setView] = React.useState<"lista" | "cards">("cards");
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [modal, setModal] = React.useState<"" | "nuevo" | "importar" | "cupon" | "whatsapp">("");
  const [toast, setToast] = React.useState("");
  function flash(m: string) { setToast(m); setTimeout(() => setToast(""), 2600); }

  const nameOf = React.useMemo(() => new Map(catalog.map((p) => [p.slug, p.name])), [catalog]);
  const productOptions = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) for (const p of [...r.productosComprados, ...r.productosInteres]) m.set(p.slug, p.name);
    return [...m.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const count = (k: string) => rows.filter((r) => r.etapa === k).length;
  const filtered = rows.filter((r) => {
    if (stage && r.etapa !== stage) return false;
    if (canal !== "todos" && r.canal !== canal) return false;
    if (prod && ![...r.productosComprados, ...r.productosInteres].some((p) => p.slug === prod)) return false;
    if (q.trim()) { const s = q.toLowerCase(); return [r.nombre, r.telefono, r.ciudad].some((v) => (v || "").toLowerCase().includes(s)); }
    return true;
  });
  const open = rows.find((r) => r.id === openId) || null;
  const selList = filtered.filter((r) => sel.has(r.id));
  function toggle(id: string) { setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleAll() { setSel((p) => (p.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)))); }

  function exportCSV() {
    const head = ["nombre", "telefono", "ciudad", "canal", "etapa", "pedidos", "gastado", "compro", "le_interesa"];
    const body = selList.map((r) => [r.nombre, r.telefono, r.ciudad, r.canal, stageOf(r.etapa).label, r.numPedidos, r.totalGastado, r.productosComprados.map((p) => p.name).join(" / "), r.productosInteres.map((p) => p.name).join(" / ")].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" }));
    a.download = `clientes-${selList.length}.csv`; a.click();
    flash(`📤 ${selList.length} exportado(s)`);
  }

  return (
    <div>
      <div className="crm-funnel">
        {STAGES.map((s) => {
          const n = count(s.key); const on = stage === s.key;
          return (
            <div key={s.key} className={"crm-stage" + (on ? " on" : "")} style={{ ["--accent" as string]: s.color } as React.CSSProperties} onClick={() => { setStage(on ? "" : s.key); setSel(new Set()); }}>
              <div className="em">{s.em}</div><div className="n">{n}</div><div className="l">{s.label}</div>
              <div className="pc">{rows.length ? Math.round((n / rows.length) * 100) : 0}% del total</div>
            </div>
          );
        })}
      </div>

      <div className="pb-toolbar">
        <div className="pb-chips">
          {["todos", "whatsapp", "messenger", "web", "manual"].map((c) => {
            const info = c === "todos" ? { label: "Todos", color: "#475467", ic: "📋" } : chan(c); const on = canal === c;
            return <button key={c} className={"pb-chip" + (on ? " on" : "")} style={on ? { background: info.color } : { color: info.color }} onClick={() => setCanal(c)}>{info.ic} {info.label}</button>;
          })}
        </div>
        <select className="pb-search" style={{ minWidth: 170, cursor: "pointer" }} value={prod} onChange={(e) => setProd(e.target.value)}>
          <option value="">Todos los productos</option>
          {productOptions.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </select>
        <input className="pb-search" placeholder="🔍 Buscar nombre, teléfono, ciudad…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="crm-view">
          <button className={view === "cards" ? "on" : ""} onClick={() => setView("cards")}>▦ Tarjetas</button>
          <button className={view === "lista" ? "on" : ""} onClick={() => setView("lista")}>☰ Lista</button>
        </div>
        <button className="pb-chip" style={{ color: "#0a9d4a", borderColor: "#0a9d4a" }} onClick={() => setModal("nuevo")}>＋ Nuevo</button>
        <button className="pb-chip" style={{ color: "#2f6bff", borderColor: "#2f6bff" }} onClick={() => setModal("importar")}>📥 Importar</button>
      </div>

      {sel.size > 0 && (
        <div className="pb-bulk">
          <span className="cnt">{sel.size} seleccionado{sel.size > 1 ? "s" : ""}</span><span className="sp" />
          <button style={{ background: "var(--amber)" }} onClick={() => setModal("cupon")}>🎟️ Crear cupón</button>
          <button style={{ background: "var(--green)" }} onClick={() => setModal("whatsapp")}>📲 Enviar WhatsApp</button>
          <button className="ghost" onClick={exportCSV}>📤 Exportar CSV</button>
          <button className="ghost" onClick={() => setSel(new Set())}>✕</button>
        </div>
      )}

      {!filtered.length ? (
        <div className="empty"><div className="ico">🙋</div><h4>Sin clientes en este filtro</h4><p>Ajusta el embudo/filtros o agrega con ＋ Nuevo / 📥 Importar.</p></div>
      ) : view === "cards" ? (
        <div className="crm-cards">
          {filtered.map((r) => {
            const c = chan(r.canal); const s = stageOf(r.etapa);
            return (
              <div key={r.id} className={"crm-card" + (sel.has(r.id) ? " sel" : "")} onClick={() => setOpenId(r.id)}>
                <div className="top">
                  <div className="crm-av" style={{ background: avColor(r.nombre) }}>{initials(r.nombre)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="nm2">{r.nombre || "— sin nombre —"}</div>
                    <div className="mt2">{c.ic} {r.telefono || "sin tel"}{r.ciudad ? ` · ${r.ciudad}` : ""}</div>
                  </div>
                  <input type="checkbox" className="pb-check" checked={sel.has(r.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.id)} />
                </div>
                <div style={{ marginTop: 10 }}><span className="pb-pill" style={{ color: s.color, background: s.color + "1f" }}>{s.em} {s.label}</span></div>
                {r.productosComprados.length ? <div className="crm-sect"><div className="lb">🛍️ Compró</div><div className="crm-prods">{r.productosComprados.slice(0, 4).map((p, k) => <span key={k} className="crm-tagp" style={{ background: "#ece0ff", color: "#6941C6", borderColor: "transparent" }}>{p.name}</span>)}{r.productosComprados.length > 4 ? <span className="crm-tagp">+{r.productosComprados.length - 4}</span> : null}</div></div> : null}
                {r.productosInteres.length ? <div className="crm-sect"><div className="lb">👀 Le gusta</div><div className="crm-prods">{r.productosInteres.slice(0, 4).map((p, k) => <span key={k} className="crm-tagp" style={{ background: "#fef3c7", color: "#B54708", borderColor: "transparent" }}>{p.name}</span>)}</div></div> : null}
                <div className="stat">
                  <div><b>{r.numPedidos}</b><span>Pedidos</span></div>
                  <div><b>{COP(r.totalGastado)}</b><span>Gastado</span></div>
                  <div><b>{r.interacciones}</b><span>Interac.</span></div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="pb-headrow" style={{ gridTemplateColumns: "34px 118px 1fr 130px 90px 120px 22px" }}>
            <span><input type="checkbox" className="pb-check" checked={sel.size === filtered.length} onChange={toggleAll} /></span>
            <span>Canal</span><span>Cliente</span><span>Etapa</span><span>Pedidos</span><span style={{ textAlign: "right" }}>Gastado</span><span />
          </div>
          <div className="pb-list">
            {filtered.map((r) => {
              const c = chan(r.canal); const s = stageOf(r.etapa); const prods = [...r.productosComprados, ...r.productosInteres];
              return (
                <div key={r.id} className={"pb-row" + (sel.has(r.id) ? " sel" : "")} style={{ gridTemplateColumns: "34px 118px 1fr 130px 90px 120px 22px" }} onClick={() => setOpenId(r.id)}>
                  <span onClick={(ev) => ev.stopPropagation()}><input type="checkbox" className="pb-check" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></span>
                  <span className="pb-chan"><span className="dot" style={{ background: c.color }}>{c.ic}</span>{c.label}</span>
                  <span className="pb-cli"><div className="nm">{r.nombre || "— sin nombre —"}</div><div className="meta">{r.telefono || "sin tel"}{r.ciudad ? ` · ${r.ciudad}` : ""}</div>{prods.length ? <div className="crm-prods">{prods.slice(0, 3).map((p, i) => <span key={i} className="crm-tagp">{p.name}</span>)}{prods.length > 3 ? <span className="crm-tagp">+{prods.length - 3}</span> : null}</div> : null}</span>
                  <span><span className="pb-pill" style={{ color: s.color, background: s.color + "1f" }}>{s.em} {s.label}</span></span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{r.numPedidos}<span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 11 }}> ped.</span></span>
                  <span className="pb-total">{COP(r.totalGastado)}</span><span className="pb-chev">›</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {toast && <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "#101828", color: "#fff", padding: "11px 20px", borderRadius: 12, fontWeight: 700, fontSize: 13.5, zIndex: 90, boxShadow: "var(--shadow)" }}>{toast}</div>}
      {open && <Drawer c={open} catalog={catalog} nameOf={nameOf} onClose={() => setOpenId(null)} onToast={flash} />}
      {modal === "nuevo" && <NuevoModal catalog={catalog} onClose={() => setModal("")} onToast={flash} />}
      {modal === "importar" && <ImportarModal onClose={() => setModal("")} onToast={flash} />}
      {modal === "cupon" && <CuponModal n={selList.length} onClose={() => setModal("")} onToast={flash} />}
      {modal === "whatsapp" && <WhatsAppModal ids={[...sel]} n={selList.length} onClose={() => setModal("")} onToast={flash} />}
    </div>
  );
}

/* ---- Selector de productos (multi, buscable) ---- */
function ProductPicker({ catalog, value, onChange, accent }: { catalog: Prod[]; value: string[]; onChange: (v: string[]) => void; accent?: string }) {
  const [q, setQ] = React.useState(""); const [open, setOpen] = React.useState(false);
  const nameOf = new Map(catalog.map((p) => [p.slug, p.name]));
  const opts = catalog.filter((p) => !value.includes(p.slug) && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div className="pp-box">
      <div className="pp-chips">
        {value.map((s) => <span key={s} className="pp-chip" style={accent ? { background: accent + "22", color: accent } : {}}>{nameOf.get(s) || s} <b onClick={() => onChange(value.filter((x) => x !== s))}>✕</b></span>)}
        {!value.length ? <span style={{ fontSize: 12, color: "var(--muted)", padding: "2px 4px" }}>Ninguno</span> : null}
      </div>
      <input className="crm-input" style={{ marginTop: 7, padding: "8px 10px" }} placeholder="＋ Agregar producto…" value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      {open && q && opts.length ? (
        <div className="pp-drop">
          {opts.map((p) => <div key={p.slug} className="pp-opt" onClick={() => { onChange([...value, p.slug]); setQ(""); }}>{p.name}</div>)}
        </div>
      ) : null}
    </div>
  );
}

function Drawer({ c, catalog, nameOf, onClose, onToast }: { c: BoardCustomer; catalog: Prod[]; nameOf: Map<string, string>; onClose: () => void; onToast: (m: string) => void }) {
  const [notas, setNotas] = React.useState(c.notas || "");
  const [comprados, setComprados] = React.useState<string[]>(c.compradosManualSlugs || []);
  const [interes, setInteres] = React.useState<string[]>(c.interesSlugs || []);
  const [busy, setBusy] = React.useState(false);
  const s = stageOf(c.etapa); const ch = chan(c.canal);
  async function setEtapa(k: string) { setBusy(true); await cambiarEtapaCliente(c.id, k === c.etapa ? "" : k); setBusy(false); onToast("Etapa actualizada"); onClose(); }
  async function saveNotas() { setBusy(true); await guardarNotasCliente(c.id, notas, c.tags); setBusy(false); onToast("Notas guardadas"); }
  async function saveProd() { setBusy(true); await setProductosCliente(c.id, comprados, interes); setBusy(false); onToast("Productos guardados"); onClose(); }

  return (
    <div className="pb-ov" onClick={onClose}>
      <div className="crm-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="pb-mhead" style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}bb)`, padding: "22px 24px" }}>
          <button className="close" onClick={onClose}>×</button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="crm-av" style={{ background: "rgba(255,255,255,.25)", boxShadow: "none" }}>{initials(c.nombre)}</div>
            <div><div style={{ fontSize: 19, fontWeight: 800 }}>{c.nombre || "— sin nombre —"}</div>
            <div className="tags" style={{ marginTop: 4 }}><span className="tag">{ch.ic} {ch.label}</span><span className="tag" style={{ background: "rgba(255,255,255,.32)" }}>{s.em} {s.label}</span></div></div>
          </div>
        </div>
        <div style={{ padding: 20, overflow: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="pb-sec">
            <div className="pb-kv"><span className="k">Teléfono</span><span className="val">{c.telefono || "—"}</span></div>
            <div className="pb-kv"><span className="k">Ciudad</span><span className="val">{c.ciudad || "—"}</span></div>
            <div className="pb-kv"><span className="k">Pedidos</span><span className="val">{c.numPedidos}</span></div>
            <div className="pb-kv"><span className="k">Total gastado</span><span className="val">{COP(c.totalGastado)}</span></div>
            <div className="pb-kv"><span className="k">Interacciones bot</span><span className="val">{c.interacciones}</span></div>
            <div className="pb-kv"><span className="k">Última compra</span><span className="val">{c.ultimaCompra ? soloFechaCO(c.ultimaCompra) : "—"}</span></div>
          </div>

          {c.compradosPedidos.length ? (
            <div className="pb-sec"><div className="st">🧾 Compró (de pedidos)</div><div className="crm-prods">{c.compradosPedidos.map((p, i) => <span key={i} className="crm-tagp" style={{ background: "#ece0ff", color: "#6941C6", borderColor: "transparent" }}>{p.name}</span>)}</div></div>
          ) : null}

          <div className="pb-sec">
            <div className="st">🛍️ Compró (registrar a mano)</div>
            <ProductPicker catalog={catalog} value={comprados} onChange={setComprados} accent="#6941C6" />
          </div>
          <div className="pb-sec">
            <div className="st">👀 Le gusta / le interesa</div>
            <ProductPicker catalog={catalog} value={interes} onChange={setInteres} accent="#B54708" />
          </div>
          <button className="pb-btn gp" style={{ flex: "0 0 auto" }} disabled={busy} onClick={saveProd}>Guardar productos</button>

          <div className="pb-sec">
            <div className="st">🎯 Etapa (mover a mano)</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {STAGES.map((st) => (
                <button key={st.key} disabled={busy} onClick={() => setEtapa(st.key)} style={{ padding: "6px 11px", borderRadius: 20, border: `1.5px solid ${c.etapa === st.key ? st.color : "var(--line-2)"}`, background: c.etapa === st.key ? st.color + "1f" : "#fff", color: c.etapa === st.key ? st.color : "var(--ink-2)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{st.em} {st.label}</button>
              ))}
            </div>
          </div>
          <div className="pb-sec">
            <div className="st">📝 Notas</div>
            <textarea className="crm-input" rows={4} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas internas…" />
            <button className="pb-btn dk" style={{ marginTop: 8, flex: "0 0 auto" }} disabled={busy} onClick={saveNotas}>Guardar notas</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="pb-ov" onClick={onClose}>
      <div className="pb-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="pb-mhead" style={{ background: "linear-gradient(135deg,#101828,#344054)" }}><button className="close" onClick={onClose}>×</button><div className="ref" style={{ fontSize: 18 }}>{title}</div></div>
        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function NuevoModal({ catalog, onClose, onToast }: { catalog: Prod[]; onClose: () => void; onToast: (m: string) => void }) {
  const [f, setF] = React.useState({ nombre: "", telefono: "", ciudad: "", canal: "manual" });
  const [comprados, setComprados] = React.useState<string[]>([]);
  const [interes, setInteres] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const up = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="＋ Nuevo cliente" onClose={onClose}>
      <input className="crm-input" placeholder="Nombre" value={f.nombre} onChange={up("nombre")} />
      <input className="crm-input" placeholder="Teléfono" value={f.telefono} onChange={up("telefono")} />
      <input className="crm-input" placeholder="Ciudad" value={f.ciudad} onChange={up("ciudad")} />
      <select className="crm-input" value={f.canal} onChange={up("canal")}><option value="manual">Manual</option><option value="whatsapp">WhatsApp</option><option value="messenger">Messenger</option><option value="web">Web</option></select>
      <div><div style={{ fontSize: 12, fontWeight: 800, color: "#6941C6", margin: "2px 0 5px" }}>🛍️ ¿Qué compró?</div><ProductPicker catalog={catalog} value={comprados} onChange={setComprados} accent="#6941C6" /></div>
      <div><div style={{ fontSize: 12, fontWeight: 800, color: "#B54708", margin: "2px 0 5px" }}>👀 ¿Qué le gusta?</div><ProductPicker catalog={catalog} value={interes} onChange={setInteres} accent="#B54708" /></div>
      <button className="pb-btn gp" disabled={busy} onClick={async () => { setBusy(true); const r = await crearClienteManual({ ...f, comprados, interes }); setBusy(false); if (r.ok) { onToast("Cliente creado ✅"); onClose(); } else onToast(r.error || "Error"); }}>Crear cliente</button>
    </Modal>
  );
}

function ImportarModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const [txt, setTxt] = React.useState(""); const [busy, setBusy] = React.useState(false);
  return (
    <Modal title="📥 Importar clientes" onClose={onClose}>
      <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Una línea por cliente: <b>nombre, teléfono, ciudad</b>. Puede llevar encabezado.</div>
      <textarea className="crm-input" rows={9} placeholder={"Juan Pérez, 3001234567, Medellín\nAna Gómez, 3109876543, Cali"} value={txt} onChange={(e) => setTxt(e.target.value)} style={{ fontFamily: "ui-monospace,monospace", fontSize: 12.5 }} />
      <button className="pb-btn bl" disabled={busy || !txt.trim()} onClick={async () => { setBusy(true); const r = await importarClientes(txt); setBusy(false); if (r.ok) { onToast(`✅ ${r.creados} importado(s)`); onClose(); } else onToast(r.error || "Error"); }}>{busy ? "Importando…" : "Importar"}</button>
    </Modal>
  );
}

function CuponModal({ n, onClose, onToast }: { n: number; onClose: () => void; onToast: (m: string) => void }) {
  const [f, setF] = React.useState({ codigo: "", tipo: "porcentaje", valor: "10", diasVence: "30" }); const [busy, setBusy] = React.useState(false);
  return (
    <Modal title={`🎟️ Cupón para ${n} cliente(s)`} onClose={onClose}>
      <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Crea un código para este segmento; luego lo envías por WhatsApp.</div>
      <input className="crm-input" placeholder="CÓDIGO (ej. GALLO20)" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value.toUpperCase() })} />
      <div style={{ display: "flex", gap: 8 }}>
        <select className="crm-input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="porcentaje">% Porcentaje</option><option value="fijo">$ Fijo</option></select>
        <input className="crm-input" placeholder="Valor" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
      </div>
      <input className="crm-input" placeholder="Días de vigencia (ej. 30)" value={f.diasVence} onChange={(e) => setF({ ...f, diasVence: e.target.value })} />
      <button className="pb-btn" style={{ background: "var(--amber)" }} disabled={busy || !f.codigo} onClick={async () => { setBusy(true); const r = await crearCuponSegmento({ codigo: f.codigo, tipo: f.tipo as "porcentaje" | "fijo", valor: parseInt(f.valor) || 0, diasVence: parseInt(f.diasVence) || undefined }); setBusy(false); if (r.ok) { onToast(`🎟️ Cupón ${r.codigo} creado`); onClose(); } else onToast(r.error || "Error"); }}>Crear cupón</button>
    </Modal>
  );
}

function WhatsAppModal({ ids, n, onClose, onToast }: { ids: string[]; n: number; onClose: () => void; onToast: (m: string) => void }) {
  const [msg, setMsg] = React.useState(""); const [img, setImg] = React.useState(""); const [busy, setBusy] = React.useState(false);
  return (
    <Modal title={`📲 Campaña a ${n} cliente(s)`} onClose={onClose}>
      <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 4 }}>Se envía por el bot a los que tienen WhatsApp. Manuales/importados/web no reciben. <b>Ojo:</b> fuera de la ventana de 24h de Meta puede requerir plantilla aprobada.</div>
      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>Mensaje</label>
      <textarea className="crm-input" rows={5} placeholder="🔥 ¡Promo para ti! Combo Cuidado Total (4 Tapas) a $100.000, contra entrega. Escríbenos y te lo despachamos hoy 🐓" value={msg} onChange={(e) => setMsg(e.target.value)} />
      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)", marginTop: 8, display: "block" }}>Imagen (URL) — opcional</label>
      <input className="crm-input" placeholder="https://animalsdeluxe.com/products/combo-4-tapas.jpg" value={img} onChange={(e) => setImg(e.target.value)} />
      {img ? <div style={{ marginTop: 8, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }}><img src={img} alt="Vista previa" style={{ width: "100%", maxHeight: 180, objectFit: "cover", display: "block" }} /></div> : null}
      <button className="pb-btn gp" style={{ marginTop: 10 }} disabled={busy || (!msg.trim() && !img.trim())} onClick={async () => { setBusy(true); const r = await enviarWhatsAppSegmento(ids, msg, img.trim() || undefined); setBusy(false); if (r.ok) { onToast(`📲 Enviados: ${r.enviados} · sin WhatsApp: ${r.fallidos}`); onClose(); } else onToast(r.error || "Error"); }}>{busy ? "Enviando…" : img ? "Enviar campaña con imagen" : "Enviar mensaje"}</button>
    </Modal>
  );
}
