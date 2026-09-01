import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Integration tests — run against a real database.
 *
 * Kept out of `pnpm test` and out of CI, which has no `DATABASE_URL`. Run them
 * yourself with `pnpm test:integration`.
 *
 * Every test in this suite is **read-only**. They assert that the SQL the
 * repositories now emit agrees with the domain logic it replaced, so they are
 * safe to point at real data — and most useful when pointed at it, because the
 * shapes they check only go wrong once there are enough rows to page through.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./vitest.integration.setup.ts"],
    // A cold serverless database can take a moment on the first query.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // One connection, shared: `src/db` builds a pool of max 1.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
