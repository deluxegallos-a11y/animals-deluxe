"use client";

/* Neo AI · la IA que vende por WhatsApp. Identidad oficial (la misma de Motos
   Colombia): halcón negro con neón verde, logo «NEO AI» plata y verde.
   Assets en public/brand/neo/. El panel conserva su azul para las acciones;
   todo lo que hace Neo AI se firma en negro + verde. Estilos en app/neo.css. */
import { useEffect, useState } from "react";

/** Cara del halcón en círculo, con aro verde neón. */
export function CaraNeo({ tamano = 28, className = "" }: { tamano?: number; className?: string }) {
  return (
    <span className={`neo-cara ${className}`} style={{ width: tamano, height: tamano }} aria-hidden>
      <img src="/brand/neo/neo-avatar.webp" alt="" width={tamano} height={tamano} loading="lazy" decoding="async" />
    </span>
  );
}

/** Punto «en vivo» con latido verde. */
export function EnVivo({ texto = "en vivo", className = "" }: { texto?: string; className?: string }) {
  return <span className={`neo-vivo ${className}`}><i aria-hidden />{texto}</span>;
}

/** «Neo AI está escribiendo…» con tres puntos verdes que saltan. */
export function NeoEscribiendo({ texto = "Neo AI está escribiendo" }: { texto?: string }) {
  return (
    <div className="neo-escribe" role="status" aria-live="polite">
      <CaraNeo tamano={20} />
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
  return <p className={`neo-powered ${className}`}><CaraNeo tamano={16} /><span>Powered by <b>Neo AI</b></span></p>;
}

/** Pantalla de entrada del Live Chat: logo de Neo AI con halo verde que respira.
 *  Mínimo 1,6 s para que luzca, se va con desvanecido; tope de 3,5 s. */
export function InicioNeo({ marca = "Animals Deluxe" }: { marca?: string }) {
  const [fase, setFase] = useState<"visible" | "saliendo" | "fuera">("visible");
  useEffect(() => {
    const inicio = performance.now();
    let salida: ReturnType<typeof setTimeout> | undefined;
    let fin: ReturnType<typeof setTimeout> | undefined;
    const quitar = () => {
      if (salida) return;
      const falta = Math.max(0, 1600 - (performance.now() - inicio));
      salida = setTimeout(() => { setFase("saliendo"); fin = setTimeout(() => setFase("fuera"), 600); }, falta);
    };
    if (document.readyState === "complete") quitar();
    else window.addEventListener("load", quitar, { once: true });
    const tope = setTimeout(quitar, 3500);
    return () => {
      window.removeEventListener("load", quitar);
      clearTimeout(tope);
      if (salida) clearTimeout(salida);
      if (fin) clearTimeout(fin);
    };
  }, []);
  if (fase === "fuera") return null;
  return (
    <div className={`neo-inicio${fase === "saliendo" ? " is-saliendo" : ""}`} role="status" aria-live="polite">
      <div className="neo-inicio-halo" aria-hidden />
      <div className="neo-inicio-centro">
        <div className="neo-inicio-logo"><img src="/brand/neo/neo-logo.webp" alt="Neo AI" width={360} height={300} /></div>
        <p className="neo-inicio-texto">Preparando tus chats…</p>
        <div className="neo-inicio-barra" aria-hidden><span /></div>
      </div>
      <p className="neo-inicio-pie">Live Chat · {marca} · Powered by <b>Neo AI</b></p>
    </div>
  );
}
