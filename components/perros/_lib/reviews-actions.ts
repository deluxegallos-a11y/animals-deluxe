"use server";

/* ===========================================================
   Reseñas de la landing /perros -> reutiliza la MISMA infra
   de la plataforma (tabla `reviews` en Postgres/Drizzle), igual
   que /gallos y /caballos pero filtrando por el producto
   "more-muscle-dogs".
   - lectura:  getReviews("more-muscle-dogs")   (lib/reviews)
   - escritura: addReview({slug:"more-muscle-dogs",...})  (autopublica,
     moderable en el panel /resenas)
   =========================================================== */
import { getReviews, type Review } from "@/lib/reviews";
import { addReview } from "@/app/order-actions";

const DOG_SLUG = "more-muscle-dogs";

/** Forma que consume la landing (igual a `Review` en _lib/types). */
export type DogReview = {
  name: string;
  role: string;
  city: string;
  rating: number;
  comment: string;
};

function toDog(
  r: Pick<Review, "nombre" | "ciudad" | "rating" | "texto">,
): DogReview {
  return {
    name: r.nombre,
    role: "Cliente verificado",
    city: r.ciudad || "",
    rating: r.rating || 5,
    comment: r.texto,
  };
}

/** Reseñas aprobadas de More Muscle Dogs, más recientes primero. */
export async function listDogReviews(): Promise<DogReview[]> {
  const rows = await getReviews(DOG_SLUG, 30);
  return rows.map(toDog);
}

/** Publica una reseña desde la landing (autopublicada, moderable en el panel). */
export async function submitDogReview(input: {
  nombre: string;
  ciudad?: string;
  rating: number;
  texto: string;
}): Promise<{ ok: true; review: DogReview } | { ok: false; error: string }> {
  const res = await addReview({
    slug: DOG_SLUG,
    nombre: input.nombre,
    ciudad: input.ciudad || "",
    rating: input.rating,
    texto: input.texto,
  });
  if (!res.ok) return res;
  return { ok: true, review: toDog(res.review) };
}
