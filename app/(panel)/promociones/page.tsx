import { listPromotions, listProducts } from "@/lib/queries";
import { PromosUI } from "./promos-ui";

export const dynamic = "force-dynamic";

export default async function PromocionesPage() {
  const [promos, productos] = await Promise.all([listPromotions(), listProducts()]);
  return (
    <PromosUI
      promos={promos.map((p) => ({
        id: p.id, titulo: p.titulo, descripcion: p.descripcion || "",
        precioPromoCop: p.precioPromoCop ?? 0, precioAntesCop: p.precioAntesCop ?? 0,
        imagenUrl: p.imagenUrl || "", activa: p.activa ?? true, orden: p.orden ?? 0,
        productId: p.productId || "",
      }))}
      productos={productos.map((p) => ({ slug: p.slug, name: p.name }))}
    />
  );
}
