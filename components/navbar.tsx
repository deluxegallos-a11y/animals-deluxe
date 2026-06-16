"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/(auth)/actions";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/productos", label: "Productos" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/clientes", label: "Clientes" },
  { href: "/conversaciones", label: "Conversaciones" },
  { href: "/promociones", label: "Promociones" },
  { href: "/asesores", label: "Asesores" },
  { href: "/configuracion", label: "Configuración" },
];

export function Navbar() {
  const path = usePathname();
  return (
    <nav className="nav">
      <Link href="/dashboard" className="brand">
        <span className="mark">🐓</span> Animals Deluxe
      </Link>
      <div className="nav-links">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? "active" : ""}>
            {l.label}
          </Link>
        ))}
      </div>
      <div className="nav-right">
        <Link href="/" className="iconbtn" title="Ver tienda">🛍️</Link>
        <form action={logout}>
          <button type="submit" className="logout" title="Salir">⎋</button>
        </form>
      </div>
    </nav>
  );
}
