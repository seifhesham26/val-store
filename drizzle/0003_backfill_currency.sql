-- Currency backfill — ONLY for a database that predates 2026-09-03.
--
-- A fresh database no longer needs any of this. The baseline
-- (`0000_long_ultragirl.sql`) and both snapshots under `meta/` created these
-- three columns with `DEFAULT 'USD'` while `src/db/schema.ts` declared `EGP`,
-- so `db:push` produced EGP and `db:migrate` produced USD — the same database
-- built two ways gave two different answers. The baseline now says EGP, which
-- makes both paths agree and supersedes the `ALTER … SET DEFAULT` half below.
--
-- What the original note here got wrong, checked against the live database on
-- 2026-09-03: it assumed the `USD` rows had been charged in EGP and recorded
-- wrongly. They had not been charged at all. All 25 of them were seed
-- fixtures from Jan–Feb 2026 with **no `payments` row**, while all 19 real
-- (EGP) orders had one. So the UPDATEs below do not correct a mischarge; they
-- only stop seed data reading like a live bug in Drizzle Studio.
--
-- Run this only if you are keeping an existing database. If you are rebuilding
-- from scratch, skip it — the baseline already does the right thing.
--
-- If you are not running EGP, change the literals below BEFORE running this,
-- and change `src/db/schema.ts` and the baseline to match.
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
