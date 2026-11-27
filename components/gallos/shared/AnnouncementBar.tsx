/* Banner superior tipo marquee (cinta giratoria) compartido por las tres
   landings (gallos / caballos / perros). Sticky arriba, texto desplazándose
   en bucle infinito. Estilos en app/globals.css (.ann-*). */

const MESSAGES = [
  "Pago contra entrega en todo el país",
  "Envío rápido a toda Colombia",
  "Entrega inmediata en Medellín",
  "Producto 100% original",
  "Atención personalizada por WhatsApp",
];

function Group({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div className="ann-group" aria-hidden={ariaHidden || undefined}>
      {MESSAGES.map((msg, i) => (
        <span className="ann-item" key={i}>
          <span className="ann-sep">✦</span>
          {msg}
        </span>
      ))}
    </div>
  );
}

export function AnnouncementBar() {
  return (
    <div className="ann-bar" role="region" aria-label="Información de envíos y pagos">
      <div className="ann-viewport">
        <div className="ann-track">
          {/* Dos grupos idénticos: el bucle desplaza exactamente un grupo. */}
          <Group />
          <Group ariaHidden />
        </div>
      </div>
    </div>
  );
}
