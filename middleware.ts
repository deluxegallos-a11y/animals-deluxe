import { type NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/middleware";

/* Rutas públicas:
   - el bot se autentica con x-bridge-token (/api/ai) o x-api-key (/api/products/search)
   - los webhooks con su propia firma
   - la web pública: home "/", fichas de producto "/producto/*" y las landings "/gallos", "/caballos", "/perros"
   - el upload se protege por sesión dentro del handler */
const PUBLIC_PREFIXES = ["/api", "/producto", "/gallos", "/caballos", "/perros"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Home de la tienda y storefront → públicos
  if (path === "/" || PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  // Modo demo: sin Supabase configurado no se exige login.
  if (!isSupabaseConfigured()) return NextResponse.next();
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
