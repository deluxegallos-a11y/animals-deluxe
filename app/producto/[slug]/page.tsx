import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, getStoreConfig } from "@/lib/ai/data";
import { cop, flag } from "@/lib/ai/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Producto no encontrado · Animals Deluxe" };
  return {
    title: `${p.name} · Animals Deluxe`,
    description: p.shortDesc || p.tagline,
    openGraph: { title: p.name, description: p.tagline || p.shortDesc, images: p.imageUrl ? [p.imageUrl] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, store] = await Promise.all([getProductBySlug(slug), getStoreConfig()]);
  if (!p) notFound();

  const wa = (store.whatsapp || "").replace(/\D/g, "");
  const msg = `Hola Animals Deluxe 🐓, quiero pedir *${p.name}* (${cop(p.priceCOP)}). ¿Me ayudan?`;
  const waLink = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(msg)}` : "";

  return (
    <>
      <nav className="store-nav">
        <Link href="/" className="logo"><span className="mark">🐓</span> Animals Deluxe</Link>
        {waLink ? <a className="wa" href={waLink} target="_blank" rel="noreferrer">💬 Pedir</a> : null}
      </nav>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "16px 26px 0" }}>
        <Link href="/" style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>← Volver al catálogo</Link>
      </div>

      <main className="pdp">
        <div>
          <div className="pdp-img">{p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <span>🐓</span>}</div>
        </div>
        <div>
          <div className="cat">{flag(p.origin)} {p.categoryName} · {p.audience}</div>
          <h1>{p.name}</h1>
          <p className="tagline">{p.tagline || p.shortDesc}</p>

          <div className="pricebar">
            <span className="big">{cop(p.priceCOP)}</span>
            <span className="chip">Contraentrega · pagas al recibir</span>
          </div>

          {p.badges.length ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {p.badges.map((b) => <span key={b} className="badge-mini">{b}</span>)}
            </div>
          ) : null}

          {p.presentations.length ? (
            <div className="pres">
              {p.presentations.map((pr) => (
                <b key={pr.label}>{cop(pr.priceCOP)}<small>{pr.label}</small></b>
              ))}
            </div>
          ) : null}

          {p.shortDesc ? <div className="block">{p.shortDesc}</div> : null}

          {p.benefits.length ? (
            <ul className="benf">{p.benefits.map((b) => <li key={b}>{b}</li>)}</ul>
          ) : null}

          {p.usage ? <div className="block"><h4>Modo de uso</h4>{p.usage}</div> : null}
          {p.pitch ? <div className="block"><h4>Por qué funciona</h4>{p.pitch}</div> : null}

          {waLink ? (
            <a className="wa-btn" href={waLink} target="_blank" rel="noreferrer">💬 Pedir por WhatsApp</a>
          ) : (
            <div className="block">Configura el WhatsApp de la tienda para habilitar el botón de pedido.</div>
          )}
          <p className="disc">{p.disclaimer || "Producto de bienestar y rendimiento. No cura enfermedades."}</p>
        </div>
      </main>
      <footer className="store-foot">Animals Deluxe · Contraentrega en Colombia 🇨🇴</footer>
    </>
  );
}
