/* La plataforma corre en "modo demo" (mock data, sin login) si Supabase
   no está configurado. Apenas pongas las llaves en .env.local se activa
   auth + base de datos real automáticamente. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
