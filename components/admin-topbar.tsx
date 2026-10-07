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

/** Identidad de la MARCA activa en el panel. Viene del tenant del usuario logueado
 *  (lib/tenant-panel.ts), NUNCA hardcodeada: el admin de Rooster Deluxe veía
 *  "Animals Deluxe" en la esquina y eso es justo lo que confunde al despachar. */
export type MarcaPanel = { nombre: string; slug: string; anticipado: boolean };

/** Iniciales de la marca para el avatar ("Animals Deluxe" → "AD"). */
function iniciales(nombre: string): string {
  const w = nombre.trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || "") + (w[1]?.[0] || "")).toUpperCase() || "AD";
}

export function AdminTopbar({ marca }: { marca?: MarcaPanel }) {
  const path = usePathname();
  const nombre = marca?.nombre || "Animals Deluxe";
  const anticipado = !!marca?.anticipado;
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
        <span className={"marca-tag" + (anticipado ? " antic" : "")} title={anticipado ? "Esta marca cobra por adelantado" : "Esta marca cobra al recibir"}>
          {anticipado ? "PAGO ANTICIPADO" : "CONTRA ENTREGA"}
        </span>
        <div className="mepill" title={nombre}>
          <div className="av">{iniciales(nombre)}</div>
          <div><b>{nombre}</b><small>Admin</small></div>
        </div>
        <form action={logout}><button type="submit" className="ticon danger" title="Salir"><LogOut size={16} /></button></form>
      </div>
      <CommandPalette />
    </header>
  );
}
