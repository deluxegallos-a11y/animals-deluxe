"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, Command } from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/dashboard", ic: "📊" },
  { label: "Productos", href: "/productos", ic: "📦" },
  { label: "Pedidos", href: "/pedidos", ic: "🧾" },
  { label: "Clientes · CRM", href: "/clientes", ic: "🙋" },
  { label: "Conversaciones", href: "/conversaciones", ic: "💬" },
  { label: "Anuncios", href: "/anuncios", ic: "📣" },
  { label: "Promociones", href: "/promociones", ic: "🎟️" },
  { label: "Reseñas", href: "/resenas", ic: "⭐" },
  { label: "Asesores", href: "/asesores", ic: "🎧" },
  { label: "Configuración", href: "/configuracion", ic: "⚙️" },
  { label: "Ver tienda", href: "/", ic: "🛍️" },
];

export function ThemeToggle() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => { setDark(document.documentElement.getAttribute("data-theme") === "dark"); }, []);
  function toggle() {
    const next = !dark; setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try { localStorage.setItem("adm-theme", next ? "dark" : "light"); } catch { /* noop */ }
  }
  return (
    <button className="tbtn" onClick={toggle} title={dark ? "Modo claro" : "Modo oscuro"} aria-label="Cambiar tema">
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [i, setI] = React.useState(0);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); setQ(""); setI(0); }
      if (e.key === "Escape") setOpen(false);
    }
    function onOpen() { setOpen(true); setQ(""); setI(0); }
    window.addEventListener("keydown", onKey);
    window.addEventListener("adm-open-cmdk", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("adm-open-cmdk", onOpen); };
  }, []);

  const list = NAV.filter((n) => n.label.toLowerCase().includes(q.toLowerCase()));
  function go(href: string) { setOpen(false); router.push(href); }

  if (!open) return null;
  return (
    <div className="cmdk-ov" onClick={() => setOpen(false)}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-in">
          <Command size={17} />
          <input autoFocus placeholder="Ir a… (escribe una sección)" value={q}
            onChange={(e) => { setQ(e.target.value); setI(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, list.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
              if (e.key === "Enter" && list[i]) go(list[i].href);
            }} />
          <span className="cmdk-esc">esc</span>
        </div>
        <div className="cmdk-list">
          {list.length ? list.map((n, k) => (
            <div key={n.href} className={"cmdk-it" + (k === i ? " on" : "")} onMouseEnter={() => setI(k)} onClick={() => go(n.href)}>
              <span className="ic">{n.ic}</span> {n.label}
            </div>
          )) : <div className="cmdk-empty">Sin resultados</div>}
        </div>
      </div>
    </div>
  );
}
