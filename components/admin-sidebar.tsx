"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Package, ShoppingBag, Users, MessageSquare,
  BadgePercent, Headphones, Settings, Search, Store, ArrowUpRight, Star,
} from "lucide-react";

const GROUPS: { label: string; items: { href: string; label: string; icon: any }[] }[] = [
  {
    label: "Principal",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { href: "/productos", label: "Productos", icon: Package },
      { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
      { href: "/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/conversaciones", label: "Conversaciones", icon: MessageSquare },
      { href: "/resenas", label: "Reseñas", icon: Star },
      { href: "/promociones", label: "Promociones", icon: BadgePercent },
      { href: "/asesores", label: "Asesores", icon: Headphones },
      { href: "/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

export function AdminSidebar() {
  const path = usePathname();
  return (
    <aside className="sb">
      <Link href="/dashboard" className="brand">
        <img className="mk-img" src="/brand/logo.png" alt="Animals Deluxe" /> <b>Animals Deluxe</b>
      </Link>
      <div className="search"><Search size={16} /> <span>Buscar…</span> <span className="kbd">⌘K</span></div>

      {GROUPS.map((g) => (
        <div key={g.label}>
          <div className="seclabel">{g.label}</div>
          <nav className="nav">
            {g.items.map((it) => {
              const on = path.startsWith(it.href);
              return (
                <Link key={it.href} href={it.href} className={`item ${on ? "on" : ""}`}>
                  <it.icon size={18} /> <span>{it.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}

      <div className="promo">
        <h4>🛍️ Ver tu tienda</h4>
        <p>Mira cómo la ven tus clientes y comparte el enlace.</p>
        <Link href="/" target="_blank"><Store size={14} /> Abrir tienda <ArrowUpRight size={14} /></Link>
      </div>
    </aside>
  );
}
