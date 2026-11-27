"use client";

import * as React from "react";
import type { AnuncioAnalisis } from "@/lib/meta-ads";

const cop = (n: number) => "$" + Number(n || 0).toLocaleString("es-CO");
const VER: Record<string, { txt: string; color: string; bg: string; bar: string; ic: string }> = {
  escalar: { txt: "Escalar", color: "#067647", bg: "#ECFDF3", bar: "linear-gradient(90deg,#12B76A,#039855)", ic: "🟢" },
  vigilar: { txt: "Vigilar", color: "#B54708", bg: "#FFFAEB", bar: "linear-gradient(90deg,#FDB022,#F79009)", ic: "🟡" },
  apagar: { txt: "Apagar", color: "#B42318", bg: "#FEF3F2", bar: "linear-gradient(90deg,#F97066,#F04438)", ic: "🔴" },
  sin_datos: { txt: "Sin datos", color: "#475467", bg: "#F2F4F7", bar: "linear-gradient(90deg,#D0D5DD,#98A2B3)", ic: "⚪" },
};

type Filtro = "todos" | "buenos" | "negativos";
const esBueno = (v: string) => v === "escalar" || v === "vigilar";
const esNegativo = (v: string) => v === "apagar";

export function AnunciosPanel({ anuncios, promedio }: { anuncios: AnuncioAnalisis[]; promedio: number }) {
  const [filtro, setFiltro] = React.useState<Filtro>("todos");
  const buenos = anuncios.filter((a) => esBueno(a.veredicto)).length;
  const negativos = anuncios.filter((a) => esNegativo(a.veredicto)).length;
  const lista = anuncios.filter((a) => filtro === "todos" || (filtro === "buenos" ? esBueno(a.veredicto) : esNegativo(a.veredicto)));
  // Barra: relativa al costo por mensaje más caro (más corto = más barato = mejor).
  const maxCPM = Math.max(1, ...anuncios.filter((a) => a.mensajes > 0).map((a) => a.costoPorMensaje));

  const tabs: { k: Filtro; label: string; n: number; color: string }[] = [
    { k: "todos", label: "Total de anuncios", n: anuncios.length, color: "#1E50E6" },
    { k: "buenos", label: "Buenos", n: buenos, color: "#067647" },
    { k: "negativos", label: "Negativos", n: negativos, color: "#B42318" },
  ];

  return (
    <div>
      {/* Contadores / filtros */}
      <div className="madp-tabs">
        {tabs.map((t) => (
          <button key={t.k} className={"madp-tab" + (filtro === t.k ? " on" : "")} style={filtro === t.k ? { borderColor: t.color } : undefined} onClick={() => setFiltro(t.k)}>
            <span className="n" style={{ color: t.color }}>{t.n}</span>
            <span className="l">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Barras de crecimiento */}
      <div className="madp-bars">
        {lista.map((a) => {
          const v = VER[a.veredicto];
          const pct = a.mensajes > 0 ? Math.max(6, Math.round((a.costoPorMensaje / maxCPM) * 100)) : 4;
          return (
            <div className="madp-row" key={a.adId}>
              <div className="madp-top">
                <span className="madp-nm" title={a.adName || a.campaign}>{a.adName || a.campaign || a.adId}</span>
                <span className="madp-chip" style={{ color: v.color, background: v.bg }}>{v.ic} {v.txt}</span>
              </div>
              <div className="madp-track">
                <div className="madp-fill" style={{ width: `${pct}%`, background: v.bar }} />
              </div>
              <div className="madp-meta">
                <b>{a.mensajes ? cop(a.costoPorMensaje) : "—"}</b><span> por mensaje</span>
                <span className="dot">·</span>{a.mensajes || 0} mensajes<span className="dot">·</span>{cop(a.spend)} gasto
                {a.productos.length ? <><span className="dot">·</span>{a.productos.join(", ")}</> : null}
              </div>
            </div>
          );
        })}
        {!lista.length ? <div className="empty2"><div className="ico">📭</div><h4>Sin anuncios {filtro === "buenos" ? "buenos" : "negativos"}</h4></div> : null}
      </div>
      <div className="madp-hint">La barra es el costo por mensaje (más corta = más barato = mejor). Promedio de la cuenta: <b>{cop(promedio)}</b> por mensaje.</div>
    </div>
  );
}
