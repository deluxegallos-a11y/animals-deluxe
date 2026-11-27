"use client";

import { useEffect } from "react";

/** Error boundary de ÚLTIMO recurso (reemplaza el layout raíz). Igual que error.tsx
 *  pero envuelve <html>/<body>. Auto-recarga ante ChunkLoadError post-deploy. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
    <html lang="es">
      <body style={{ margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "'Inter',system-ui,sans-serif", textAlign: "center", background: "#F5F7FC" }}>
          <div style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 46 }}>🐓</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "10px 0 6px", color: "#101828" }}>{isChunk ? "Actualizando a la última versión…" : "Ups, algo salió mal"}</h2>
            <p style={{ color: "#667085", fontSize: 15, lineHeight: 1.5 }}>{isChunk ? "Estamos recargando la página." : "Intenta de nuevo o recarga la página."}</p>
            <button onClick={() => (isChunk ? window.location.reload() : reset())} style={{ marginTop: 18, padding: "11px 22px", borderRadius: 12, border: "none", background: "#FF4D2E", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Recargar</button>
          </div>
        </div>
      </body>
    </html>
  );
}
