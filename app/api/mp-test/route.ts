import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Diagnóstico temporal: ¿Vercel alcanza ecommerce.mipaquete.com y hace auth + calculate COD? */
export async function GET() {
  const out: Record<string, unknown> = {};
  const bases = ["https://ecommerce.mipaquete.com/api/", "https://ecommerce.test.mipaquete.com/api/"];
  const email = "deluxegallos@gmail.com", password = "Rancho123*";
  for (const B of bases) {
    try {
      const r = await fetch(B + "auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const txt = await r.text();
      let token = "";
      try { token = (JSON.parse(txt).token as string) || ""; } catch { /* */ }
      out[B] = { status: r.status, body: txt.slice(0, 200) };
      if (token) {
        // towns count
        const tw = await fetch(B + "sendings/town", { headers: { Authorization: token } });
        const twj = await tw.json().catch(() => null);
        out[B + " towns"] = { status: tw.status, count: Array.isArray(twj) ? twj.length : 0, sample: Array.isArray(twj) ? twj.slice(0, 2) : String(twj).slice(0, 150) };
      }
    } catch (e) {
      out[B] = { error: String(e).slice(0, 120) };
    }
  }
  return NextResponse.json(out);
}
