"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell, Store, LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/productos": "Productos",
  "/pedidos": "Pedidos",
  "/clientes": "Clientes",
  "/conversaciones": "Conversaciones",
  "/promociones": "Promociones",
  "/asesores": "Asesores",
  "/configuracion": "Configuración",
};

export function AdminTopbar() {
  const path = usePathname();
  const key = Object.keys(TITLES).find((k) => path.startsWith(k)) || "/dashboard";
  const title = TITLES[key];
  return (
    <header className="topbar">
      <div className="crumb">
        <span className="root">Animals Deluxe</span>
        <span className="sep">/</span>
        <b>{title}</b>
      </div>
      <div className="sp" />
      <div className="tsearch">
        <Search size={16} />
        <input placeholder={`Buscar en ${title.toLowerCase()}…`} aria-label="Buscar" />
      </div>
      <button className="tbtn" title="Notificaciones"><Bell size={18} /><span className="dot" /></button>
      <Link href="/" target="_blank" className="primary"><Store size={16} /> <span>Ver tienda</span></Link>
      <div className="avatar" title="Animals Deluxe">AD</div>
      <form action={logout}><button type="submit" className="logout" title="Salir"><LogOut size={17} /></button></form>
    </header>
  );
}
