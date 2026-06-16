import { Navbar } from "@/components/navbar";
import { demoMode } from "@/lib/auth";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Navbar />
      {demoMode() ? (
        <div className="demo-banner">
          🧪 Modo demo — sin Supabase conectado. Los datos son del catálogo semilla y las escrituras no se guardan. Configura <code>.env.local</code> para activar la base de datos real.
        </div>
      ) : null}
      {children}
    </div>
  );
}
