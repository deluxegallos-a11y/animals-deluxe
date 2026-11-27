import { Spotlight } from "@/components/store/bolts";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ad-panel auth-stage">
      <div className="panelfx" aria-hidden>
        <span className="pg" /><span className="pa a1" /><span className="pa a2" />
        <span className="pbeam b1" /><span className="pbeam b2" />
      </div>
      <Spotlight />
      <div className="auth-wrap">
        <img className="auth-rooster" src="/mascots/rooster-king.png" alt="" aria-hidden />
        {children}
      </div>
    </div>
  );
}
