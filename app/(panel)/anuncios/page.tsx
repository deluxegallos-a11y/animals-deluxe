import { listAdMap } from "@/lib/queries";
import { getProducts } from "@/lib/ai/data";
import { AnunciosUI } from "./anuncios-ui";

export const dynamic = "force-dynamic";

export default async function AnunciosPage() {
  const [mapeos, productos] = await Promise.all([listAdMap(), getProducts()]);
  return (
    <AnunciosUI
      mapeos={mapeos}
      productos={productos.map((p) => ({ slug: p.slug, name: p.name }))}
    />
  );
}
