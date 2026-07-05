import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Cliente Drizzle. Es null en modo demo (sin DATABASE_URL). */
const url = process.env.DATABASE_URL;

// Pooler de Supabase (pgbouncer transaction mode, puerto 6543): permite varias
// conexiones por instancia → las consultas en Promise.all corren en PARALELO
// (antes con max:1 se serializaban y las páginas iban lentas).
export const db = url
  ? drizzle(postgres(url, { prepare: false, max: 8, idle_timeout: 30, connect_timeout: 10 }), { schema })
  : null;

export { schema };
