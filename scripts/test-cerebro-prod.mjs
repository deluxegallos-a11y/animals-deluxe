/* Corre los TESTS OBLIGATORIOS del cerebro contra el endpoint EN VIVO
   (tenant rooster-deluxe). Uso: node scripts/test-cerebro-prod.mjs [baseUrl] */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try { for (const l of readFileSync(join(ROOT, f), "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
}
const BASE = process.argv[2] || "https://animals-deluxe.vercel.app";
const TOKEN = process.env.ROOSTER_BRIDGE_TOKEN;

/** [query, verificación(resultado) → true/false, descripción esperada] */
const CASES = [
  ["Rebamba", (r) => r.match === "red-dopping-mamba", "Red Dopping Mamba"],
  ["botas", (r) => r.status === "ambiguous" && r.opciones.length === 3 && r.opciones.every((o) => o.slug.startsWith("botas-")), "las 3 botas (ambiguous)"],
  ["muñeco de entrenamiento", (r) => r.match === "mona", "Mona"],
  ["plaquitas", (r) => r.match === "placas-personalizadas", "Placas Personalizadas"],
  ["bermicina", (r) => r.match === "vermicina-vermifugo", "Vermicina"],
  ["siano max", (r) => r.match === "cyano-max", "Cyano Max"],
  ["la 77", (r) => r.match === "super-energy-77", "Super Energy 77"],
  ["furi", (r) => r.match === "rooster-fury", "Rooster Fury"],
  ["que le crezca la cola", (r) => r.match === "omega-3", "Omega 3"],
  ["pal moquillo", (r) => r.opciones.concat([{ slug: r.match }]).every((o) => /cure-chest|clear-chicks|septibron/.test(o.slug)), "Cure Chest/Clear/Septibron"],
  ["parrillas de 90 grados", (r) => r.match === "patapiojas" && /normales/i.test(r.mensaje), "Patapiojas + nota solo normales"],
  ["asdfxyz", (r) => r.status === "not_found" && r.mensaje === "", "not_found, mensaje vacío"],
  ["quiero foto de la mona", (r) => r.match === "mona", "Mona"],
  ["comida para pollitos", (r) => r.match === "master-pollito", "Master Pollito"],
];

let ok = 0, bad = 0;
for (const [q, check, esperado] of CASES) {
  const res = await fetch(`${BASE}/api/ai/buscar-producto`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bridge-token": TOKEN },
    body: JSON.stringify({ q }),
  });
  const r = await res.json();
  const pass = res.ok && check(r);
  pass ? ok++ : bad++;
  const detalle = r.opciones?.length ? r.opciones.map((o) => o.slug).join(" | ") : r.match || "(nada)";
  console.log(`${pass ? "✔" : "✖"} q="${q}"`);
  console.log(`   esperado: ${esperado}`);
  console.log(`   status=${r.status} by=${r.matched_by || "-"} → ${detalle}`);
  console.log(`   mensaje: ${JSON.stringify((r.mensaje || "").split("\n")[0].slice(0, 110))}`);
}
console.log(`\n${bad === 0 ? "✅" : "❌"} ${ok}/${CASES.length} tests en vivo`);
process.exit(bad ? 1 : 0);
