/** Se muestra al instante mientras carga cada sección del panel (navegación).
 *  Evita la sensación de "congelado" mientras el servidor trae los datos. */
export default function PanelLoading() {
  return (
    <div style={{ padding: "8px 2px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div className="ad-spin" style={{ width: 22, height: 22, border: "3px solid #E4E7EC", borderTopColor: "#2f6bff", borderRadius: "50%" }} />
        <span style={{ color: "#667085", fontWeight: 700, fontSize: 14 }}>Cargando…</span>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="ad-sk" style={{ height: 58, borderRadius: 14, background: "#EEF1F6", opacity: 1 - i * 0.12 }} />
        ))}
      </div>
      <style>{`
        @keyframes ad-spin-kf { to { transform: rotate(360deg); } }
        .ad-spin { animation: ad-spin-kf .7s linear infinite; }
        @keyframes ad-sk-kf { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
        .ad-sk { animation: ad-sk-kf 1.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
