"use client";
import * as React from "react";

/** Barra superior (no se imprime) + auto-abre el diálogo de impresión. */
export function AutoPrint({ titulo }: { titulo: string }) {
  React.useEffect(() => {
    const t = setTimeout(() => { try { window.print(); } catch { /* noop */ } }, 500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", gap: 10, alignItems: "center", background: "#101828", color: "#fff", padding: "12px 18px", borderRadius: 12, marginBottom: 18 }}>
      <b style={{ fontSize: 14 }}>{titulo}</b>
      <span style={{ flex: 1 }} />
      <button onClick={() => window.print()} style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "#FF4D2E", color: "#fff", fontWeight: 700, cursor: "pointer" }}>🖨️ Imprimir</button>
      <button onClick={() => window.close()} style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,.3)", background: "transparent", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
    </div>
  );
}
