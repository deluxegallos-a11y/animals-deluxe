"use client";

/* Barra lateral «Neo AI Pro»: cápsula de vidrio flotante que se colapsa a un riel
   de 92px (recordado en localStorage «adm-riel»). Ver docs/diseno-neo/prompt-maestro.md. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Package, ShoppingBag, Users, MessageSquare, MessagesSquare,
  BadgePercent, Headphones, Settings, Search, Store, ArrowUpRight, Star, Megaphone, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { CaraNeo, EnVivo } from "@/components/neo";

type Item = { href: string; label: string; icon: typeof LayoutGrid; neo?: boolean };
const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Vender",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
      { href: "/livechat", label: "Live Chat", icon: MessagesSquare, neo: true },
      { href: "/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    label: "Catálogo y marketing",
    items: [
      { href: "/productos", label: "Productos", icon: Package },
      { href: "/anuncios", label: "Anuncios", icon: Megaphone },
      { href: "/promociones", label: "Promociones", icon: BadgePercent },
      { href: "/resenas", label: "Reseñas", icon: Star },
    ],
  },
  {
    label: "Equipo",
    items: [
      { href: "/conversaciones", label: "Conversaciones", icon: MessageSquare },
      { href: "/asesores", label: "Asesores", icon: Headphones },
      { href: "/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

function abrirBuscador() { window.dispatchEvent(new Event("adm-open-cmdk")); }

export function AdminSidebar() {
  const path = usePathname();
  const [riel, setRiel] = useState(false);
  useEffect(() => {
    // El script del layout ya puso html[data-riel] antes de pintar (sin parpadeo).
    setRiel(document.documentElement.getAttribute("data-riel") === "1");
  }, []);
  function alternar() {
    const nuevo = !riel;
    setRiel(nuevo);
    if (nuevo) document.documentElement.setAttribute("data-riel", "1");
    else document.documentElement.removeAttribute("data-riel");
    try { localStorage.setItem("adm-riel", nuevo ? "1" : "0"); } catch { /* sin storage */ }
  }

  return (
    <aside className="sb" aria-label="Navegación del panel">
      <div className="sb-cab">
        <Link href="/dashboard" className="brand" title="Animals Deluxe">
          <img className="mk-img" src="/brand/logo.png" alt="" /> <b>Animals Deluxe</b>
        </Link>
        <button className="sb-plegar" onClick={alternar} title={riel ? "Expandir menú" : "Contraer menú"} aria-label={riel ? "Expandir menú" : "Contraer menú"}>
          {riel ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      <button className="search" onClick={abrirBuscador} title="Buscar (⌘K)">
        <Search size={16} /> <span>Buscar…</span> <span className="kbd">⌘K</span>
      </button>

      <nav className="sb-nav">
        {GROUPS.map((g) => (
          <div key={g.label} className="sb-grupo">
            <div className="seclabel">{g.label}</div>
            <div className="nav">
              {g.items.map((it) => {
                const on = path === it.href || path.startsWith(it.href + "/");
                return (
                  <Link key={it.href} href={it.href} className={`item ${on ? "on" : ""}`} title={riel ? it.label : undefined} aria-current={on ? "page" : undefined}>
                    <span className="sb-ico"><it.icon size={18} /></span>
                    <span className="sb-txt">{it.label}</span>
                    {it.neo ? <span className="sb-neo" title="Atendido por Neo AI"><CaraNeo tamano={16} /></span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="sb-pie">
        <Link href="/livechat" className="neo-tarjeta" title="Neo AI está atendiendo WhatsApp">
          <CaraNeo tamano={34} />
          <div className="neo-tarjeta-txt">
            <b>Neo AI</b>
            <EnVivo texto="vendiendo en WhatsApp" />
          </div>
        </Link>
        <Link href="/" target="_blank" className="sb-tienda" title="Abrir la tienda">
          <Store size={15} /> <span className="sb-txt">Ver tienda</span> <ArrowUpRight size={14} className="sb-txt" />
        </Link>
      </div>
    </aside>
  );
}
