"use server";

/* ===========================================================
   Reseñas de la landing /gallos -> reutiliza la infra existente
   de la plataforma (tabla `reviews` en Postgres/Drizzle):
   - lectura:  getReviews(slug)        (lib/reviews)
   - escritura: addReview({slug,...})  (app/order-actions, autopublica)
   No se crea una tabla nueva: se aprovecha la moderación que ya
   existe en el panel /resenas.
   =========================================================== */
import { getReviews, type Review } from "@/lib/reviews";
import { addReview } from "@/app/order-actions";

// Las reseñas de la landing se asocian al producto estrella; se muestran
// las de ambos productos para enriquecer la prueba social.
const READ_SLUGS = ["american-rooster-fury", "dragon-mamba"] as const;
const WRITE_SLUG = "american-rooster-fury";

/** Forma que consume la landing (igual a `Review` en _lib/types). */
export type GallosReview = {
  name: string;
  role: string;
  city: string;
  rating: number;
  comment: string;
};

function toGallos(r: Pick<Review, "nombre" | "ciudad" | "rating" | "texto">): GallosReview {
  return {
    name: r.nombre,
    role: "Cliente verificado",
    city: r.ciudad || "",
    rating: r.rating || 5,
    comment: r.texto,
  };
}

/** Reseñas aprobadas (de ambos productos), más recientes primero. */
export async function listGallosReviews(): Promise<GallosReview[]> {
  const lists = await Promise.all(READ_SLUGS.map((s) => getReviews(s, 30)));
  const merged = lists
    .flat()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return merged.map(toGallos);
}

/** Publica una reseña desde la landing (autopublicada, moderable en el panel). */
export async function submitGallosReview(input: {
  nombre: string;
  ciudad?: string;
  rating: number;
  texto: string;
}): Promise<{ ok: true; review: GallosReview } | { ok: false; error: string }> {
  const res = await addReview({
    slug: WRITE_SLUG,
    nombre: input.nombre,
    ciudad: input.ciudad || "",
    rating: input.rating,
    texto: input.texto,
  });
  if (!res.ok) return res;
  return { ok: true, review: toGallos(res.review) };
}
