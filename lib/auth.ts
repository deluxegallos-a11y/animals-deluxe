import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Usuario autenticado de Supabase (o null). En modo demo no hay auth. */
export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return { id: "demo", email: "demo@animalsdeluxe.com" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Exige sesión para acciones de escritura del panel. Lanza si no hay. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function demoMode(): boolean {
  return !isSupabaseConfigured();
}
