import { listAdMap } from "@/lib/queries";
import { getProducts } from "@/lib/ai/data";
import { getAnunciosAnalisis, type AnunciosResumen } from "@/lib/meta-ads";
import { AnunciosUI } from "./anuncios-ui";
import { MetaAnalisis } from "./meta-analisis";

export const dynamic = "force-dynamic";

const FB: AnunciosResumen = { ok: false, error: "Meta tardó demasiado, recarga.", gastoTotal: 0, ventasTotal: 0, roasGlobal: 0, anuncios: [], mejor: null, peor: null };
function conTope<T>(p: Promise<T>, ms: number, fb: T): Promise<T> {
  return Promise.race([p.catch(() => fb), new Promise<T>((r) => setTimeout(() => r(fb), ms))]);
}

export default async function AnunciosPage({ searchParams }: { searchParams: Promise<{ rango?: string }> }) {
  const { rango = "last_30d" } = await searchParams;
  const [mapeos, productos, analisis] = await Promise.all([
    listAdMap(),
    getProducts(),
    conTope(getAnunciosAnalisis(rango), 25000, FB),
  ]);
  return (
    <>
      <MetaAnalisis a={analisis} rango={rango} />
      <AnunciosUI mapeos={mapeos} productos={productos.map((p) => ({ slug: p.slug, name: p.name }))} />
    </>
  );
}
