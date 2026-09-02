-- Currency backfill.
--
-- NOT YET APPLIED. This is the last loose end of the currency work.
--
-- `orders.currency` and `payments.currency` are `varchar(3) DEFAULT 'USD'`.
-- The repository now writes STORE_CURRENCY explicitly, but every row created
-- before that fell through to the column default and says `USD` — while
-- Stripe was charging EGP the whole time. `site_settings.currency` has the
-- same wrong default.
--
-- Impact today is nil, because nothing reads either column. It matters because
-- the P1 test plan asks you to verify these in Drizzle Studio, where the old
-- rows read `USD` and look exactly like a live bug.
--
-- Set to the currency this deployment actually charges in. If you are not
-- running EGP, change the literals below BEFORE running this — and note the
-- schema default in `src/db/schema.ts` was changed to match EGP, so change
-- that too.
--
-- Safe to run twice: each statement is scoped to rows still holding the wrong
-- value, so a second run updates nothing.

UPDATE "orders"
   SET "currency" = 'EGP'
 WHERE "currency" = 'USD';--> statement-breakpoint

UPDATE "payments"
   SET "currency" = 'EGP'
 WHERE "currency" = 'USD';--> statement-breakpoint

UPDATE "site_settings"
   SET "currency" = 'EGP'
 WHERE "currency" = 'USD';--> statement-breakpoint

-- The column defaults themselves. Declared in src/db/schema.ts as well, so
-- `pnpm db:push` will offer these; running them here is equivalent.
ALTER TABLE "orders"   ALTER COLUMN "currency" SET DEFAULT 'EGP';--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'EGP';
