-- Removes 'stripe' from the payment_method enum. Stripe integration has been
-- removed from the codebase (no replacement gateway wired in yet — OPay is
-- planned). Verified against the live database before writing this that zero
-- rows in `payments` carry payment_method = 'stripe', so this is a pure
-- schema change with no data to migrate.
--
-- NOT in meta/_journal.json, like 0002-0005 — `pnpm db:migrate` will not run
-- it. Apply it by hand: `db:push` (which infers this straight from
-- src/db/schema.ts) or paste this file into the Neon SQL editor or psql.
--
-- Postgres has no `ALTER TYPE ... DROP VALUE`, so this recreates the enum
-- type instead: build the new type, repoint the column at it, drop the old
-- one. Wrapped in one transaction so a failure anywhere leaves the original
-- enum intact.
--
-- ---------------------------------------------------------------------------

BEGIN;

CREATE TYPE "payment_method_new" AS ENUM (
  'credit_card',
  'debit_card',
  'paypal',
  'cash_on_delivery'
);

ALTER TABLE "payments"
  ALTER COLUMN "payment_method" TYPE "payment_method_new"
  USING "payment_method"::text::"payment_method_new";

DROP TYPE "payment_method";

ALTER TYPE "payment_method_new" RENAME TO "payment_method";

COMMIT;
