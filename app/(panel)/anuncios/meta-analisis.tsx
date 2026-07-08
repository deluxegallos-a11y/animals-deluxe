import Link from "next/link";
import type { AnunciosResumen } from "@/lib/meta-ads";
import { AnunciosPanel } from "./anuncios-panel";

const cop = (n: number) => "$" + Number(n || 0).toLocaleString("es-CO");
const RANGOS = [
  { k: "today", label: "Hoy" }, { k: "yesterday", label: "Ayer" }, { k: "last_7d", label: "7 días" },
  { k: "last_30d", label: "30 días" }, { k: "this_month", label: "Este mes" }, { k: "maximum", label: "Histórico" },
];

function Kpi({ ic, label, value, sub, bg, color }: { ic: string; label: string; value: string; sub?: string; bg?: string; color?: string }) {
  return (
    <div className="mad-kpi">
      <div className="mad-kpi-ic" style={{ background: bg || "#EAF0FF", color: color || "#1E50E6" }}>{ic}</div>
      <div style={{ minWidth: 0 }}><div className="mad-kpi-lbl">{label}</div><div className="mad-kpi-val">{value}</div>{sub ? <div className="mad-kpi-sub">{sub}</div> : null}</div>
    </div>
  );
}

export function MetaAnalisis({ a, rango }: { a: AnunciosResumen; rango: string }) {
  const apagar = a.anuncios.filter((x) => x.veredicto === "apagar");
  const gastoApagar = apagar.reduce((s, x) => s + x.spend, 0);
  const buenos = a.anuncios.filter((x) => x.veredicto === "escalar" || x.veredicto === "vigilar").length;
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="pagehead"><div><h1>📊 Anuncios (Meta)</h1><p>Solo <b>activos</b> · métrica clave: <b>costo por mensaje</b> — entre más barato, mejor.</p></div></div>

      <div className="dash-range">
        {RANGOS.map((r) => <Link key={r.k} href={`/anuncios?rango=${r.k}`} className={"dash-rbtn" + (rango === r.k ? " on" : "")}>{r.label}</Link>)}
      </div>

      {!a.ok ? (
        <div className="form-msg err" style={{ margin: "8px 0" }}>⚠️ {a.error}. Si el token venció, usa un System User token estable.</div>
      ) : (
        <>
          <div className="mad-kpis">
            <Kpi ic="🎯" label="Costo por mensaje (prom.)" value={cop(a.costoPorMensajeProm)} sub="entre más bajo, mejor" bg="#ECFDF3" color="#067647" />
            <Kpi ic="💬" label="Mensajes" value={a.mensajesTotal.toLocaleString("es-CO")} sub={`${a.anuncios.length} activos · ${buenos} buenos`} bg="#EAF0FF" color="#1E50E6" />
            <Kpi ic="💸" label="Gasto en pauta" value={cop(a.gastoTotal)} bg="#FEF3F2" color="#B42318" />
            <Kpi ic="💰" label="Ventas atribuidas" value={cop(a.ventasTotal)} sub="por producto del anuncio" bg="#FFFAEB" color="#B54708" />
          </div>

          {gastoApagar > 0 ? <div className="mad-tip">📌 Estás gastando <b>{cop(gastoApagar)}</b> en {apagar.length} anuncio(s) negativos. Muévelo a los buenos para traer más mensajes con la misma plata.</div> : null}

          <AnunciosPanel anuncios={a.anuncios} promedio={a.costoPorMensajeProm} />
        </>
      )}
    </div>
  );
}
