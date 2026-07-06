import Link from "next/link";
import type { AnunciosResumen, AnuncioAnalisis } from "@/lib/meta-ads";

const cop = (n: number) => "$" + Number(n || 0).toLocaleString("es-CO");
const RANGOS = [
  { k: "today", label: "Hoy" }, { k: "yesterday", label: "Ayer" }, { k: "last_7d", label: "7 días" },
  { k: "last_30d", label: "30 días" }, { k: "this_month", label: "Este mes" }, { k: "maximum", label: "Histórico" },
];
const VER: Record<string, { txt: string; color: string; bg: string; accent: string; ic: string }> = {
  escalar: { txt: "Escalar", color: "#067647", bg: "#ECFDF3", accent: "#12B76A", ic: "🟢" },
  vigilar: { txt: "Vigilar", color: "#B54708", bg: "#FFFAEB", accent: "#F79009", ic: "🟡" },
  apagar: { txt: "Apagar", color: "#B42318", bg: "#FEF3F2", accent: "#F04438", ic: "🔴" },
  sin_datos: { txt: "Sin datos", color: "#475467", bg: "#F2F4F7", accent: "#98A2B3", ic: "⚪" },
};

function Kpi({ ic, label, value, sub, bg, color }: { ic: string; label: string; value: string; sub?: string; bg?: string; color?: string }) {
  return (
    <div className="mad-kpi">
      <div className="mad-kpi-ic" style={{ background: bg || "#EAF0FF", color: color || "#1E50E6" }}>{ic}</div>
      <div style={{ minWidth: 0 }}><div className="mad-kpi-lbl">{label}</div><div className="mad-kpi-val">{value}</div>{sub ? <div className="mad-kpi-sub">{sub}</div> : null}</div>
    </div>
  );
}

function AdCard({ x }: { x: AnuncioAnalisis }) {
  const v = VER[x.veredicto];
  return (
    <div className="mad-card" style={{ borderTop: `3px solid ${v.accent}` }}>
      <div className="mad-card-head">
        <div className="mad-card-name" title={x.adName || x.campaign}>{x.adName || x.campaign || x.adId}</div>
        <span className="mad-verd" style={{ color: v.color, background: v.bg }}>{v.ic} {v.txt}</span>
      </div>
      {x.productos.length ? <div className="mad-prod">{x.productos.join(", ")}</div> : <div className="mad-prod dim">— sin producto mapeado —</div>}
      <div className="mad-cpm">
        <div className="big">{x.mensajes ? cop(x.costoPorMensaje) : "—"}</div>
        <div className="lbl">por mensaje</div>
      </div>
      <div className="mad-stats">
        <div><b>{cop(x.spend)}</b><span>gasto</span></div>
        <div><b>{x.mensajes || "—"}</b><span>mensajes</span></div>
        <div><b>{x.ventas ? cop(x.ventas) : "—"}</b><span>ventas</span></div>
      </div>
      <div className="mad-rec">{x.recomendacion}</div>
    </div>
  );
}

export function MetaAnalisis({ a, rango }: { a: AnunciosResumen; rango: string }) {
  const escalar = a.anuncios.filter((x) => x.veredicto === "escalar");
  const apagar = a.anuncios.filter((x) => x.veredicto === "apagar");
  const gastoApagar = apagar.reduce((s, x) => s + x.spend, 0);
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="pagehead"><div><h1>📊 Análisis de anuncios (Meta)</h1><p>Solo anuncios <b>activos</b> · métrica clave: <b>costo por mensaje</b> (entre más barato, mejor).</p></div></div>

      <div className="dash-range">
        {RANGOS.map((r) => <Link key={r.k} href={`/anuncios?rango=${r.k}`} className={"dash-rbtn" + (rango === r.k ? " on" : "")}>{r.label}</Link>)}
      </div>

      {!a.ok ? (
        <div className="form-msg err" style={{ margin: "8px 0" }}>⚠️ {a.error}. Si el token venció, usa un System User token estable.</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mad-kpis">
            <Kpi ic="💬" label="Mensajes" value={a.mensajesTotal.toLocaleString("es-CO")} sub={`${a.anuncios.length} anuncios activos`} bg="#EAF0FF" color="#1E50E6" />
            <Kpi ic="🎯" label="Costo por mensaje (prom.)" value={cop(a.costoPorMensajeProm)} sub="entre más bajo, mejor" bg="#ECFDF3" color="#067647" />
            <Kpi ic="💸" label="Gasto en pauta" value={cop(a.gastoTotal)} bg="#FEF3F2" color="#B42318" />
            <Kpi ic="💰" label="Ventas atribuidas" value={cop(a.ventasTotal)} sub="por producto del anuncio" bg="#FFFAEB" color="#B54708" />
          </div>

          {/* Mejor / peor destacados */}
          <div className="mad-hilite">
            {a.mejor ? <div className="mad-hi best"><div className="tag">🏆 El más barato por mensaje</div><div className="nm">{a.mejor.adName || a.mejor.campaign}</div><div className="dt">{cop(a.mejor.costoPorMensaje)}/msg · {a.mejor.mensajes} mensajes · {cop(a.mejor.spend)} gasto. <b>Escálalo y graba más como este.</b></div></div> : null}
            {a.peor ? <div className="mad-hi worst"><div className="tag">🔴 El más caro / que desgasta</div><div className="nm">{a.peor.adName || a.peor.campaign}</div><div className="dt">{a.peor.mensajes ? `${cop(a.peor.costoPorMensaje)}/msg` : `${cop(a.peor.spend)} y 0 mensajes`}. <b>{a.peor.mensajes ? "Bájale o cambia el video." : "Págalo ya."}</b></div></div> : null}
          </div>

          {/* Recomendación de reasignación */}
          {gastoApagar > 0 ? <div className="mad-tip">📌 Estás gastando <b>{cop(gastoApagar)}</b> en {apagar.length} anuncio(s) 🔴. Muévelo a los {escalar.length} 🟢 para traer más mensajes con la misma plata.</div> : null}

          {/* Tarjetas de anuncios (ordenadas: más barato por mensaje primero) */}
          <h3 style={{ margin: "20px 0 12px", fontSize: 16, fontWeight: 800 }}>Anuncios activos · ordenados por costo por mensaje</h3>
          <div className="mad-grid">
            {a.anuncios.map((x) => <AdCard key={x.adId} x={x} />)}
          </div>
          <div style={{ fontSize: 11.5, color: "#98A2B3", margin: "10px 2px" }}>Las ventas se atribuyen por el producto que promociona cada anuncio (mapa abajo). Mapea más para afinar.</div>
        </>
      )}
    </div>
  );
}
