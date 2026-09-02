-- Trigram indexes for the ILIKE searches.
--
-- NOT YET APPLIED, and deliberately not urgent. At 36 products a sequential
-- scan is faster than any index, so this buys nothing today — it is written
-- now because the reason it will be needed is easy to forget once the
-- catalogue grows into the thousands.
--
-- Why it is needed at all: `ILIKE '%term%'` has a leading wildcard, which a
-- btree index cannot serve. Postgres has no choice but to read every row.
-- A GIN index with `gin_trgm_ops` can serve it, which is what pg_trgm adds.
--
-- Safe to run twice. `CREATE EXTENSION` needs privileges the application role
-- may not have on a managed database; on Neon run it from the SQL editor as
-- the owner. If the extension cannot be created, none of the indexes below can
-- be either — that is fine, and nothing else depends on them.
--
-- Apply with `pnpm db:push`, or paste into the Neon SQL editor.
-- Do NOT run `pnpm db:migrate`: the database was built with `db:push`, so
-- `__drizzle_migrations` is likely empty and migrate would try to replay the
-- 0000 baseline against tables that already exist.

CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

-- Storefront and admin product search: name and description.
CREATE INDEX IF NOT EXISTS "idx_products_name_trgm"
  ON "products" USING gin ("name" gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_products_description_trgm"
  ON "products" USING gin ("description" gin_trgm_ops);--> statement-breakpoint

-- Admin customer search: the two columns the router actually filters on.
CREATE INDEX IF NOT EXISTS "idx_user_name_trgm"
  ON "user" USING gin ("name" gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_user_email_trgm"
  ON "user" USING gin ("email" gin_trgm_ops);--> statement-breakpoint

-- The phone-keyed customers table, searched by the same admin screens.
CREATE INDEX IF NOT EXISTS "idx_customers_phone_trgm"
  ON "customers" USING gin ("phone" gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_customers_preferred_name_trgm"
  ON "customers" USING gin ("preferred_name" gin_trgm_ops);
