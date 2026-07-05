import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { mpCredenciales } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnóstico temporal (gated): descubre cómo la API Key genera el token de sesión.
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.BRIDGE_TOKEN || token !== process.env.BRIDGE_TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ error: "no db" });
  const [c] = await db.select().from(mpCredenciales).where(eq(mpCredenciales.id, "active")).limit(1);
  const apiKey = c?.apikey || "";

  const hosts = ["https://api-v2.mipaquete.com", "https://api.mipaquete.com"];
  const paths = ["/login", "/session", "/getToken", "/generateSessionTracker"];
  const attempts: Array<{ combo: string; status: number; hasToken: boolean; body: string }> = [];
  const grab = (o: Record<string, unknown>): string => String(o?.token || o?.sessionTracker || o?.["session-tracker"] || o?.sessionTracking || o?.["session-tracking"] || (o?.data as Record<string, unknown>)?.token || "");

  for (const host of hosts) {
    for (const path of paths) {
      // Variante A: apiKey en el body
      for (const [label, init] of [
        ["body{apiKey}", { headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey }) }],
        ["hdr apiKey", { headers: { "content-type": "application/json", apiKey } }],
        ["hdr Session-Tracker", { headers: { "content-type": "application/json", "Session-Tracker": apiKey } }],
      ] as const) {
        try {
          const r = await fetch(host + path, { method: "POST", ...init });
          const t = await r.text();
          let tok = ""; try { tok = grab(JSON.parse(t)); } catch { /* */ }
          if (r.status !== 404) attempts.push({ combo: `${host.replace("https://", "")}${path} [${label}]`, status: r.status, hasToken: !!tok, body: tok ? `TOKEN(${tok.length})` : t.slice(0, 90) });
          if (tok) return NextResponse.json({ FOUND: `${host}${path} [${label}]`, tokenLen: tok.length, attempts });
        } catch (e) { attempts.push({ combo: `${host}${path} [${label}]`, status: 0, hasToken: false, body: String(e).slice(0, 50) }); }
      }
    }
  }
  return NextResponse.json({ FOUND: null, apiKeyLen: apiKey.length, attempts });
}
