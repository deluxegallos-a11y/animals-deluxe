"use client";

import { useEffect } from "react";

/** Error boundary de las secciones del panel. Ante un ChunkLoadError (chunks viejos
 *  tras un deploy nuevo con la pestaña abierta) recarga solo, con guarda por tiempo
 *  para no caer en bucle. Cualquier otro error ofrece reintentar sin romper el panel. */
export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isChunk = error?.name === "ChunkLoadError" || /Loading chunk|Loading CSS chunk|dynamically imported module|import\(\) failed|Failed to fetch/i.test(error?.message || "");
  useEffect(() => {
    if (isChunk) {
      const k = "ad-chunk-reload-ts";
      let last = 0;
      try { last = Number(sessionStorage.getItem(k) || 0); } catch { /* noop */ }
      if (Date.now() - last > 12000) {
        try { sessionStorage.setItem(k, String(Date.now())); } catch { /* noop */ }
        window.location.reload();
      }
    }
  }, [isChunk]);

  return (
    <div style={{ minHeight: "50vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 40 }}>🐓</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: "10px 0 6px", color: "#101828" }}>{isChunk ? "Actualizando a la última versión…" : "No se pudo cargar esta sección"}</h2>
        <p style={{ color: "#667085", fontSize: 14.5, lineHeight: 1.5 }}>{isChunk ? "Recargando para traerte lo más reciente." : "Intenta de nuevo. Si sigue, recarga la página."}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18 }}>
          <button onClick={() => reset()} style={{ padding: "11px 20px", borderRadius: 12, border: "1px solid #E4E7EC", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Reintentar</button>
          <button onClick={() => window.location.reload()} style={{ padding: "11px 20px", borderRadius: 12, border: "none", background: "#2f6bff", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Recargar</button>
        </div>
      </div>
    </div>
  );
}
