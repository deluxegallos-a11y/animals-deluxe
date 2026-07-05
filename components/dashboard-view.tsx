"use client";

import * as React from "react";
import Link from "next/link";
import { motion, animate, useInView, type Variants } from "framer-motion";
import {
  DollarSign, ShoppingBag, Users, ArrowRight, MoreHorizontal,
  TrendingUp, Package, Search, Filter, CheckCircle2, Trophy,
} from "lucide-react";
import { cop } from "@/lib/ai/format";
import type { Analytics } from "@/lib/queries";

type Dash = {
  pedidosHoy: number; pedidosSemana: number; ventasHoyCop: number; ingresosCop: number; aRecaudarCop: number; leadsNuevos: number;
  porEstado: { estado: string; label: string; n: number; monto: number }[];
  topProductos: { name: string; cantidad: number }[];
  ultimosPedidos: { ref: string; nombre: string; total: number; estado: string; createdAt: string | null; canal: string }[];
};
const CANAL_IC: Record<string, string> = { whatsapp: "📱", messenger: "💬", web: "🌐", asesor: "🎧" };
const EST_COLOR: Record<string, string> = { remision: "#B54708", aprobado: "#067647", guia: "#1E50E6", despachado: "#6941C6", entregado: "#067647" };

const ESTADO: Record<string, { cls: string; txt: string }> = {
  remision: { cls: "pend", txt: "Remisión" }, aprobado: { cls: "blue", txt: "Orden de venta" },
  guia: { cls: "blue", txt: "Con guía" }, despachado: { cls: "blue", txt: "Despachado" },
  pagado: { cls: "ok", txt: "Pagado" }, entregado: { cls: "ok", txt: "Entregado" },
  confirmado: { cls: "blue", txt: "Confirmado" },
  pendiente_confirmacion: { cls: "pend", txt: "Pendiente" }, cancelado: { cls: "fail", txt: "Cancelado" },
};

