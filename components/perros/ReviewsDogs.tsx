"use client";

import { useEffect, useMemo, useState } from "react";
import type { Review } from "@/components/gallos/_lib/types";
import { track } from "@/components/gallos/_lib/tracking";
import { DOG_REVIEWS } from "@/components/perros/_lib/dog";
import {
  listDogReviews,
  submitDogReview,
} from "@/components/perros/_lib/reviews-actions";

const DEFAULT_STORAGE_KEY = "dog_reviews_v1";

function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 20 20"
          fill="currentColor"
          className={i < value ? "text-[#a78bfa]" : "text-white/15"}
          aria-hidden
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9 4.7 17.6l1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({ r }: { r: Review }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.035] p-6 transition-colors hover:border-[#8b5cf6]/40">
      <div className="flex items-center gap-3.5">
        <span className="font-ui grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#a78bfa] to-[#7c3aed] text-base font-semibold text-white">
          {r.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <div className="min-w-0">
          <p className="font-ui truncate text-[15px] font-semibold tracking-tight text-white">
            {r.name}
          </p>
          <p className="font-ui truncate text-xs font-medium text-white/45">
            {r.role}
            {r.city ? ` · ${r.city}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-3.5">
        <Stars value={r.rating} />
      </div>
      <p className="font-ui mt-3 text-[15px] leading-relaxed text-white/65">
        {r.comment}
      </p>
    </article>
  );
}

export function ReviewsDogs({
  reviews = DOG_REVIEWS,
  // Mantenido por compatibilidad con la llamada original; ahora las reseñas
  // viven en NUESTRA base (tabla `reviews`, slug "more-muscle-dogs"), no en
  // localStorage. Mismo patrón que /gallos y /caballos.
  storageKey = DEFAULT_STORAGE_KEY,
  eyebrow = "Testimonios reales",
  title = "Lo que dicen los dueños",
}: {
  reviews?: Review[];
  storageKey?: string;
  eyebrow?: string;
  title?: string;
} = {}) {
  void storageKey;
  const [userReviews, setUserReviews] = useState<Review[]>([]);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    listDogReviews()
      .then((rows) => {
        if (alive) setUserReviews(rows);
      })
      .catch(() => {
        /* sin DB: se muestran solo las reseñas semilla */
      });
    return () => {
      alive = false;
    };
  }, []);

  const all = useMemo(
    () => [...userReviews, ...reviews],
    [userReviews, reviews],
  );
  const avg = useMemo(
    () =>
      all.length
        ? Math.round(
            (all.reduce((s, r) => s + r.rating, 0) / all.length) * 10,
          ) / 10
        : 5,
    [all],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (name.trim().length < 2) return setError("Escribe tu nombre.");
    if (comment.trim().length < 8)
      return setError("Cuéntanos un poco más sobre tu experiencia.");
    setError("");
    setSending(true);
    try {
      const res = await submitDogReview({
        nombre: name.trim().slice(0, 40),
        ciudad: city.trim().slice(0, 30),
        rating,
        texto: comment.trim().slice(0, 280),
      });
      if (!res.ok) {
        setError(res.error || "No se pudo guardar tu reseña. Intenta de nuevo.");
        return;
      }
      setUserReviews((prev) => [res.review, ...prev]);
      track("submit_review", { rating });
      setName("");
      setCity("");
      setComment("");
      setRating(5);
      setDone(true);
      setOpen(false);
      setTimeout(() => setDone(false), 4000);
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    "font-ui h-12 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-[15px] text-white placeholder:text-white/35 transition-colors focus:border-[#a78bfa]/60 focus:bg-white/[0.05] focus:outline-none";

  return (
    <section id="resenas" className="scroll-mt-16 bg-background px-5 py-16">
      <div className="text-center">
        <p className="eyebrow mb-3 text-[#a78bfa]/90">{eyebrow}</p>
        <h2 className="h-apple text-frost mx-auto max-w-md text-[clamp(28px,8vw,44px)]">
          {title}
        </h2>
        <div className="mt-4 flex items-center justify-center gap-2.5">
          <Stars value={Math.round(avg)} size={17} />
          <span className="font-ui text-sm font-medium text-white/55">
            {avg.toFixed(1)} · {all.length} reseñas
          </span>
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-[760px] gap-4 sm:grid-cols-2">
        {all.map((r, i) => (
          <ReviewCard key={`${r.name}-${i}`} r={r} />
        ))}
      </div>

      <div className="mt-9">
        {done && (
          <p className="font-ui mb-5 flex items-center justify-center gap-2 rounded-2xl border border-[#27c34a]/40 bg-[#27c34a]/10 px-4 py-3 text-center text-sm font-medium text-[#5fe085]">
            ✓ ¡Gracias! Tu reseña fue publicada.
          </p>
        )}

        {!open ? (
          <div className="text-center">
            <button
              onClick={() => setOpen(true)}
              className="font-ui inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-7 py-3.5 text-sm font-semibold tracking-tight text-white transition-colors hover:border-[#8b5cf6]/60"
            >
              <span className="text-[#a78bfa]">★</span> Deja tu reseña
            </button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="mx-auto max-w-xl rounded-[28px] border border-white/10 bg-white/[0.035] p-6 sm:p-7"
          >
            <p className="h-apple mb-5 text-xl text-white">
              Cuéntanos tu experiencia
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                maxLength={40}
                className={inputCls}
              />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ciudad (opcional)"
                maxLength={30}
                className={inputCls}
              />
            </div>

            <div className="mt-5 flex items-center gap-3">
              <span className="font-ui text-sm text-white/55">
                Tu calificación
              </span>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const v = i + 1;
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-label={`${v} estrellas`}
                      onMouseEnter={() => setHover(v)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(v)}
                      className={`text-2xl leading-none transition-transform hover:scale-110 ${
                        v <= (hover || rating)
                          ? "text-[#a78bfa]"
                          : "text-white/20"
                      }`}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="¿Cómo le fue a tu perro con el producto?"
              maxLength={280}
              rows={3}
              className={`${inputCls} mt-5 h-auto resize-none py-3 leading-relaxed`}
            />

            {error && (
              <p className="font-ui mt-2 text-sm text-danger">{error}</p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                disabled={sending}
                className="btn-shine font-ui flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#a78bfa] to-[#7c3aed] text-sm font-semibold tracking-tight text-white transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {sending ? "Publicando…" : "Publicar reseña"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-ui h-12 rounded-full border border-white/12 px-5 text-sm font-medium text-white/60 transition-colors hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
