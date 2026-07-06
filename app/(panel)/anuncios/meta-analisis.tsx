import Link from "next/link";
import type { AnunciosResumen, AnuncioAnalisis } from "@/lib/meta-ads";

const cop = (n: number) => "$" + Number(n || 0).toLocaleString("es-CO");
const RANGOS = [
  { k: "today", label: "Hoy" }, { k: "yesterday", label: "Ayer" }, { k: "last_7d", label: "7 días" },
  { k: "last_30d", label: "30 días" }, { k: "this_month", label: "Este mes" }, { k: "maximum", label: "Histórico" },
];
const VER: Record<string, { txt: string; color: string; bg: string; ic: string }> = {
  escalar: { txt: "Escalar", color: "#067647", bg: "#ECFDF3", ic: "🟢" },
  vigilar: { txt: "Vigilar", color: "#B54708", bg: "#FFF4E5", ic: "🟡" },
  apagar: { txt: "Apagar", color: "#B42318", bg: "#FEECEB", ic: "🔴" },
  sin_datos: { txt: "Sin ventas aún", color: "#667085", bg: "#F2F4F7", ic: "⚪" },
};

function Chip({ v }: { v: AnuncioAnalisis["veredicto"] }) {
  const c = VER[v];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 800, color: c.color, background: c.bg, padding: "3px 9px", borderRadius: 999 }}>{c.ic} {c.txt}</span>;
}

