/* Casos REALES de los chats de Rooster Deluxe (pago anticipado), 15–26 nov 2026.
   Cada test es un error que el bot cometió con un cliente de verdad. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { identifyProduct } from "@/lib/ai/brain";
import { usoLimpio, variosMensaje } from "@/lib/ai/present";
import type { ProductView } from "@/lib/ai/types";
import catalogJson from "@/tests/fixtures/rooster-catalog.json";

const cat = catalogJson as unknown as ProductView[];
const r = (q: string) => identifyProduct(q, cat);
const slugs = (q: string) => { const x = r(q); return (x.options.length ? x.options : x.product ? [x.product] : []).map((p) => p.slug); };

test("B12 nunca se vuelve B15: 'las 5500 B12' / 'la b 12 5500' → Super Vitamina B12 5500", () => {
  for (const q of ["las 5500 B12", "En cuánto sale las 5500 B12", "la b 12 5500", "b12 5500"]) {
    assert.deepEqual(slugs(q), ["super-vitamina-b12-5500-inyectable"], q);
  }
  assert.deepEqual(slugs("b15 5500"), ["super-energizante-b15-5500-ultra"]);
});

test("'5500' a secas → opciones (B12 5500, Ultra Gallo B12 5500, B15 5500), nunca adivina", () => {
  const x = r("5500");
  assert.equal(x.status, "ambiguous");
  assert.ok(slugs("5500").includes("super-energizante-b15-5500-ultra"));
  assert.ok(slugs("5500").includes("super-vitamina-b12-5500-inyectable"));
});

test("'el B12' sin decir cuál → las B12 (antes no respondía nada)", () => {
  for (const q of ["Me puede despachar el B12", "B12 6000", "B 12 en goteros"]) {
    const s = slugs(q);
    assert.ok(s.length >= 2, q);
    assert.ok(s.every((x) => !x.includes("b15")), `${q}: ${s}`);
  }
});

test("'cobra 500' sigue siendo Super Cobra 500 (el número no lo pega a los 5500)", () => {
  assert.deepEqual(slugs("cobra 500"), ["super-cobra-500"]);
});

test("charla de WhatsApp NO elige producto (antes: Catosal, Avena, Mamba, Candados)", () => {
  for (const q of ["En cuánto sale", "Por cuanto sale a popayan cauca", "Muestre aver", "una foto de la mano", "Una de cuidado", "Q vale", "Firma buenos días", "Maletero personalizado"]) {
    assert.equal(r(q).status, "not_found", `${q} → ${slugs(q)}`);
  }
});

test("espuelas de combate NO son el Corta Espuela (no se venden sueltas en el catálogo)", () => {
  assert.equal(r("ESPUELAS PARA EL COMBATE").status, "not_found");
  assert.equal(r("espuelas").status, "not_found");
  assert.deepEqual(slugs("corta espuela"), ["corta-espuela"]);
});

test("'gallo pulga' (typo) → Gallo Purga, no el antipiojos", () => {
  assert.deepEqual(slugs("Gallo pulga"), ["gallo-purga"]);
  assert.deepEqual(slugs("piojos"), ["lice-free"]);
});

test("'esparacitante' / 'el purgante' → desparasitantes, nunca Espadadrapo", () => {
  for (const q of ["Y el esparacitante", "cuanto vale el purgante", "Y para purgarlos"]) {
    const s = slugs(q);
    assert.ok(s.includes("gallo-purga"), `${q}: ${s}`);
    assert.ok(!s.some((x) => x.startsWith("espadadrapo")), `${q}: ${s}`);
  }
});

test("dopaje / día de exhibición → doping", () => {
  for (const q of ["Dopaje", "Que cuanto tipos de doping manejan y precio", "para el día de exhibición"]) {
    const x = r(q);
    assert.ok(x.options.length >= 2, q);
    assert.ok(x.options.every((p) => p.categorySlug === "doping-energizantes"), q);
  }
});

test("varios productos en un mensaje → todos, con precio (antes: la misma Piquera 4 veces)", () => {
  const x = r("Tienen placas Botas tijera y Piqueras");
  assert.equal(x.multi, true);
  const s = slugs("Tienen placas Botas tijera y Piqueras");
  assert.ok(s.includes("placas-personalizadas") && s.includes("piquera-peruana"), String(s));
  const m = variosMensaje(x.options);
  assert.match(m, /Placas Personalizadas\* · \$70\.000/);
  assert.doesNotMatch(m, /¿Cuál de estos/);
  assert.equal(r("Nesecito las botas y la mona").multi, true);
});

test("'para las gallinas, que pongan' → Hens, nunca un desparasitante", () => {
  const s = slugs("pero yo nesesito para las gallinas paque pongan");
  assert.ok(s.includes("hens"), String(s));
  assert.ok(!s.includes("galliverm-super"));
});

test("'vitamina bebible' → orales, nunca una inyectable", () => {
  const x = r("vitamina bebible");
  assert.ok(x.options.length >= 1);
  assert.ok(!(x.options.length ? x.options : [x.product!]).some((p) => /inyect/i.test(p.name)));
});

test("apodos reales: 'Roster estren' → Rooster Strength · 'Energicobra' → Energy Cobra", () => {
  assert.deepEqual(slugs("Roster estren"), ["rooster-strength"]);
  assert.deepEqual(slugs("Energicobra"), ["energy-cobra"]);
});

test("ficha: 'Uso: Presentación por 100 pastillas' NO es dosis", () => {
  assert.deepEqual(usoLimpio("Presentación por 100 pastillas."), { dosis: "", info: "" });
  assert.equal(usoLimpio("Presentación por 100 ml. Dosis: 3 meses 4 gotas; 4 a 8 meses 8 gotas.").dosis, "3 meses 4 gotas; 4 a 8 meses 8 gotas.");
  assert.match(usoLimpio("Aplicar de 4 a 5 gotas 1 hora antes del juego.").dosis, /4 a 5 gotas/);
  assert.equal(usoLimpio("Ungüento tópico para la visión.").dosis, "");
});

/* ---------- primer chat EN VIVO con la versión nueva (27-nov 01:22) ---------- */
import { parsePlainItems } from "@/lib/ai/orders";

