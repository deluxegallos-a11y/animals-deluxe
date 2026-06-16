"use client";

import * as React from "react";
import { motion, animate, type Variants } from "framer-motion";
import { Tag } from "@/components/ui";
import { cop } from "@/lib/ai/format";

type Dash = {
  pedidosHoy: number; pedidosSemana: number; ingresosCop: number; leadsNuevos: number;
  topProductos: { name: string; cantidad: number }[];
  ultimosPedidos: { ref: string; nombre: string; total: number; estado: string }[];
};

const ESTADO_VAR: Record<string, "ok" | "pend" | "fail" | "blue"> = {
  pagado: "ok", entregado: "ok", confirmado: "blue", despachado: "blue", pendiente_confirmacion: "pend", cancelado: "fail",
};

function Count({ to, fmt }: { to: number; fmt?: (n: number) => string }) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const c = animate(0, to, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setV(x) });
    return () => c.stop();
  }, [to]);
  return <>{fmt ? fmt(v) : Math.round(v).toLocaleString("es-CO")}</>;
}

const card: Variants = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

export function DashboardView({ d }: { d: Dash }) {
  return (
    <div className="ad-dash">
      <motion.div className="hbar" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="in">
          <div>
            <h1>Hola, Animals Deluxe 🐓</h1>
            <p>Tu tienda en tiempo real — pedidos, ingresos y leads del bot.</p>
          </div>
          <motion.img className="mini" src="/mascots/rooster-alfa.png" alt="" aria-hidden
            animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity }} />
        </div>
      </motion.div>

      <motion.div className="kpis2" initial="hidden" animate="show" variants={stagger}>
        <motion.div className="kc k1" variants={card} whileHover={{ y: -4 }}>
          <div className="lbl">📦 Pedidos hoy</div>
          <div className="big"><Count to={d.pedidosHoy} /></div>
          <div className="sub">{d.pedidosSemana} esta semana</div>
        </motion.div>
        <motion.div className="kc k2" variants={card} whileHover={{ y: -4 }}>
          <div className="lbl">💵 Ingresos confirmados</div>
          <div className="big" style={{ fontSize: 27 }}><Count to={d.ingresosCop} fmt={(n) => cop(Math.round(n))} /></div>
          <div className="sub">contraentrega + anticipado</div>
        </motion.div>
        <motion.div className="kc k3" variants={card} whileHover={{ y: -4 }}>
          <div className="lbl">🙋 Leads nuevos</div>
          <div className="big"><Count to={d.leadsNuevos} /></div>
          <div className="sub">últimos 7 días</div>
        </motion.div>
        <motion.div className="kc k4" variants={card} whileHover={{ y: -4 }}>
          <div className="lbl">🔥 Top producto</div>
          <div className="big" style={{ fontSize: 18, lineHeight: 1.15 }}>{d.topProductos[0]?.name || "—"}</div>
          <div className="sub">{d.topProductos[0]?.cantidad ?? 0} unidades vendidas</div>
        </motion.div>
      </motion.div>

      <motion.div className="twocol" initial="hidden" animate="show" variants={stagger}>
        <motion.div className="glass" variants={card}>
          <div className="card-h"><div className="t"><span className="ic bg-pri">🧾</span> Últimos pedidos</div></div>
          {d.ultimosPedidos.length ? (
            <table>
              <thead><tr><th>Ref</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead>
              <tbody>
                {d.ultimosPedidos.map((o) => (
                  <tr key={o.ref}>
                    <td><b>{o.ref}</b></td><td>{o.nombre}</td><td>{cop(o.total)}</td>
                    <td><Tag variant={ESTADO_VAR[o.estado] || "pend"}>{o.estado.replace(/_/g, " ")}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty"><div className="ico">🧾</div><h4>Sin pedidos aún</h4><p>Cuando el bot cree pedidos aparecerán aquí.</p></div>}
        </motion.div>

        <motion.div className="glass" variants={card}>
          <div className="card-h"><div className="t"><span className="ic bg-amb">🏆</span> Top productos</div></div>
          {d.topProductos.length ? d.topProductos.map((t, i) => (
            <motion.div className="row" key={t.name + i} whileHover={{ x: 4 }}>
              <div className="coin bg-amb">{i + 1}</div>
              <div><div className="nm">{t.name}</div></div>
              <div className="right"><div className="p">{t.cantidad} uds</div></div>
            </motion.div>
          )) : <div className="empty"><div className="ico">🏆</div><h4>Sin ventas aún</h4></div>}
        </motion.div>
      </motion.div>
    </div>
  );
}
