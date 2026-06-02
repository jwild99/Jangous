import * as schema from "@shared/schema";
import { Pool as PgPool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import {
  Pool as NeonPool,
  neonConfig,
} from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import ws from "ws";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;

// Driver selection:
// - Default: Neon serverless driver (used by Replit's built-in database).
// - Set DATABASE_DRIVER=pg to use the standard node-postgres driver, required
//   for hosts like Railway, Render, Fly.io, or any self-hosted PostgreSQL.
const usePg = process.env.DATABASE_DRIVER === "pg";

let db: any;
let pool: any;

if (usePg) {
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const useSsl = process.env.DATABASE_SSL !== "false" && !isLocal;
  pool = new PgPool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
  db = drizzlePg(pool, { schema });
} else {
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString });
  db = drizzleNeon({ client: pool, schema });
}

export { db, pool };
