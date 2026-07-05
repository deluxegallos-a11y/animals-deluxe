"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SKIP = /^\/(dashboard|pedidos|clientes|productos|anuncios|promociones|asesores|conversaciones|configuracion|resenas|login|api)/;

/** Registra una visita por sesión y por página (con UTM de la campaña). Silencioso. */
export function VisitTracker() {
  const path = usePathname();
  useEffect(() => {
    try {
      if (!path || SKIP.test(path)) return;
      let sid = localStorage.getItem("ad_sid");
      if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("ad_sid", sid); }
      const key = "ad_v_" + path;
      if (sessionStorage.getItem(key)) return; // 1 vez por sesión por página
      sessionStorage.setItem(key, "1");
      const u = new URL(window.location.href);
      const body = JSON.stringify({
        path, referrer: document.referrer || "",
        utm_source: u.searchParams.get("utm_source") || "", utm_campaign: u.searchParams.get("utm_campaign") || "",
        session_id: sid,
      });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      else fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
    } catch { /* noop */ }
  }, [path]);
  return null;
}
