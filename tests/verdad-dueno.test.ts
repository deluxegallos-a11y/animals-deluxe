/* VALIDACIÓN DEL BOT DE CONTRA ENTREGA contra la VERDAD DEL DUEÑO.
   ------------------------------------------------------------------
   Cada test es un error que el dueño reportó por WhatsApp (jun–nov 2026) y que
   se repitió semanas. Corre contra el catálogo REAL congelado
   (tests/fixtures/animals-catalog.json → `node scripts/dump-animals-catalog.mjs`)
   y contra data/verdad-dueno-animals.json (lo que dijo el dueño).

   Si alguien edita un producto en el panel y rompe la verdad (precio, forma,
   dosis, mínimo), al re-congelar el fixture este archivo falla ANTES de que el
   bot se lo diga a un cliente. */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProductView } from "@/lib/ai/types";
import { formaDe } from "@/lib/ai/search";
import { filtrarCatalogo, esBloqueado } from "@/lib/ai/catalog-rules";
import { identifyProduct } from "@/lib/ai/brain";
import { ANIMALS_RULES } from "@/lib/ai/aliases";
import catalogJson from "@/tests/fixtures/animals-catalog.json";
import verdadJson from "@/data/verdad-dueno-animals.json";

type Verdad = {
  precio: number; forma?: string; presentacion?: string; dosificacion?: string;
  min_unidades?: number; envio_gratis?: boolean; combo?: string[]; solo_perros?: boolean;
};
const V = verdadJson as unknown as {
  productos: Record<string, Verdad>; solo_rooster_anticipado: string[];
  protocolo_doping_gotas: string; minimo_contraentrega_cop: number;
};
// El bot SOLO ve el catálogo ya filtrado por tenant (igual que data.ts en prod).
const cat = filtrarCatalogo("animals-deluxe", catalogJson as unknown as ProductView[]);
const P = (slug: string) => {
  const p = cat.find((x) => x.slug === slug);
  assert.ok(p, `${slug} no está en el catálogo de contra entrega`);
  return p!;
};
const verdad = Object.entries(V.productos);

/* ---------- 1 · los dos bots NO se mezclan ---------- */

test("separación: ningún producto de Rooster (anticipado) aparece en el bot de contra entrega", () => {
  for (const slug of V.solo_rooster_anticipado) {
    assert.ok(esBloqueado("animals-deluxe", slug), `${slug} debe estar bloqueado en animals`);
    assert.ok(!cat.some((p) => p.slug === slug), `${slug} se cuela en el catálogo COD`);
  }
});

test("separación: ningún producto del catálogo COD está marcado solo-anticipado", () => {
  const mal = cat.filter((p) => p.soloAnticipado).map((p) => p.slug);
  assert.deepEqual(mal, [], "si es anticipado, va bloqueado en catalog-rules (redirige a Rooster), no mezclado");
});

test("separación: Red Rooster, Karate Kill, Cure Chest cápsulas y botas NO se resuelven en el bot COD", () => {
  for (const q of ["red rooster", "karate kill", "cure chest capsulas", "botas canilleras", "espuelas excalibur"]) {
    const r = identifyProduct(q, cat, [], ANIMALS_RULES);
    const s = r.product?.slug || "";
    assert.ok(
      !/red-rooster|karate|canill|bota|espuela/.test(s),
      `"${q}" resolvió a ${s} en el bot de contra entrega`,
    );
    if (/cure/.test(q) && r.product) {
      assert.ok(!r.product.presentations.some((x) => /c[aá]psul|pastill/i.test(x.label)), "Cure Chest cápsulas es anticipado");
    }
  }
});

/* ---------- 2 · precio ---------- */

test("precio: cada producto cuesta lo que dice el dueño", () => {
  const mal: string[] = [];
  for (const [slug, v] of verdad) {
    const p = cat.find((x) => x.slug === slug);
    if (!p) { mal.push(`${slug}: falta`); continue; }
    if (p.priceCOP !== v.precio) mal.push(`${slug}: ${p.priceCOP} ≠ ${v.precio}`);
    const p0 = p.presentations?.[0]?.priceCOP;
    if (p0 && p0 !== v.precio) mal.push(`${slug}: presentación 1 ${p0} ≠ ${v.precio}`);
  }
  assert.deepEqual(mal, []);
});

