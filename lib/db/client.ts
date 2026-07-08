import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Cliente Drizzle. Es null en modo demo (sin DATABASE_URL). */
const url = process.env.DATABASE_URL;

// Pooler de Supabase (pgbouncer transaction mode, puerto 6543): permite varias
// conexiones por instancia → las consultas en Promise.all corren en PARALELO
// (antes con max:1 se serializaban y las páginas iban lentas).
export const db = url
  ? drizzle(postgres(url, {
      prepare: false, max: 8, idle_timeout: 20, connect_timeout: 10,
      // Aborta cualquier consulta que pase de 15s (evita que una conexión pegada cuelgue la página).
      connection: { statement_timeout: 15000 },
      // Descarta conexiones tras 30 min (evita conexiones zombies del pooler).
      max_lifetime: 60 * 30,
    }), { schema })
  : null;

export { schema };
