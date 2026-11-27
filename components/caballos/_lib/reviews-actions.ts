"use server";

/* ===========================================================
   Reseñas de la landing /caballos -> reutiliza la MISMA infra
   de la plataforma (tabla `reviews` en Postgres/Drizzle), igual
   que /gallos pero filtrando por el producto "horse-deluxe".
   - lectura:  getReviews("horse-deluxe")   (lib/reviews)
   - escritura: addReview({slug:"horse-deluxe",...})  (autopublica,
     moderable en el panel /resenas)
   =========================================================== */
import { getReviews, type Review } from "@/lib/reviews";
import { addReview } from "@/app/order-actions";

const HORSE_SLUG = "horse-deluxe";

/** Forma que consume la landing (igual a `Review` en _lib/types). */
export type HorseReview = {
  name: string;
  role: string;
  city: string;
  rating: number;
  comment: string;
};

function toHorse(
  r: Pick<Review, "nombre" | "ciudad" | "rating" | "texto">,
): HorseReview {
  return {
    name: r.nombre,
    role: "Cliente verificado",
    city: r.ciudad || "",
    rating: r.rating || 5,
    comment: r.texto,
  };
}

/** Reseñas aprobadas de Horse Deluxe, más recientes primero. */
export async function listHorseReviews(): Promise<HorseReview[]> {
  const rows = await getReviews(HORSE_SLUG, 30);
  return rows.map(toHorse);
}

/** Publica una reseña desde la landing (autopublicada, moderable en el panel). */
export async function submitHorseReview(input: {
  nombre: string;
  ciudad?: string;
  rating: number;
  texto: string;
}): Promise<{ ok: true; review: HorseReview } | { ok: false; error: string }> {
  const res = await addReview({
    slug: HORSE_SLUG,
    nombre: input.nombre,
    ciudad: input.ciudad || "",
    rating: input.rating,
    texto: input.texto,
  });
  if (!res.ok) return res;
  return { ok: true, review: toHorse(res.review) };
}