export function MetaAnalisis({ a, rango }: { a: AnunciosResumen; rango: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="pagehead"><div><h1>📊 Análisis de anuncios (Meta)</h1><p>ROI real cruzando el gasto de Meta con tus ventas confirmadas.</p></div></div>

      {/* Rango */}
      <div className="dash-range">
        {RANGOS.map((r) => <Link key={r.k} href={`/anuncios?rango=${r.k}`} className={"dash-rbtn" + (rango === r.k ? " on" : "")}>{r.label}</Link>)}
      </div>

      {!a.ok ? (
        <div className="form-msg err" style={{ margin: "8px 0" }}>⚠️ {a.error || "No se pudo cargar Meta"}. Revisa META_ADS_TOKEN (los tokens de usuario caducan; usa un System User token estable).</div>
      ) : (
        <>
          {/* Resumen */}
          <div className="sumgrid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", marginBottom: 16 }}>
            <div className="sumc"><div className="top"><span className="ic" style={{ background: "#FEECEB", color: "#B42318" }}>💸</span><div className="lbl">Gasto en pauta<small>{a.anuncios.length} anuncios</small></div></div><div className="big">{cop(a.gastoTotal)}</div></div>
            <div className="sumc hot"><div className="top"><span className="ic">💰</span><div className="lbl">Ventas atribuidas<small>por producto del anuncio</small></div></div><div className="big">{cop(a.ventasTotal)}</div></div>
            <div className="sumc"><div className="top"><span className="ic" style={{ background: a.roasGlobal >= 1 ? "#ECFDF3" : "#FEECEB", color: a.roasGlobal >= 1 ? "#067647" : "#B42318" }}>📈</span><div className="lbl">ROAS global<small>ventas ÷ gasto</small></div></div><div className="big" style={{ color: a.roasGlobal >= 1 ? "#067647" : "#B42318" }}>{a.roasGlobal.toFixed(2)}x</div></div>
          </div>

          {/* Mejor / peor */}
          <div className="drow" style={{ marginBottom: 16 }}>
            {a.mejor ? <div className="panel" style={{ borderLeft: "4px solid #067647" }}><div className="sub">🏆 Tu mejor anuncio</div><div style={{ fontWeight: 800, fontSize: 15, margin: "4px 0" }}>{a.mejor.adName || a.mejor.campaign || a.mejor.adId}</div><div style={{ fontSize: 13, color: "#475467" }}>ROAS {a.mejor.roasReal}x · {a.mejor.pedidos} pedidos · {cop(a.mejor.ventas)} en ventas con {cop(a.mejor.spend)} de gasto. <b>Graba más videos como este.</b></div></div> : null}
            {a.peor ? <div className="panel" style={{ borderLeft: "4px solid #B42318" }}><div className="sub">🔴 El que más te desgasta</div><div style={{ fontWeight: 800, fontSize: 15, margin: "4px 0" }}>{a.peor.adName || a.peor.campaign || a.peor.adId}</div><div style={{ fontSize: 13, color: "#475467" }}>{cop(a.peor.spend)} gastados, {a.peor.pedidos} pedidos (ROAS {a.peor.roasReal}x). <b>{a.peor.roasReal < 1 ? "Te está quemando plata — págalo o cambia el creativo." : "Justo — optimiza público/creativo."}</b></div></div> : null}
          </div>

          {/* Recomendaciones agrupadas */}
          {(() => {
            const escalar = a.anuncios.filter((x) => x.veredicto === "escalar");
            const apagar = a.anuncios.filter((x) => x.veredicto === "apagar");
            const gastoApagar = apagar.reduce((s, x) => s + x.spend, 0);
            return (
              <div className="panel" style={{ marginBottom: 16, background: "#F9FAFB" }}>
                <div className="ph"><h3>💡 Recomendaciones</h3></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                  <div><div style={{ fontSize: 13, fontWeight: 800, color: "#067647" }}>🟢 Escala ({escalar.length})</div>{escalar.length ? escalar.slice(0, 4).map((x) => <div key={x.adId} style={{ fontSize: 12, color: "#475467", marginTop: 3 }}>• {(x.adName || x.campaign || x.adId).slice(0, 40)} — ROAS {x.roasReal}x</div>) : <div style={{ fontSize: 12, color: "#98A2B3", marginTop: 3 }}>Aún ninguno con ROAS ≥ 2.5x.</div>}</div>
                  <div><div style={{ fontSize: 13, fontWeight: 800, color: "#B42318" }}>🔴 Apaga ({apagar.length})</div>{apagar.length ? apagar.slice(0, 4).map((x) => <div key={x.adId} style={{ fontSize: 12, color: "#475467", marginTop: 3 }}>• {(x.adName || x.campaign || x.adId).slice(0, 40)} — {cop(x.spend)}, {x.pedidos} ped.</div>) : <div style={{ fontSize: 12, color: "#98A2B3", marginTop: 3 }}>Ninguno quemando plata 👌</div>}</div>
                </div>
                {gastoApagar > 0 ? <div style={{ marginTop: 12, padding: "10px 13px", background: "#EAF0FF", borderRadius: 10, fontSize: 13, color: "#1E50E6", fontWeight: 600 }}>📌 Estás gastando <b>{cop(gastoApagar)}</b> en {apagar.length} anuncio(s) 🔴. Reasigna ese presupuesto a los 🟢 para vender más con la misma plata.</div> : null}
              </div>
            );
          })()}

          {/* Tabla */}
          <div className="tablewrap">
            <div className="ph"><h3>Todos los anuncios (por gasto)</h3></div>
            <div style={{ overflowX: "auto" }}>
              <table className="adt">
                <thead><tr><th>Anuncio · Producto</th><th style={{ textAlign: "right" }}>Gasto</th><th style={{ textAlign: "right" }}>Ventas</th><th style={{ textAlign: "right" }}>Pedidos</th><th style={{ textAlign: "right" }}>ROAS</th><th style={{ textAlign: "right" }}>CPA</th><th style={{ textAlign: "right" }}>CTR</th><th>Veredicto</th></tr></thead>
                <tbody>
                  {a.anuncios.slice(0, 60).map((x) => (
                    <tr key={x.adId}>
                      <td><div style={{ fontWeight: 700, fontSize: 13 }}>{x.adName || x.campaign || x.adId}</div><div style={{ fontSize: 11, color: "#98A2B3" }}>{x.productos.length ? x.productos.join(", ") : "— sin producto mapeado —"}</div></td>
                      <td style={{ textAlign: "right" }}>{cop(x.spend)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: x.ventas ? "#067647" : "#98A2B3" }}>{x.ventas ? cop(x.ventas) : "—"}</td>
                      <td style={{ textAlign: "right" }}>{x.pedidos || "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: x.roasReal >= 1 ? "#067647" : x.pedidos ? "#B42318" : "#98A2B3" }}>{x.pedidos ? x.roasReal + "x" : "—"}</td>
                      <td style={{ textAlign: "right" }}>{x.cpaReal ? cop(x.cpaReal) : "—"}</td>
                      <td style={{ textAlign: "right", fontSize: 12 }}>{x.ctr ? x.ctr.toFixed(1) + "%" : "—"}</td>
                      <td title={x.recomendacion} style={{ cursor: "help" }}><Chip v={x.veredicto} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: "#98A2B3", margin: "8px 2px" }}>Las ventas se atribuyen por el producto que promociona cada anuncio (vía mapa anuncio→producto). Mapea más anuncios abajo para mejorar la precisión.</div>
        </>
      )}
    </div>
  );
}
