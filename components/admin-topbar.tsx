"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Store, LogOut, ChevronRight } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { ThemeToggle, CommandPalette } from "@/components/admin-tools";

function openPalette() { window.dispatchEvent(new Event("adm-open-cmdk")); }

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard", "/productos": "Productos", "/pedidos": "Pedidos", "/livechat": "Live Chat",
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
  const detalle = path !== key && path.startsWith(key + "/");
  return (
    <header className="top">
      <nav className="migas" aria-label="Ubicación">
        <span>{nombre}</span>
        <ChevronRight size={14} aria-hidden />
        {detalle ? <><Link href={key}>{title}</Link><ChevronRight size={14} aria-hidden /><b>Detalle</b></> : <b>{title}</b>}
      </nav>
      <div className="tr">
        <button className="t-buscar" onClick={openPalette} title="Buscar o ir a (⌘K)">
          <Search size={16} /> <span>Buscar o ir a…</span> <kbd>⌘K</kbd>
        </button>
        <ThemeToggle />
        <Link href="/" target="_blank" className="ticon" title="Ver tienda" aria-label="Ver tienda"><Store size={17} /></Link>
        <span className={"marca-tag" + (anticipado ? " antic" : "")} title={anticipado ? "Esta marca cobra por adelantado" : "Esta marca cobra al recibir"}>
          <i aria-hidden />{anticipado ? "Pago anticipado" : "Contra entrega"}
        </span>
        <div className="mepill" title={nombre}>
          <div className="av">{iniciales(nombre)}</div>
          <div><b>{nombre}</b><small>Admin</small></div>
        </div>
        <form action={logout}><button type="submit" className="ticon danger" title="Salir" aria-label="Salir"><LogOut size={16} /></button></form>
      </div>
      <CommandPalette />
    </header>
  );
}
