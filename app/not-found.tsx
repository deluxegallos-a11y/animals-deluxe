import Link from "next/link";

export default function NotFound() {
  return (
    <div className="state-screen">
      <div className="state-card">
        <div className="state-emoji">🐓</div>
        <h2>Página no encontrada</h2>
        <p>Lo que buscas se fue de careo. Volvamos al catálogo.</p>
        <Link className="btn" href="/">Ir a la tienda</Link>
      </div>
    </div>
  );
}