test("precio: Cure Chest gotas $45.000 (no $40.000) y SIN cápsulas en contra entrega", () => {
  const p = P("cure-chest-rooster");
  assert.equal(p.priceCOP, 45000);
  assert.deepEqual(p.presentations.map((x) => x.label), ["Gotero"]);
});

test("precio: combos no trocados — del mes $230k, campeones $300k, potenciador $320k", () => {
  assert.equal(P("combo-del-mes").priceCOP, 230000);
  assert.equal(P("equipo-de-campeones").priceCOP, 300000);
  assert.equal(P("combo-potenciador").priceCOP, 320000);
  assert.equal(P("kit-entreno-recovery").priceCOP, 160000);
});

test("combos: el contenido de cada combo es el del dueño", () => {
  for (const [slug, v] of verdad.filter(([, v]) => v.combo)) {
    const t = `${P(slug).shortDesc} ${P(slug).descripcion}`.toLowerCase();
    for (const item of v.combo!) {
      const clave = item.toLowerCase().split(" ")[0].replace("dragón", "drag");
      assert.ok(t.includes(clave), `${slug} no menciona ${item}`);
    }
  }
  assert.ok(!/megaforce/i.test(P("combo-potenciador").descripcion || ""), "el potenciador trae Dragón Mamba, no MegaForce");
});

/* ---------- 3 · forma (inyectable vs gotas vs pastillas) ---------- */

test("forma: cada producto se aplica como dice el dueño (nunca inyectable↔gotas)", () => {
  const mal: string[] = [];
  for (const [slug, v] of verdad) {
    if (!v.forma || v.forma === "liquido") continue;
    const f = formaDe(P(slug));
    if (f !== v.forma) mal.push(`${slug}: bot diría "${f || "?"}" y es "${v.forma}"`);
  }
  assert.deepEqual(mal, []);
});

test("forma: casos reportados — Dragon Mamba/Nordic/CyanoMax/Ultra Gallo inyectables, Red Mamba/Rooster Strength gotas", () => {
  for (const s of ["dragon-mamba", "nordic-rooster-vitamins", "cyanomax-b12-5500", "ultra-gallo", "american-rooster-fury", "super-b12-max"])
    assert.equal(formaDe(P(s)), "inyectable", s);
  for (const s of ["red-copping-mamba", "rooster-strength", "energy-cobra", "super-energy-77", "super-energizante-b15"])
    assert.equal(formaDe(P(s)), "gotas", s);
});

test("forma: la ficha de un inyectable no habla de gotas en dosis/uso", () => {
  for (const [slug, v] of verdad.filter(([, v]) => v.forma === "inyectable")) {
    const p = P(slug);
    const t = `${p.dosificacion} ${p.usage} ${p.presentacion}`.toLowerCase();
    assert.ok(!/\bgot(a|as|ero|itas)\b/.test(t), `${slug} (inyectable) menciona gotas: ${t}`);
  }
});

/* ---------- 4 · dosis y presentación ---------- */

test("dosis: Ultra Gallo una vez al mes (no cada 8 días) y 10 ml (no 50 ml)", () => {
  const p = P("ultra-gallo");
  assert.match(p.dosificacion || "", /una vez al mes/i);
  assert.match(p.presentacion || "", /10 ml/);
  assert.ok(!/50 ?ml/.test(`${p.presentacion} ${p.presentations.map((x) => x.label).join(" ")}`));
});

test("dosis: Red Mamba / Energy Cobra / Energy 77 usan el protocolo de 4 gotas del dueño", () => {
  for (const s of ["red-copping-mamba", "energy-cobra", "super-energy-77"])
    assert.equal(P(s).dosificacion, V.protocolo_doping_gotas, s);
});

test("dosis: todo lo de la tabla con dosis la tiene en la ficha", () => {
  for (const [slug, v] of verdad) {
    if (!v.dosificacion) continue;
    const esperado = v.dosificacion === "@protocolo_doping_gotas" ? V.protocolo_doping_gotas : v.dosificacion;
    assert.equal(P(slug).dosificacion, esperado, slug);
  }
});

/* ---------- 5 · mínimo de Interrapidísimo ---------- */

