import "../admin.css";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar, type MarcaPanel } from "@/components/admin-topbar";
import { demoMode } from "@/lib/auth";
import { getPanelTenant } from "@/lib/tenant-panel";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // MARCA activa del panel (M-CERO). El panel ya aísla los datos por tenant; esto
  // hace VISIBLE de qué negocio son, para que el asesor no confunda un pedido
  // contra entrega con uno de pago anticipado al despachar.
  const t = await getPanelTenant();
  const marca: MarcaPanel = {
    nombre: t?.nombre || "Animals Deluxe",
    slug: t?.slug || "animals-deluxe",
    anticipado: t?.paymentMode === "anticipado",
  };
  return (
    <>
    <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('adm-theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}` }} />
    <div className="adm">
      <AdminSidebar />
      <div className="main">
        <AdminTopbar marca={marca} />
        <div className="content">
          {demoMode() ? (
            <div className="demo-banner">
              🧪 Modo demo — sin Supabase conectado. Los datos son del catálogo semilla y las escrituras no se guardan. Configura <code>.env.local</code> para activar la base de datos real.
            </div>
          ) : null}
          {marca.anticipado ? (
            <div className="marca-banner antic">
              💳 <b>{marca.nombre}</b> — venta con <b>PAGO ANTICIPADO</b>. Verificá el comprobante antes de despachar. Este panel NO muestra datos de la otra marca.
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
    </>
  );
}
