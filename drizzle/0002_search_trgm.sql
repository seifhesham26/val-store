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
-- >>> DO NOT PASTE THIS FILE INTO A LIVE DATABASE. <<<
--
-- The `CREATE INDEX` statements below are correct for an empty or offline
-- database and wrong for one taking orders: each takes an ACCESS EXCLUSIVE
-- lock and blocks every write to its table until the build finishes. On a live
-- store that is an outage.
--
-- `docs/POST-LAUNCH.md` has the step-by-step procedure — the same indexes with
-- CONCURRENTLY, which cannot run inside a transaction and so must be sent one
-- statement at a time, plus how to check for an invalid index afterwards, how
-- to confirm the planner actually uses them, and how to roll back. Follow that
-- rather than this file whenever the database has traffic.
--
-- On an empty database: `pnpm db:push`, or paste into the Neon SQL editor.
-- Do NOT run `pnpm db:migrate`: this file is not in `meta/_journal.json`
-- (deliberately — a failed CREATE EXTENSION would abort the whole deploy), and
-- migrate would try to replay the 0000 baseline against tables that already
-- exist.

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