test("mínimo: goteros de $25.000 salen de a 2 (mínimo contra entrega $50.000)", () => {
  for (const s of ["purge-beach", "clear-chicks", "nutripeep-refoce"]) {
    assert.equal(P(s).minUnidades, 2, s);
  }
});

test("mínimo: los goteros de $25.000 con su cantidad mínima llegan al mínimo ($50.000)", () => {
  // Los de $45.000 no se suben solos: crear-pedido le pide al cliente sumar otro producto.
  const mal = cat
    .filter((p) => p.priceCOP <= 25000 && p.priceCOP * Math.max(1, p.minUnidades ?? 1) < V.minimo_contraentrega_cop)
    .map((p) => `${p.slug} ($${p.priceCOP} × ${p.minUnidades ?? 1})`);
  assert.deepEqual(mal, []);
});

/* ---------- 6 · perros ≠ gallos ---------- */

test("especies: si piden para gallos, nunca sale More Muscle (perros)", () => {
  for (const q of ["vitamina para gallos", "algo para masa muscular de mi gallo", "suplemento para crestones", "musculo gallo"]) {
    const r = identifyProduct(q, cat, [], ANIMALS_RULES);
    const lista = [r.product, ...r.options].filter(Boolean).map((p) => p!.slug);
    assert.ok(!lista.some((s) => s.startsWith("more-muscle")), `"${q}" → ${lista.join(", ")}`);
  }
});

/* ---------- 7 · envío gratis solo donde aplica ---------- */

test("envío: gratis SOLO Horse Deluxe y More Muscle Dogs (Weight Muscle NO)", () => {
  const gratis = cat.filter((p) => p.envioGratis).map((p) => p.slug).sort();
  assert.deepEqual(gratis, ["horse-deluxe", "more-muscle-dogs"]);
});

/* ---------- 8 · textos sin precios viejos ---------- */

test("textos: ninguna descripción/objeción/FAQ menciona un precio que el producto ya no tiene", () => {
  // Bug real: la objeción "muy caro" del Dragon Mamba decía "son $90.000" (vale $150.000)
  // y el bot la repetía. Solo se permite el precio vigente, el de otra presentación o un "antes $X".
  const mal: string[] = [];
  for (const p of cat) {
    const validos = new Set([p.priceCOP, ...(p.presentations || []).map((x) => x.priceCOP)]);
    const textos: Record<string, string> = {
      descripcion: p.descripcion || "", objeciones: JSON.stringify(p.objeciones || {}),
      faq: JSON.stringify(p.faq || []), usage: p.usage || "", pitch: p.pitch || "", tagline: p.tagline || "",
    };
    for (const [campo, t] of Object.entries(textos)) {
      for (const m of t.matchAll(/\$\s?(\d{1,3}(?:[.,]\d{3})+)/g)) {
        const v = Number(m[1].replace(/\D/g, ""));
        const ctx = t.slice(Math.max(0, (m.index ?? 0) - 30), (m.index ?? 0)).toLowerCase();
        if (validos.has(v) || /antes/.test(ctx) || p.slug === "more-muscle-dogs-3m") continue;
        mal.push(`${p.slug}.${campo}: $${v}`);
      }
    }
  }
  assert.deepEqual(mal, []);
});

test("textos: Cure Chest no menciona dosis de cápsulas como si se vendieran aquí", () => {
  const p = P("cure-chest-rooster");
  assert.ok(!/1 c[aá]psula diaria/i.test(`${p.usage} ${p.descripcion} ${JSON.stringify(p.faq)}`));
});

test("combos: no se les asigna UNA forma (mezclan gotas, inyectable y pastillas)", () => {
  for (const s of ["combo-del-mes", "combo-potenciador", "equipo-de-campeones", "kit-entreno-recovery"])
    assert.equal(formaDe(P(s)), "", s);
});

/* ---------- 9 · un alias suelto no se traga un producto del otro canal ---------- */
import { contieneQuery } from "@/lib/ai/marcas";

test("separación: 'super cobra 500' NO queda como Energy Cobra (se redirige a Rooster)", () => {
  assert.equal(contieneQuery("super cobra 500", P("energy-cobra")), false);
  assert.equal(contieneQuery("cobra", P("energy-cobra")), true, "'cobra' solo sí es Energy Cobra");
  assert.equal(contieneQuery("la cobra", P("energy-cobra")), true);
});

