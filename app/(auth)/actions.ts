"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function login(_prev: unknown, formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/dashboard");
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Correo o contraseña incorrectos." };
  redirect("/dashboard");
}

export async function signup(_prev: unknown, formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/dashboard");
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  if (password.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function logout() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
