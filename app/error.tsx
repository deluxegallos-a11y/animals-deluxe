"use client";

import { useEffect } from "react";

/** Error boundary de las páginas públicas. Si el fallo es un ChunkLoadError
 *  (típico tras un deploy nuevo con un tab viejo abierto), recarga solo para
 *  traer los chunks nuevos. Para cualquier otro error, ofrece reintentar. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isChunk = error?.name === "ChunkLoadError" || /Loading chunk|Loading CSS chunk|dynamically imported module|import\(\) failed|Failed to fetch/i.test(error?.message || "");
  useEffect(() => {
    if (isChunk) {
      // Guarda por TIEMPO: recarga si no lo hicimos en los últimos 12s.
      // Así se recupera aunque varias secciones tengan chunks viejos (tras muchos deploys),
      // sin caer en bucle de recargas.
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
    <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "'Inter',system-ui,sans-serif", textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 46 }}>🐓</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "10px 0 6px", color: "#101828" }}>{isChunk ? "Actualizando a la última versión…" : "Ups, algo salió mal"}</h2>
        <p style={{ color: "#667085", fontSize: 15, lineHeight: 1.5 }}>{isChunk ? "Estamos recargando la página para traerte lo más reciente." : "Intenta de nuevo; si sigue, recarga la página."}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18 }}>
          <button onClick={() => reset()} style={{ padding: "11px 20px", borderRadius: 12, border: "1px solid #E4E7EC", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Reintentar</button>
          <button onClick={() => window.location.reload()} style={{ padding: "11px 20px", borderRadius: 12, border: "none", background: "#FF4D2E", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Recargar</button>
        </div>
      </div>
    </div>
  );
}
