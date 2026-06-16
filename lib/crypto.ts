/* ===========================================================
   Cifrado simétrico de secretos (AES-256-GCM).
   ENCRYPTION_KEY = 32 bytes en hex (64 chars).
   Formato de salida: base64(iv).base64(tag).base64(ciphertext)
   =========================================================== */
import crypto from "node:crypto";

function key(): Buffer {
  const hex = process.env.ENCRYPTION_KEY || "";
  if (hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY debe ser 32 bytes en hex (64 chars)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, ctB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("payload cifrado inválido");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

/** Comparación de tiempo constante para tokens. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a || "", "utf8");
  const bb = Buffer.from(b || "", "utf8");
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}
