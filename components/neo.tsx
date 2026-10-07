/* Neo AI · la persona de la IA que vende por WhatsApp (sistema visual de
   Tienda Core / Motos Colombia). Todo en SVG/CSS: sin imágenes, hereda el color.
   Estilos en app/neo.css (.neo-cara, .neo-vivo, .neo-escribe, .neo-powered). */

/** Cara de puntos: anillo + ojos cuadrados que parpadean + boca de puntos. */
export function CaraNeo({ tamano = 28, className = "" }: { tamano?: number; className?: string }) {
  const puntos = Array.from({ length: 26 }, (_, i) => {
    const a = (i / 26) * Math.PI * 2;
    return { x: 50 + Math.cos(a) * 42, y: 50 + Math.sin(a) * 42, o: 0.35 + 0.65 * Math.abs(Math.sin(a * 1.5)) };
  });
  return (
    <span className={`neo-cara ${className}`} style={{ width: tamano, height: tamano }} aria-hidden>
      <svg viewBox="0 0 100 100" width={tamano} height={tamano}>
        {puntos.map((p, i) => <circle key={i} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="3.4" opacity={p.o.toFixed(2)} />)}
        <g className="neo-ojos">
          <rect x="31" y="36" width="12" height="15" rx="3" />
          <rect x="57" y="36" width="12" height="15" rx="3" />
        </g>
        {[40, 50, 60].map((x) => <circle key={x} cx={x} cy="66" r="3" opacity=".8" />)}
      </svg>
    </span>
  );
}

/** Punto «en vivo» con latido. */
export function EnVivo({ texto = "en vivo", className = "" }: { texto?: string; className?: string }) {
  return <span className={`neo-vivo ${className}`}><i aria-hidden />{texto}</span>;
}

/** «Neo AI está escribiendo…» con tres puntos que saltan. */
export function NeoEscribiendo({ texto = "Neo AI está escribiendo" }: { texto?: string }) {
  return (
    <div className="neo-escribe" role="status" aria-live="polite">
      <CaraNeo tamano={18} />
      <span className="neo-escribe-burbuja" aria-hidden><i /><i /><i /></span>
      <span className="neo-escribe-txt">{texto}…</span>
    </div>
  );
}

/** Chip «Neo AI» que firma lo que hizo la IA. */
export function FirmaNeo({ texto = "Neo AI" }: { texto?: string }) {
  return <span className="neo-firma"><CaraNeo tamano={16} />{texto}</span>;
}

export function PoweredNeo({ className = "" }: { className?: string }) {
  return <p className={`neo-powered ${className}`}><CaraNeo tamano={14} /><span>Powered by <b>Neo AI</b></span></p>;
}
