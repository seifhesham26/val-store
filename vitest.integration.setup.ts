import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Integration tests need DATABASE_URL. It is read from .env — check that " +
      "the file exists and the variable is set, then re-run " +
      "`pnpm test:integration`."
  );
}
