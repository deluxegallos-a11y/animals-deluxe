/* ===========================================================
   Reseñas de clientes por producto.
   - Público: agrega reseñas (server action addReview) y lee aprobadas.
   - Admin: lista todas y borra (deleteReview, server action protegida).
   =========================================================== */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reviews } from "@/lib/db/schema";

export type Review = {
  id: string;
  slug: string;
  nombre: string;
  ciudad: string;
  rating: number;
  texto: string;
  createdAt: string;
};

function toView(r: typeof reviews.$inferSelect): Review {
  const d = r.createdAt as Date | null;
  return {
    id: r.id,
    slug: r.productSlug,
    nombre: r.nombre,
    ciudad: r.ciudad || "",
    rating: r.rating || 5,
    texto: r.texto,
    createdAt: d instanceof Date ? d.toISOString() : "",
  };
}

/** Reseñas aprobadas de un producto (para la ficha pública). */
export async function getReviews(slug: string, limit = 40): Promise<Review[]> {
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.productSlug, slug), eq(reviews.estado, "aprobado")))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
    return rows.map(toView);
  } catch {
    return [];
  }
}

/** Todas las reseñas (panel admin / moderación), con su estado. */
export async function getAllReviews(limit = 300): Promise<(Review & { estado: string })[]> {
  if (!db) return [];
  try {
    const rows = await db.select().from(reviews).orderBy(desc(reviews.createdAt)).limit(limit);
    return rows.map((r) => ({ ...toView(r), estado: r.estado || "aprobado" }));
  } catch {
    return [];
  }
}
