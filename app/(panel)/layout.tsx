import { Navbar } from "@/components/navbar";
import { Spotlight } from "@/components/store/bolts";
import { demoMode } from "@/lib/auth";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ad-panel">
      <div className="panelfx" aria-hidden>
        <span className="pg" /><span className="pa a1" /><span className="pa a2" />
        <span className="pbeam b1" /><span className="pbeam b2" />
      </div>
      <Spotlight />
      <div className="shell">
        <Navbar />
        {demoMode() ? (
          <div className="demo-banner">
            🧪 Modo demo — sin Supabase conectado. Los datos son del catálogo semilla y las escrituras no se guardan. Configura <code>.env.local</code> para activar la base de datos real.
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
