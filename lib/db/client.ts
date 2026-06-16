import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Cliente Drizzle. Es null en modo demo (sin DATABASE_URL). */
const url = process.env.DATABASE_URL;

export const db = url
  ? drizzle(postgres(url, { prepare: false }), { schema })
  : null;

export { schema };
