import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Cliente Drizzle. Es null en modo demo (sin DATABASE_URL). */
const url = process.env.DATABASE_URL;

// En serverless (Vercel) cada lambda abre su propio pool: limitamos a 1 conexión
// por instancia + timeouts, y usamos el pooler de Supabase (pgbouncer, puerto 6543).
export const db = url
  ? drizzle(postgres(url, { prepare: false, max: 1, idle_timeout: 20, connect_timeout: 10 }), { schema })
  : null;

export { schema };