test("'botiquín de calzar completo' → lo de calzar, nunca Rooster Complet", () => {
  const s = slugs("Necesito botiquín de calzadar completo amigo");
  assert.ok(!s.includes("rooster-complet"), String(s));
  assert.ok(s.includes("espadadrapo-blanco"), String(s));
});

test("lista larga del cliente: blanco pegado al número, cloruro y 'para afeitar' también salen", () => {
  const s = slugs("Necesito 1espadadrapo blanco 35 1 espadadrapo de color Una cera dominicana Un cloruro Una mona Una para afeitar");
  for (const k of ["espadadrapo-blanco", "cera-dominicana", "percloruro", "mona", "rooster-shave"]) assert.ok(s.includes(k), `${k}: ${s}`);
});

test("crear_pedido: la lista '1x A, 1x B, 2x C' son 3 productos con su cantidad", () => {
  const items = parsePlainItems("1x Espadadrapo Blanco 4 pulgadas, 1x Cera Dominicana, 2x Mona, 1x Rooster Shave", () => true);
  assert.deepEqual(items.map((i) => [i.name, i.cantidad]), [["Espadadrapo Blanco 4 pulgadas", 1], ["Cera Dominicana", 1], ["Mona", 2], ["Rooster Shave", 1]]);
  for (const it of items) assert.ok(r(it.name).product, it.name);
});

/* ---------- chats del 26-nov noche (versión nueva en vivo) ---------- */
import { richMensaje } from "@/lib/ai/present";

test("'comida para las gallinas que pongan' → Hens, no avena/cinta azul", () => {
  for (const q of ["Y comía para las gallinas que pongan", "comida para gallinas ponedoras"]) {
    const s = slugs(q);
    assert.ok(s.includes("hens"), `${q}: ${s}`);
    assert.ok(!s.includes("avena"), `${q}: ${s}`);
  }
});

test("producto SIN foto: la ficha lo dice (nunca 'ya te mandé la foto')", () => {
  const cinta = cat.find((p) => p.slug === "cinta-azul")!;
  assert.ok(!cinta.imageUrl);
  assert.match(richMensaje(cinta), /Foto: te la manda el asesor/);
  const cobra = cat.find((p) => p.slug === "energy-cobra")!;
  assert.doesNotMatch(richMensaje(cobra), /te la manda el asesor/);
});
