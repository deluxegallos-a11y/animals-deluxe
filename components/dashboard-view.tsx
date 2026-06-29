"use client";

import * as React from "react";
import Link from "next/link";
import { motion, animate, useInView, type Variants } from "framer-motion";
import {
  DollarSign, ShoppingBag, Users, ArrowRight, MoreHorizontal,
  TrendingUp, Package, Search, Filter, CheckCircle2, Trophy,
} from "lucide-react";
import { cop } from "@/lib/ai/format";

type Dash = {
  pedidosHoy: number; pedidosSemana: number; ingresosCop: number; leadsNuevos: number;
  topProductos: { name: string; cantidad: number }[];
  ultimosPedidos: { ref: string; nombre: string; total: number; estado: string }[];
};

const ESTADO: Record<string, { cls: string; txt: string }> = {
  pagado: { cls: "ok", txt: "Pagado" }, entregado: { cls: "ok", txt: "Entregado" },
  confirmado: { cls: "blue", txt: "Confirmado" }, despachado: { cls: "blue", txt: "Despachado" },
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

export function DashboardView({ d }: { d: Dash }) {
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

      {/* ---- 3 tarjetas resumen ---- */}
      <motion.div className="sumgrid" initial="hidden" animate="show" variants={stagger}>
        <motion.div className="sumc hot" variants={card} whileHover={{ y: -4 }}>
          <div className="top">
            <span className="ic"><DollarSign size={20} /></span>
            <div className="lbl">Ingresos confirmados<small>Contraentrega + anticipado</small></div>
            <MoreHorizontal className="dots" size={18} />
          </div>
          <div className="big"><Count to={d.ingresosCop} fmt={(n) => cop(Math.round(n))} /></div>
          <Link href="/pedidos" className="foot">Ver detalle <ArrowRight size={16} /></Link>
        </motion.div>

        <motion.div className="sumc" variants={card} whileHover={{ y: -4 }}>
          <div className="top">
            <span className="ic"><ShoppingBag size={20} /></span>
            <div className="lbl">Pedidos hoy<small>{d.pedidosSemana} esta semana</small></div>
            <MoreHorizontal className="dots" size={18} />
          </div>
          <div className="big"><Count to={d.pedidosHoy} /> <span className="chg up"><TrendingUp size={12} /> hoy</span></div>
          <Link href="/pedidos" className="foot">Gestionar pedidos <ArrowRight size={16} /></Link>
        </motion.div>

        <motion.div className="sumc" variants={card} whileHover={{ y: -4 }}>
          <div className="top">
            <span className="ic"><Users size={20} /></span>
            <div className="lbl">Leads nuevos<small>Últimos 7 días</small></div>
            <MoreHorizontal className="dots" size={18} />
          </div>
          <div className="big"><Count to={d.leadsNuevos} /></div>
          <Link href="/clientes" className="foot">Ver clientes <ArrowRight size={16} /></Link>
        </motion.div>
      </motion.div>

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
            <thead><tr><th>Cliente</th><th>Referencia</th><th>Total</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {d.ultimosPedidos.map((o) => {
                const e = ESTADO[o.estado] || { cls: "pend", txt: o.estado.replace(/_/g, " ") };
                return (
                  <tr key={o.ref}>
                    <td><div className="cust"><span className="av">{ini(o.nombre)}</span>{o.nombre}</div></td>
                    <td>{o.ref}</td>
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