function Count({ to, fmt }: { to: number; fmt?: (n: number) => string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.2, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setV(x) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{fmt ? fmt(v) : Math.round(v).toLocaleString("es-CO")}</span>;
}

const card: Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const ini = (s: string) => (s || "?").trim().charAt(0).toUpperCase();

export function DashboardView({ d, a }: { d: Dash; a: Analytics }) {
  const maxQ = Math.max(1, ...d.topProductos.map((t) => t.cantidad));
  const topBars = d.topProductos.slice(0, 7);

  return (
    <div>
      <div className="pagehead">
        <div>
          <h1>Resumen general</h1>
          <p>Pedidos, ingresos y leads de tu tienda en tiempo real.</p>
        </div>
        <div className="ctrls">
          <button className="chip-btn"><TrendingUp size={15} /> Este mes</button>
          <Link href="/pedidos" className="chip-btn"><ShoppingBag size={15} /> Ver pedidos</Link>
        </div>
      </div>

      {/* ---- 4 KPIs claros ---- */}
      <motion.div className="sumgrid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }} initial="hidden" animate="show" variants={stagger}>
        <motion.div className="sumc" variants={card} whileHover={{ y: -4 }}>
          <div className="top">
            <span className="ic" style={{ background: "#EAF0FF", color: "#1E50E6" }}><ShoppingBag size={20} /></span>
            <div className="lbl">Pedidos de hoy<small>{d.pedidosSemana} en los últimos 7 días</small></div>
          </div>
          <div className="big"><Count to={d.pedidosHoy} /></div>
          <div className="foot" style={{ color: "#475467" }}>{cop(d.ventasHoyCop)} en ventas hoy</div>
        </motion.div>

        <motion.div className="sumc hot" variants={card} whileHover={{ y: -4 }}>
          <div className="top">
            <span className="ic"><DollarSign size={20} /></span>
            <div className="lbl">En caja (entregados)<small>Plata ya cobrada</small></div>
          </div>
          <div className="big"><Count to={d.ingresosCop} fmt={(n) => cop(Math.round(n))} /></div>
          <Link href="/pedidos" className="foot">Ver pedidos <ArrowRight size={16} /></Link>
        </motion.div>

        <motion.div className="sumc" variants={card} whileHover={{ y: -4 }}>
          <div className="top">
            <span className="ic" style={{ background: "#FFF4E5", color: "#B54708" }}><Package size={20} /></span>
            <div className="lbl">Por recaudar<small>Contra entrega en camino</small></div>
          </div>
          <div className="big"><Count to={d.aRecaudarCop} fmt={(n) => cop(Math.round(n))} /></div>
          <div className="foot" style={{ color: "#475467" }}>se cobra al entregar</div>
        </motion.div>

        <motion.div className="sumc" variants={card} whileHover={{ y: -4 }}>
          <div className="top">
            <span className="ic" style={{ background: "#F4EBFF", color: "#6941C6" }}><Users size={20} /></span>
            <div className="lbl">Leads nuevos<small>Últimos 7 días</small></div>
          </div>
          <div className="big"><Count to={d.leadsNuevos} /></div>
          <Link href="/clientes" className="foot">Ver clientes <ArrowRight size={16} /></Link>
        </motion.div>
      </motion.div>

      {/* ---- Pipeline por estados ---- */}
      <motion.div className="panel" style={{ marginTop: 18 }} initial="hidden" animate="show" variants={card}>
        <div className="ph"><div><h3>Flujo de pedidos</h3><div className="sub">Dónde está cada pedido ahora mismo</div></div></div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
          {d.porEstado.map((s, i) => (
            <React.Fragment key={s.estado}>
              <Link href="/pedidos" style={{ flex: "1 1 150px", minWidth: 130, textDecoration: "none", border: "1px solid var(--line, #E4E7EC)", borderRadius: 14, padding: "13px 15px", background: "#fff", display: "block", borderLeft: `4px solid ${EST_COLOR[s.estado] || "#475467"}` }}>
                <div style={{ fontSize: 12.5, color: "#667085", fontWeight: 700 }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#101828", lineHeight: 1.1, margin: "3px 0" }}>{s.n}</div>
                <div style={{ fontSize: 12, color: EST_COLOR[s.estado] || "#475467", fontWeight: 600 }}>{cop(s.monto)}</div>
              </Link>
              {i < d.porEstado.length - 1 ? <div style={{ alignSelf: "center", color: "#D0D5DD", fontSize: 18, fontWeight: 700 }}>→</div> : null}
            </React.Fragment>
          ))}
        </div>
      </motion.div>

      {/* ---- Analítica: tráfico vs ventas por fuente ---- */}
      <Analitica a={a} />

      {/* ---- lista top productos + chart ---- */}
      <motion.div className="drow" initial="hidden" animate="show" variants={stagger}>
        <motion.div className="panel" variants={card}>
          <div className="ph">
            <div><h3>Top productos</h3><div className="sub">Más vendidos</div></div>
            <Link href="/productos" className="chip-btn"><Package size={15} /> Ver todos</Link>
          </div>
          {d.topProductos.length ? (
            <div className="wlist">
              {d.topProductos.slice(0, 4).map((t, i) => (
                <motion.div className="wrow" key={t.name + i} whileHover={{ x: 3 }}>
                  <div className={`rk ${i === 1 ? "g2" : i === 2 ? "g3" : ""}`}>{i + 1}</div>
                  <div className="nm">{t.name}<small>Producto premium</small></div>
                  <div className="val"><b>{t.cantidad}</b><span className="pill">vendido{t.cantidad !== 1 ? "s" : ""}</span></div>
                </motion.div>
              ))}
            </div>
          ) : <div className="empty2"><div className="ico"><Trophy size={22} /></div><h4>Sin ventas aún</h4><p>Aparecerán cuando el bot cree pedidos.</p></div>}
        </motion.div>

        <motion.div className="panel chart" variants={card}>
          <div className="ph">
            <div>
              <div className="sub">Ingresos confirmados</div>
              <div className="amt">{cop(d.ingresosCop)}</div>
            </div>
            <div className="toggle"><span className="on">Unidades</span><span>Top</span></div>
          </div>
          {topBars.length ? (
            <div className="bars">
              {topBars.map((t, i) => {
                const h = Math.max(8, Math.round((t.cantidad / maxQ) * 100));
                const hot = t.cantidad === maxQ;
                return (
                  <div className={`bar ${hot ? "hot" : ""}`} key={t.name + i}>
                    <div className="tip">{t.name}: {t.cantidad}</div>
                    <i style={{ height: `${h}%` }} />
                    <span className="bl">{t.name.split(" ")[0]}</span>
                  </div>
                );
              })}
            </div>
          ) : <div className="empty2"><div className="ico"><TrendingUp size={22} /></div><h4>Sin datos de ventas</h4></div>}
        </motion.div>
      </motion.div>

      {/* ---- tabla pedidos recientes ---- */}
      <motion.div className="tablewrap" initial="hidden" animate="show" variants={card}>
        <div className="ph">
          <h3>Pedidos recientes</h3>
          <div className="ctrls">
            <button className="chip-btn"><Search size={15} /> Buscar</button>
            <button className="chip-btn"><Filter size={15} /> Filtrar</button>
          </div>
        </div>
        {d.ultimosPedidos.length ? (
          <table className="adt">
            <thead><tr><th>Cliente</th><th>Canal</th><th>Ref.</th><th>Hora</th><th>Total</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {d.ultimosPedidos.map((o) => {
                const e = ESTADO[o.estado] || { cls: "pend", txt: o.estado.replace(/_/g, " ") };
                return (
                  <tr key={o.ref}>
                    <td><div className="cust"><span className="av">{ini(o.nombre)}</span>{o.nombre}</div></td>
                    <td>{CANAL_IC[o.canal] || "📱"}</td>
                    <td>{o.ref}</td>
                    <td style={{ fontSize: 12, color: "#667085" }}>{o.createdAt ? new Date(o.createdAt).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td><b>{cop(o.total)}</b></td>
                    <td><span className={`stat ${e.cls}`}>{e.cls === "ok" ? <CheckCircle2 size={13} /> : null}{e.txt}</span></td>
                    <td style={{ textAlign: "right" }}><Link href="/pedidos" className="tbtn" style={{ display: "inline-grid", width: 32, height: 32 }}><MoreHorizontal size={16} /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <div className="empty2"><div className="ico"><ShoppingBag size={22} /></div><h4>Sin pedidos aún</h4><p>Cuando el bot cree pedidos aparecerán aquí.</p></div>}
      </motion.div>
    </div>
  );
}

/* ============ Analítica: tráfico vs ventas por fuente ============ */
function Analitica({ a }: { a: Analytics }) {
  const totalVis = a.porFuente.reduce((s, f) => s + f.visitas, 0);
  const sinVentaWeb = a.pedidosWeb === 0 && a.visitas30d > 0;
  const canalColor: Record<string, string> = { whatsapp: "#16C784", messenger: "#0084FF", web: "#7A3CFF", asesor: "#F79009" };
  return (
    <div className="ana-wrap" style={{ margin: "6px 0 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px" }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-.3px" }}>📊 Tráfico vs ventas por fuente</h3>
        <span style={{ fontSize: 12, color: "#8A93A5" }}>últimos 30 días · hoy {a.visitasHoy} visitas</span>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 13, marginBottom: 14 }}>
        <AnaKpi ic="👀" num={a.visitas30d.toLocaleString("es-CO")} lbl="Visitas / pageviews (30d)" sub={`hoy ${a.visitasHoy} · 7d ${a.visitas7d}`} color="#2F6BFF" />
        <AnaKpi ic="👥" num={a.visitantes30d.toLocaleString("es-CO")} lbl="Visitantes únicos (30d)" sub={`hoy ${a.visitantesHoy}`} color="#5C8BFF" />
        <AnaKpi ic="🌐" num={String(a.pedidosWeb)} lbl="Pedidos por WEB" sub="tienda + landings" color={a.pedidosWeb ? "#16C784" : "#F04438"} />
        <AnaKpi ic="📱" num={String(a.pedidosWhatsapp)} lbl="Pedidos por WhatsApp" color="#16C784" />
        <AnaKpi ic="📈" num={`${a.visitantes30d ? Math.round((a.pedidosWeb / a.visitantes30d) * 1000) / 10 : 0}%`} lbl="Conversión web" sub={`${a.pedidosWeb}/${a.visitantes30d} visitantes`} color="#7A3CFF" />
      </div>

      {/* Origen del tráfico */}
      {a.origenes.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#667085" }}>De dónde vienen:</span>
          {a.origenes.map((o) => (
            <span key={o.origen} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #E6E8EE", borderRadius: 20, padding: "6px 12px", fontSize: 12.5, fontWeight: 700 }}>
              {o.origen === "Facebook" ? "🔵" : o.origen === "Instagram" ? "🟣" : o.origen === "WhatsApp" ? "🟢" : o.origen === "Directo" ? "🔗" : "•"} {o.origen}: <b>{o.visitas}</b>
            </span>
          ))}
        </div>
      ) : null}

      {sinVentaWeb && (
        <div style={{ background: "#FEECEB", border: "1px solid #F04438", color: "#B42318", borderRadius: 12, padding: "12px 15px", fontSize: 13.5, marginBottom: 14, fontWeight: 600 }}>
          ⚠️ Tienes <b>{a.visitas30d.toLocaleString("es-CO")} visitas</b> a la web pero <b>0 pedidos por la web</b> en 30 días. La publicidad trae tráfico pero no convierte: revisa el checkout web / precios / botón de compra, o si la gente prefiere cerrar por WhatsApp.
        </div>
      )}

      {/* Tabla por fuente */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={thS}>Fuente</th><th style={{ ...thS, textAlign: "right" }}>Visitas</th><th style={{ ...thS, textAlign: "right" }}>Pedidos</th><th style={{ ...thS, textAlign: "right" }}>Conversión</th><th style={{ ...thS, width: "34%" }}>Tráfico</th>
          </tr></thead>
          <tbody>
            {a.porFuente.map((f) => {
              const pct = totalVis ? (f.visitas / totalVis) * 100 : 0;
              return (
                <tr key={f.fuente}>
                  <td style={tdS}><b>{f.label}</b></td>
                  <td style={{ ...tdS, textAlign: "right" }}>{f.visitas.toLocaleString("es-CO")}</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 800, color: f.pedidos ? "#16C784" : "#98A2B3" }}>{f.pedidos}</td>
                  <td style={{ ...tdS, textAlign: "right", color: f.conversion ? "#101828" : "#98A2B3", fontWeight: 700 }}>{f.conversion}%</td>
                  <td style={tdS}><div style={{ height: 8, background: "#EEF1F6", borderRadius: 20 }}><div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#5C8BFF,#2F6BFF)", borderRadius: 20 }} /></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Ventas por canal */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {a.ventasPorCanal.map((c) => (
          <span key={c.canal} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", border: "1px solid #E6E8EE", borderRadius: 20, padding: "7px 13px", fontSize: 12.5, fontWeight: 700 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: canalColor[c.canal] || "#8A93A5" }} /> {c.canal}: <b>{c.n}</b> ({cop(c.total)})
          </span>
        ))}
      </div>
    </div>
  );
}
const thS: React.CSSProperties = { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".4px", color: "#8A93A5", fontWeight: 700, padding: "11px 14px", background: "#F4F6FB", borderBottom: "1px solid #E6E8EE" };
const tdS: React.CSSProperties = { padding: "11px 14px", borderBottom: "1px solid #F0F2F7", fontSize: 13.5, color: "#344054" };
function AnaKpi({ ic, num, lbl, sub, color }: { ic: string; num: string; lbl: string; sub?: string; color: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E6E8EE", borderRadius: 14, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: color }} />
      <div style={{ fontSize: 16 }}>{ic}</div>
      <div style={{ fontSize: 25, fontWeight: 800, color: "#101828", letterSpacing: "-.5px", marginTop: 3 }}>{num}</div>
      <div style={{ fontSize: 12, color: "#667085", fontWeight: 600 }}>{lbl}</div>
      {sub ? <div style={{ fontSize: 10.5, color: "#98A2B3", marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}
