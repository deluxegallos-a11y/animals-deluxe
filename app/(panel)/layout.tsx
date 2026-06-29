import "../admin.css";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { demoMode } from "@/lib/auth";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="adm">
      <AdminSidebar />
      <div className="main">
        <AdminTopbar />
        <div className="content">
          {demoMode() ? (
            <div className="demo-banner">
              🧪 Modo demo — sin Supabase conectado. Los datos son del catálogo semilla y las escrituras no se guardan. Configura <code>.env.local</code> para activar la base de datos real.
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
