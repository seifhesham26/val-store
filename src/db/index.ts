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

// Create the connection client
// Using { max: 1 } for serverless/edge environments
const client = postgres(connectionString, {
  max: 1, // Maximum number of connections
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
