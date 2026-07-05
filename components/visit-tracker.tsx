"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SKIP = /^\/(dashboard|pedidos|clientes|productos|anuncios|promociones|asesores|conversaciones|configuracion|resenas|login|api)/;

/** Registra CADA pageview (todas las visitas) + guarda session_id para contar
 *  visitantes únicos y de dónde vienen (referrer/UTM). Silencioso y fail-soft. */
export function VisitTracker() {
  const path = usePathname();
  const last = useRef<string>("");

  useEffect(() => {
    try {
      if (!path || SKIP.test(path)) return;
      // Evita doble disparo del MISMO path en <1.2s (StrictMode / remounts).
      const stamp = path + "|" + Math.floor(Date.now() / 1200);
      if (last.current === stamp) return;
      last.current = stamp;

      let sid = localStorage.getItem("ad_sid");
      if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("ad_sid", sid); }
      const primeraVez = !localStorage.getItem("ad_seen");
      if (primeraVez) localStorage.setItem("ad_seen", "1");

      const u = new URL(window.location.href);
      const body = JSON.stringify({
        path, referrer: document.referrer || "",
        utm_source: u.searchParams.get("utm_source") || "", utm_campaign: u.searchParams.get("utm_campaign") || "",
        session_id: sid, primera_vez: primeraVez,
      });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      else fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
    } catch { /* noop */ }
  }, [path]);

  return null;
}
