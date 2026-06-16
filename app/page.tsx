import Link from "next/link";
import { getProducts, getCategories, getStoreConfig } from "@/lib/ai/data";
import { cop, flag } from "@/lib/ai/format";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const [cats, productos, store] = await Promise.all([
    getCategories(),
    getProducts({ categorySlug: cat }),
    getStoreConfig(),
  ]);
  const wa = (store.whatsapp || "").replace(/\D/g, "");

  return (
    <>
      <nav className="store-nav">
        <Link href="/" className="logo">
          <span className="mark">🐓</span> Animals Deluxe
        </Link>
        {wa ? (
          <a className="wa" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
            💬 Pedir por WhatsApp
          </a>
        ) : null}
      </nav>

      <header className="hero">
        <span className="kick">Contraentrega en toda Colombia · Pagas al recibir</span>
        <h1>Suplementos premium para tus campeones</h1>
        <p>Energía, vitaminas, respiratorio y cuidado para gallos, pollos, perros y caballos. Fórmulas originales, resultados de combate.</p>
        <div className="badges">
          <span>🇺🇸 Fórmulas importadas</span>
          <span>🚚 Envío contraentrega</span>
          <span>🔥 {productos.length}+ productos</span>
        </div>
      </header>

      <main className="store-wrap">
        <div className="cat-chips">
          <Link href="/" className={`cat-chip ${!cat ? "on" : ""}`}>Todo</Link>
          {cats.map((c) => (
            <Link key={c.slug} href={`/?cat=${c.slug}`} className={`cat-chip ${cat === c.slug ? "on" : ""}`}>
              {c.name}
            </Link>
          ))}
        </div>

        <div className="shop-grid">
          {productos.map((p) => (
            <Link key={p.slug} href={`/producto/${p.slug}`} className="pcard">
              <div className="ph">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <span>🐓</span>}
                <span className="flag">{flag(p.origin)}</span>
              </div>
              <div className="body">
                <span className="cat">{p.categoryName}</span>
                <h3>{p.name}</h3>
                <span className="tag">{p.tagline || p.shortDesc}</span>
                <div className="foot">
                  <span className="price">{cop(p.priceCOP)}</span>
                  <span className="go">Ver →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {productos.length === 0 ? (
          <div className="empty"><div className="ico">🐓</div><h4>Sin productos en esta categoría</h4></div>
        ) : null}
      </main>

      <footer className="store-foot">
        Animals Deluxe · Suplementos de bienestar y rendimiento. No curan enfermedades. · Contraentrega en Colombia 🇨🇴
      </footer>
    </>
  );
}