test("separación: el nombre de cada producto COD lo contiene a sí mismo (nunca se redirige un producto propio por su nombre)", () => {
  const mal = cat.filter((p) => !contieneQuery(p.name, p)).map((p) => p.slug);
  assert.deepEqual(mal, []);
});

/* ---------- 10 · una palabra suelta no se inventa el producto (chat Juaquin 25-nov) ---------- */

test("palabra suelta: 'rooster' y 'gallo' solos NO eligen producto (antes: Rooster And Worm / Ultra Gallo)", () => {
  for (const q of ["rooster", "gallo", "el rooster"]) {
    const r = identifyProduct(q, cat, [], ANIMALS_RULES);
    assert.equal(r.status === "found" ? r.product?.slug : "", "", `"${q}" resolvió a ${r.product?.slug}`);
  }
});

test("palabra suelta compartida → opciones: mamba (Red/Dragon), dragon (Mamba/Rooster), energy (Cobra/77)", () => {
  const casos: Record<string, string[]> = {
    mamba: ["dragon-mamba", "red-copping-mamba"],
    dragon: ["dragon-mamba", "dragon-rooster"],
    energy: ["energy-cobra", "super-energy-77"],
  };
  for (const [q, esperados] of Object.entries(casos)) {
    const r = identifyProduct(q, cat, [], ANIMALS_RULES);
    assert.equal(r.status, "ambiguous", q);
    assert.deepEqual(r.options.map((p) => p.slug).sort(), esperados.sort(), q);
  }
});

test("nombres completos siguen resolviendo directo", () => {
  const casos: Record<string, string> = {
    "red mamba": "red-copping-mamba", "la mamba": "red-copping-mamba", "dragon mamba": "dragon-mamba",
    "energy cobra": "energy-cobra", "cobra": "energy-cobra", "fury": "american-rooster-fury", "american rooster fury": "american-rooster-fury",
  };
  for (const [q, slug] of Object.entries(casos)) assert.equal(identifyProduct(q, cat, [], ANIMALS_RULES).product?.slug, slug, q);
});

/* ---------- 11 · Rooster Deluxe Supplement (dueño 25-nov 7:30 p. m.) ---------- */

test("Rooster Deluxe Supplement: contra entrega 500 pastillas $80.000 y polvo 400 gr $45.000 (1 y 3 kg = anticipado)", () => {
  const p = P("rooster-deluxe-supplement");
  assert.deepEqual(p.presentations.map((x) => [x.label, x.priceCOP]), [["500 pastillas", 80000], ["Polvo 400 gr", 45000]]);
  assert.equal(formaDe(p), "", "trae dos formas: el bot no debe afirmar una sola");
});

/* ---------- 12 · chats reales después de los cambios (25-nov, 8 p. m. en adelante) ---------- */

test("recuperación: si piden INYECCIÓN sale el inyectable (B12 Complete), no las pastillas", () => {
  for (const q of ["una inyeccion para ponerle a mis gallos despues de la presentacion", "inyectable para recuperacion"]) {
    const r = identifyProduct(q, cat, [], ANIMALS_RULES);
    assert.equal(r.product?.slug, "rooscer-b12-complete", q);
  }
  assert.equal(identifyProduct("pastillas para recuperar despues de la pelea", cat, [], ANIMALS_RULES).product?.slug, "gallo-post-recovery");
});

test("'Rooster Deluxe Max' es el Supplement (no Rooster DELUXE de pollitos); 'rooster deluxe' solo pregunta cuál", () => {
  assert.equal(identifyProduct("rooster deluxe max", cat, [], ANIMALS_RULES).product?.slug, "rooster-deluxe-supplement");
  const r = identifyProduct("rooster deluxe", cat, [], ANIMALS_RULES);
  assert.equal(r.status, "ambiguous");
  assert.ok(r.options.length >= 2);
});

