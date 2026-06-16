import * as React from "react";

/* ---------- Card ---------- */
export function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  );
}

export function CardHead({
  icon,
  iconBg = "bg-pri",
  title,
  right,
}: {
  icon?: string;
  iconBg?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="card-h">
      <div className="t">
        {icon ? <span className={`ic ${iconBg}`}>{icon}</span> : null}
        {title}
      </div>
      {right ?? <span className="dots">⋯</span>}
    </div>
  );
}

/* ---------- Tag ---------- */
type TagVariant = "ok" | "pend" | "fail" | "blue";
export function Tag({
  variant,
  children,
  small,
}: {
  variant: TagVariant;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <span className={`tag ${variant}`} style={small ? { fontSize: 10 } : undefined}>
      {children}
    </span>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({
  initials,
  bg = "bg-pri",
  size = "coin",
}: {
  initials: string;
  bg?: string;
  size?: "coin" | "av-sm";
}) {
  return <div className={`${size} ${bg}`}>{initials}</div>;
}

/* ---------- Segmented toggle (client) ---------- */
export function Seg({ options, active = 0 }: { options: string[]; active?: number }) {
  return (
    <div className="seg">
      {options.map((o, i) => (
        <button key={o} className={i === active ? "on" : ""}>
          {o}
        </button>
      ))}
    </div>
  );
}

/* ---------- Change pill ---------- */
export function Chg({ up, children }: { up: boolean; children: React.ReactNode }) {
  return <span className={`chg ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {children}</span>;
}

/* ---------- Charts (inline SVG, sin dependencias) ---------- */
export function Sparkline() {
  return (
    <svg viewBox="0 0 320 70" style={{ width: "100%", height: 62, marginTop: 10 }}>
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2F6BFF" stopOpacity=".25" />
          <stop offset="1" stopColor="#2F6BFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,52 C30,48 50,30 80,34 C115,39 130,18 165,22 C200,26 220,40 250,30 C280,21 300,16 320,12"
        fill="none"
        stroke="#2F6BFF"
        strokeWidth="2.5"
      />
      <path
        d="M0,52 C30,48 50,30 80,34 C115,39 130,18 165,22 C200,26 220,40 250,30 C280,21 300,16 320,12 L320,70 L0,70 Z"
        fill="url(#spark)"
      />
    </svg>
  );
}

export function Gauge() {
  return (
    <svg width="200" height="120" viewBox="0 0 200 120">
      <path d="M20,110 A80,80 0 0 1 180,110" fill="none" stroke="#EAEEF5" strokeWidth="18" strokeLinecap="round" />
      <path d="M20,110 A80,80 0 0 1 158,62" fill="none" stroke="url(#gg)" strokeWidth="18" strokeLinecap="round" />
      <defs>
        <linearGradient id="gg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5C8BFF" />
          <stop offset="1" stopColor="#1E50E6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function FunnelChart() {
  return (
    <svg viewBox="0 0 460 170" style={{ width: "100%", height: 170 }}>
      <g stroke="#F0F3F9" strokeWidth="1">
        <line x1="0" y1="30" x2="460" y2="30" />
        <line x1="0" y1="70" x2="460" y2="70" />
        <line x1="0" y1="110" x2="460" y2="110" />
        <line x1="0" y1="150" x2="460" y2="150" />
      </g>
      <path d="M0,40 C70,36 100,55 150,52 C210,48 240,70 300,66 C360,62 400,44 460,40" fill="none" stroke="#2F6BFF" strokeWidth="3" />
      <path d="M0,95 C70,92 110,105 160,104 C220,103 250,120 310,118 C370,116 410,104 460,100" fill="none" stroke="#16C784" strokeWidth="3" />
      <path d="M0,135 C80,134 120,140 170,140 C230,140 260,148 320,147 C380,146 410,140 460,138" fill="none" stroke="#FFB020" strokeWidth="3" />
      <circle cx="300" cy="66" r="4" fill="#2F6BFF" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

/* ---------- Page header ---------- */
export function PageHead({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {right}
    </div>
  );
}
