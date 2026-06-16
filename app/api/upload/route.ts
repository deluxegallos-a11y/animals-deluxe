import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX = 5 * 1024 * 1024; // 5MB
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "product-images";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, mensaje: "No autorizado." }, { status: 401 });

  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ ok: false, mensaje: "Storage no configurado (modo demo)." }, { status: 503 });

  let file: File | null = null;
  let folder = "products";
  try {
    const fd = await req.formData();
    file = fd.get("file") as File | null;
    folder = (fd.get("folder") as string) || "products";
  } catch {
    return NextResponse.json({ ok: false, mensaje: "Solicitud inválida." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ ok: false, mensaje: "No llegó archivo." }, { status: 400 });
  if (!TYPES.has(file.type)) return NextResponse.json({ ok: false, mensaje: "Formato no permitido (jpg/png/webp)." }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ ok: false, mensaje: "Máximo 5MB." }, { status: 400 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${folder}/${Date.now()}-${rand}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ ok: false, mensaje: "No se pudo subir: " + error.message }, { status: 500 });

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl, path });
}