// 26-nov: 23 "dosis inventadas" en un día. Causa: cada producto traía DOS dosis
// (la del dueño + un `usage`/"🥄 Modo de uso" viejo, p. ej. Energy Cobra
// "4 a 5 gotas"). Lo que ve el bot tiene que traer SOLO la del dueño.
test("una sola dosis: lo que recibe el bot no trae otra distinta a la del dueño", async () => {
  const { publicProduct, buildContexto } = await import("@/lib/ai/present");
  for (const p of cat) {
    if (!p.dosificacion) continue;
    const pub = publicProduct(p) as { descripcion: string; usage: string; uso: string };
    assert.equal(pub.usage, p.dosificacion, `${p.slug}: usage distinto a la dosis del dueño`);
    assert.equal(pub.uso, p.dosificacion, `${p.slug}: uso distinto`);
    assert.doesNotMatch(pub.descripcion, /modo de uso\s*:/i, `${p.slug}: la descripción trae otro "modo de uso"`);
    assert.doesNotMatch(buildContexto(p), /MODO DE USO/, `${p.slug}: el contexto trae otro modo de uso`);
  }
  const cobra = cat.find((p) => p.slug === "energy-cobra")!;
  const d = (publicProduct(cobra) as { descripcion: string }).descripcion;
  assert.doesNotMatch(d, /4 a 5 gotas/);
  assert.ok(d.includes(cobra.dosificacion!));
});

// 26-nov: el dueño confirmó la dosis del Supplement en polvo (antes el bot la inventaba: "una cucharadita").
test("Rooster Deluxe Supplement en polvo: 4 gramos por ejemplar en una comida diaria", () => {
  const p = cat.find((x) => x.slug === "rooster-deluxe-supplement")!;
  assert.match(p.dosificacion || "", /4 gramos por ejemplar en una comida diaria/);
});

/* ---------- respuestas del dueño 26-nov (tarde) ---------- */

test("dueño 26-nov: Chicks contra entrega SOLO 400 gr $45.000 (1 kg y 3 kg = anticipado)", () => {
  const p = P("rooster-deluxe-chicks");
  assert.equal(p.priceCOP, 45000);
  assert.deepEqual(p.presentations.map((x) => [x.label, x.priceCOP]), [["400 gr", 45000]]);
  assert.ok(!/1 kg|3 kg/i.test(p.presentacion || ""), p.presentacion);
});

test("dueño 26-nov: dosis Chicks 3 g diarios por pollito en la comida · Nordic 0.5 ml cada 15 días", () => {
  assert.match(P("rooster-deluxe-chicks").dosificacion || "", /3 gramos diarios por pollito/);
  assert.match(P("nordic-rooster-vitamins").dosificacion || "", /0\.5 ml en la pechuga cada 15 días/);
  assert.match(P("rooster-deluxe-supplement").dosificacion || "", /Pastillas: 1 a 2 diarias/);
});

test("dueño 26-nov: Nordic contra entrega 50 ml $180.000 y 100 ml $250.000", () => {
  const p = P("nordic-rooster-vitamins");
  assert.equal(p.priceCOP, 180000);
  assert.deepEqual(p.presentations.map((x) => [x.label, x.priceCOP]), [["50 ml", 180000], ["100 ml", 250000]]);
  assert.ok(!p.soloAnticipado, "Nordic va contra entrega");
});

/* ---------- auditoría 26-nov: textos que el bot manda tal cual ---------- */

test("Chicks y Supplement: el gancho y los beneficios no ofrecen 1 kg / 3 kg contra entrega", () => {
  for (const slug of ["rooster-deluxe-chicks", "rooster-deluxe-supplement"]) {
    const p = P(slug);
    const texto = [p.pitch, p.tagline, p.shortDesc, ...(p.benefits || [])].join(" ");
    assert.ok(!/\b[13] ?kg\b/i.test(texto), `${slug}: ${texto}`);
  }
});

test("ningún texto que ve el cliente nombra MegaForce Power (el combo trae Dragón Mamba)", () => {
  for (const p of cat) {
    const texto = [p.pitch, p.tagline, p.shortDesc, p.descripcion, ...(p.benefits || [])].join(" ");
    assert.ok(!/megaforce/i.test(texto), p.slug);
  }
});

test("Nordic: la presentación nombra los dos tamaños que se venden", () => {
  assert.match(P("nordic-rooster-vitamins").presentacion || "", /50 ml o 100 ml/);
});
