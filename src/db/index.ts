import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as relations from "./relations";

// Validate DATABASE_URL environment variable
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set in environment variables. " +
      "Please check your .env file and make sure DATABASE_URL is configured."
  );
}

// Create PostgreSQL connection
const connectionString = process.env.DATABASE_URL;

/**
 * Connection pool size.
 *
 * The right value depends entirely on how this is deployed, so it is
 * configuration rather than a constant.
 *
 * Measured against the live database (Neon, eu-central-1, ~58ms round trip),
 * steady state, best of three — wall time for a storefront grid page's four
 * queries at N concurrent requests:
 *
 *     requests   max:1    max:5    max:10
 *        1        71ms    118ms    117ms
 *        2        90ms    121ms    124ms
 *        4       128ms     93ms    145ms
 *        8       221ms    152ms    266ms
 *
 * `max: 1` wins at low concurrency, and not narrowly. postgres.js pipelines
 * queries down a single connection, so those four queries cost roughly ONE
 * round trip rather than four. Spread across four connections they run in
 * parallel but each pays its own 58ms, which is slower. On a latent link,
 * pipelining beats parallelism.
 *
 * But pipelining is not parallelism: five concurrent `pg_sleep(0.3)` calls on
 * one connection take 1567ms, so concurrent *requests* queue behind each other.
 * The crossover is around three to four. `max: 10` was worse than `max: 5` at
 * every level, so more is not better.
 *
 * Therefore:
 *   - Serverless / per-request isolates (Vercel): 1. Each instance serves one
 *     request at a time, so the crossover never arrives.
 *   - A long-lived Node server or container: 5.
 *
 * Neon's `-pooler` endpoint already fronts the database with pgBouncer, so a
 * larger value here is safe from the database's side.
 *
 * Chosen automatically rather than left as a decision anyone has to remember.
 * Vercel sets `VERCEL=1`, and each of its invocations serves one request at a
 * time, so the crossover never arrives and `max: 1` is right. Anywhere else is
 * assumed to be a long-lived server or container, where 5 wins from about four
 * concurrent requests upward. `DATABASE_POOL_MAX` still overrides both.
 */
const POOL_MAX =
  Number(process.env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 1 : 5)) || 1;

// Create the connection client
const client = postgres(connectionString, {
  max: POOL_MAX,
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
});

// Create Drizzle instance with schema
export const db = drizzle(client, { schema: { ...schema, ...relations } });

// Export the client for potential direct use
export { client };

// Utility function to test database connection
export async function testConnection() {
  try {
    await client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
