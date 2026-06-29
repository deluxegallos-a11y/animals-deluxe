#!/usr/bin/env node
/* Genera imágenes con OpenAI (gpt-image-1) y las guarda en public/ai/.
   Uso: OPENAI_API_KEY=sk-... node scripts/gen-images.mjs [solo|todas]
   - "solo": genera solo el par de comparación (2 imágenes) — barato, para muestra.
   - "todas": comparación + un héroe por categoría.
*/
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error("Falta OPENAI_API_KEY"); process.exit(1); }
const MODE = process.argv[2] || "solo";
const OUT = resolve(process.cwd(), "public/ai");

const JOBS = [
  { file: "gallo-sin.png", prompt: "A tired, weak, exhausted gamecock rooster with dull drooping feathers, low energy, sad sleepy expression, slumped posture, muted desaturated gray colors, plain dark studio background, photorealistic, cinematic" },
  { file: "gallo-con.png", prompt: "A powerful muscular athletic champion gamecock rooster, vibrant glowing golden and red metallic feathers, fierce proud confident stance, radiating energy and power, dramatic rim lighting and sparks, dark studio background, photorealistic, premium hero shot, cinematic, highly detailed" },
];
const EXTRA = [
  { file: "hero-gallos.png", prompt: "An epic muscular champion fighting rooster glowing with golden red energy, lightning rays, dark dramatic background, premium sports supplement hero, photorealistic, cinematic" },
];
const list = MODE === "todas" ? [...JOBS, ...EXTRA] : JOBS;

async function gen(job) {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt: job.prompt, size: "1024x1024", n: 1 }),
  });
  const j = await r.json();
  if (!r.ok) { console.error(`✗ ${job.file}:`, JSON.stringify(j).slice(0, 300)); return false; }
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) { console.error(`✗ ${job.file}: sin imagen`, JSON.stringify(j).slice(0, 200)); return false; }
  await writeFile(resolve(OUT, job.file), Buffer.from(b64, "base64"));
  console.log(`✓ ${job.file}`);
  return true;
}

let ok = 0;
for (const job of list) { if (await gen(job)) ok++; }
console.log(`\nGeneradas ${ok}/${list.length} en public/ai/`);
