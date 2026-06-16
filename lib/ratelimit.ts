/* ===========================================================
   Rate limiting serverless-safe.
   - Si hay Upstash Redis (UPSTASH_REDIS_REST_URL + _TOKEN) usa un
     fixed-window distribuido (sirve en todas las lambdas de Vercel).
   - Si no, cae a un fixed-window EN MEMORIA (best-effort, por-lambda).
   Falla ABIERTO: si Upstash falla, degrada al limiter en memoria.
   =========================================================== */

const WINDOW_SECONDS = 60;
const MAX = 60;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const upstashEnabled = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

const buckets = new Map<string, { count: number; reset: number }>();
function memoryLimited(key: string, now: number): boolean {
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + WINDOW_SECONDS * 1000 });
    return false;
  }
  b.count += 1;
  return b.count > MAX;
}

async function upstashCount(key: string): Promise<number> {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", `rl:${key}`],
      ["EXPIRE", `rl:${key}`, String(WINDOW_SECONDS), "NX"],
    ]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const data = (await res.json()) as Array<{ result?: number; error?: string }>;
  const count = data?.[0]?.result;
  if (typeof count !== "number") throw new Error("upstash bad response");
  return count;
}

/** true = la petición debe rechazarse (429). Falla abierto ante errores. */
export async function isRateLimited(key: string, now: number): Promise<boolean> {
  if (!upstashEnabled) return memoryLimited(key, now);
  try {
    const count = await upstashCount(key);
    return count > MAX;
  } catch {
    return memoryLimited(key, now);
  }
}
