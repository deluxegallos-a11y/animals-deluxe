"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell, Store, LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { ThemeToggle, CommandPalette } from "@/components/admin-tools";

function openPalette() { window.dispatchEvent(new Event("adm-open-cmdk")); }

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard", "/productos": "Productos", "/pedidos": "Pedidos",
  "/clientes": "Clientes", "/conversaciones": "Conversaciones", "/anuncios": "Anuncios",
  "/promociones": "Promociones", "/resenas": "Reseñas", "/asesores": "Asesores", "/configuracion": "Configuración",
};

export function AdminTopbar() {
  const path = usePathname();
  const key = Object.keys(TITLES).find((k) => path.startsWith(k)) || "/dashboard";
  const title = TITLES[key];
  return (
    <header className="top">
      <div className="pagetitle">Hola, Victor 👋</div>
      <div className="crumbtag">{title}</div>
      <div className="tr">
        <button className="ticon" title="Buscar / ir a (⌘K)" onClick={openPalette}><Search size={17} /></button>
        <ThemeToggle />
        <button className="ticon" title="Notificaciones"><Bell size={17} /><span className="dot" /></button>
        <Link href="/" target="_blank" className="plat blue" title="Ver tienda"><Store size={15} /> <span>Ver tienda</span></Link>
        <div className="mepill" title="Animals Deluxe">
          <div className="av">AD</div>
          <div><b>Animals Deluxe</b><small>Admin</small></div>
        </div>
        <form action={logout}><button type="submit" className="ticon danger" title="Salir"><LogOut size={16} /></button></form>
      </div>
      <CommandPalette />
    </header>
  );
}
