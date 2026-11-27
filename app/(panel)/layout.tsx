import "../admin.css";
import "../neo.css";
import { Inter, Geist_Mono } from "next/font/google";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar, type MarcaPanel } from "@/components/admin-topbar";
import { demoMode } from "@/lib/auth";
import { getPanelTenant } from "@/lib/tenant-panel";

// Sistema visual «Neo AI Pro» (docs/diseno-neo/prompt-maestro.md): Inter para la UI,
// Geist Mono para antetítulos, encabezados de tabla y teclas.
const inter = Inter({ subsets: ["latin"], variable: "--font-neo", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-neo-mono", display: "swap" });

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
    <script dangerouslySetInnerHTML={{ __html: `try{var d=document.documentElement;if(localStorage.getItem('adm-theme')==='dark')d.setAttribute('data-theme','dark');if(localStorage.getItem('adm-riel')==='1')d.setAttribute('data-riel','1')}catch(e){}` }} />
    <div className={`adm neo ${inter.variable} ${mono.variable}`}>
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
