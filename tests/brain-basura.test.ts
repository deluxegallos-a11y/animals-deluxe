/* BUG DE PRODUCCIÓN (rooster-deluxe, 2-ago-2026) — 13 casos en `events`.
   Cuando el cliente mandaba una NOTA DE VOZ o una FOTO, UChat reenviaba la URL del
   media como `q`:
       "https://www.uchat.com.au/media/whatsapp/1179721351895048/…/-VNwT.mp3"
   Al normalizar, la URL se volvía palabras y el token "media" hacía match EXACTO
   (score 1.0) con "Comedero MEDIA Luna" → el bot le ofrecía un comedero a alguien
   que solo había mandado un audio.
   Y "goticas para dopar los gallos" caía en BOTAS: "goticas" vs el alias "boticas"
   da 0.80 de similitud y la guarda del primer fonema solo aplicaba bajo 0.55. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { identifyProduct, esQueryBasura } from "@/lib/ai/brain";
import { ROOSTER_RULES } from "@/lib/ai/aliases";
import type { ProductView } from "@/lib/ai/types";
import catalogJson from "@/tests/fixtures/rooster-catalog.json";

const cat = catalogJson as unknown as ProductView[];
const id = (q: string) => identifyProduct(q, cat, [], ROOSTER_RULES);
function slugs(q: string): string[] {
  const r = id(q);
  const list = r.options.length ? r.options : r.product ? [r.product] : [];
  return list.map((p) => p.slug);
}
/** Los implementos que el fuzzy pescaba sin ninguna relación con la consulta. */
const IMPLEMENTOS = /comedero|bota|coquita|tijera|mona|espadadrapo|candado|piquera/;

/* ---------- candado de entrada ---------- */

test("esQueryBasura reconoce URL de media, archivos, ids y vacío", () => {
  for (const q of [
    "",
    "   ",
    "https://www.uchat.com.au/media/whatsapp/1179721351895048/1513013150578749/-xj2U.mp3",
    "https://www.uchat.com.au/media/whatsapp/1179721351895048/1859891684973247/-N6iv.png",
    "http://x.co/a.jpg",
    "www.uchat.com.au/media/x.mp3",
    "audio-2026-08-02.ogg",
    "1179721351895048",
    "0f8b2c1d9a4e7f3b6c5d8e2a",
  ]) {
    assert.equal(esQueryBasura(q), true, `debía ser basura: "${q}"`);
  }
});

test("esQueryBasura NO descarta consultas reales", () => {
  for (const q of [
    "goticas para dopar los gallos",
    "energy cobra",
    "la 77",
    "algo pal moquillo",
    "vitamina b12 5500",
    "botas de entrenar",
    "comedero media luna",
  ]) {
    assert.equal(esQueryBasura(q), false, `NO debía ser basura: "${q}"`);
  }
});

/* ---------- el bug exacto de producción ---------- */

test("BUG PROD: la URL del audio de UChat NUNCA devuelve producto", () => {
  for (const q of [
    "https://www.uchat.com.au/media/whatsapp/1179721351895048/1513013150578749/-xj2U.mp3",
    "https://www.uchat.com.au/media/whatsapp/1179721351895048/1663112909155787/-VNwT.mp3",
    "https://www.uchat.com.au/media/whatsapp/1179721351895048/1859891684973247/-N6iv.png",
  ]) {
    const r = id(q);
    assert.equal(r.status, "not_found", `"${q}" → ${r.status} ${r.product?.slug}`);
    assert.equal(r.product, null);
    assert.deepEqual(r.ranked, [], "no debe ni rankear: se corta antes del catálogo");
  }
});

test("q vacío → not_found seco, sin producto y sin ranking", () => {
  for (const q of ["", "   ", "\n"]) {
    const r = id(q);
    assert.equal(r.status, "not_found");
    assert.equal(r.product, null);
    assert.deepEqual(r.options, []);
  }
});

test("solo muletillas → not_found, jamás un producto", () => {
  for (const q of ["hola", "buenas", "por favor", "gracias", "hola buenas gracias"]) {
    const r = id(q);
    assert.equal(r.product, null, `"${q}" devolvió ${r.product?.slug}`);
  }
});

/* ---------- goticas / doping ---------- */

test("BUG PROD: 'goticas para dopar los gallos' → DOPING, jamás botas ni comedero", () => {
  const r = id("goticas para dopar los gallos");
  assert.equal(r.status, "category", `status ${r.status} · ${slugs("goticas para dopar los gallos").join(", ")}`);
  const s = r.options.map((p) => p.slug);
  assert.ok(s.length > 0);
  assert.ok(
    r.options.every((p) => p.categorySlug === "doping-energizantes"),
    `salió de otra categoría: ${r.options.map((p) => `${p.slug}[${p.categorySlug}]`).join(", ")}`,
  );
  assert.ok(!s.some((x) => IMPLEMENTOS.test(x)), `cayó en un implemento: ${s.join(", ")}`);
});

test("BUG PROD: 'goticas' a secas → doping o ambiguous, jamás comedero ni botas", () => {
  const r = id("goticas");
  assert.ok(["category", "ambiguous", "found"].includes(r.status), `status ${r.status}`);
  const s = slugs("goticas");
  assert.ok(s.length > 0, "no debe quedar mudo");
  assert.ok(!s.some((x) => IMPLEMENTOS.test(x)), `cayó en un implemento: ${s.join(", ")}`);
});

test("'goticas' ya no se parece a 'boticas' (guarda del primer fonema)", () => {
  for (const q of ["goticas", "goticas para dopar", "goticas pa dopar", "goticas para los gallos"]) {
    const s = slugs(q);
    assert.ok(!s.some((x) => x.startsWith("botas")), `"${q}" → ${s.join(", ")}`);
  }
});

/* ---------- no romper lo que sí funcionaba ---------- */

test("las botas de verdad siguen resolviendo", () => {
  for (const q of ["botas", "boticas", "botas de entrenar", "botas de cuero"]) {
    const s = slugs(q);
    assert.ok(s.some((x) => x.startsWith("botas")), `"${q}" → ${s.join(", ")}`);
  }
});

test("el comedero de verdad sigue resolviendo", () => {
  for (const q of ["comedero", "comederos", "coquitas", "comedero media luna"]) {
    const s = slugs(q);
    assert.ok(s.some((x) => x.startsWith("comedero")), `"${q}" → ${s.join(", ")}`);
  }
});

test("el doping por nombre propio sigue intacto", () => {
  assert.deepEqual(slugs("energy cobra"), ["energy-cobra"]);
  assert.deepEqual(slugs("la 77"), ["super-energy-77"]);
  assert.deepEqual(slugs("rebamba"), ["red-dopping-mamba"]);
});
