-- The cart entity: a `carts` row per customer, with `cart_items` hanging off
-- it instead of carrying the owner themselves.
--
-- NOT in meta/_journal.json, like 0002, 0003 and 0004 — `pnpm db:migrate`
-- will not run it. Apply it by hand: `db:push` (which infers the schema half
-- from src/db/schema.ts) or, better here, paste this file into the Neon SQL
-- editor or psql, because `db:push` cannot infer steps 2 and 4 and would drop
-- `cart_items.user_id` with the carts unbuilt, emptying every customer's cart.
--
-- STEP 6 IS DESTRUCTIVE AND IRREVERSIBLE: it drops `cart_items.user_id`. The
-- link from an item to its owner then exists only through `carts`, which is
-- why the backfill in steps 2 and 4 must succeed first. Everything is wrapped
-- in one transaction, so a failure anywhere leaves the old shape intact.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- The applied coupon belongs to the cart, not to any one line in it. With no
-- cart row there was nowhere to put it. `carts` gives it a home (`coupon_id`,
-- `coupon_applied_at`, `coupon_checked_at`, which move together) and makes
-- "one cart per user" a constraint the database enforces rather than a
-- convention the application maintains.
--
-- `src/db/schema.ts` has described this shape since the cart work landed, but
-- it reached the developer's database through `db:push` and no file under
-- drizzle/ ever defined it. A database built through the migration path got
-- no `carts` table at all, and since `cart_items.user_id` is gone from the
-- schema the cart broke outright rather than degrading.
--
-- ---------------------------------------------------------------------------
-- ORDER OF OPERATIONS
-- ---------------------------------------------------------------------------
--
--   1. create `carts`
--   2. one cart per distinct existing `cart_items.user_id`
--   3. add `cart_items.cart_id`, nullable
--   4. populate it by joining the backfilled carts on `user_id`
--   5. make it NOT NULL and give it its foreign key
--   6. drop the old `user_id` foreign key, index and column
--   7. index `cart_id`
--
-- Steps 2 and 4 are the whole reason this file is written by hand: `user_id`
-- is the only record of who each existing item belongs to, so the carts must
-- be built and the items pointed at them *before* step 6 removes it.
-- Reversing 4 and 6 silently empties every cart in the database.
--
-- Written to be safe to re-run, and safe on a database where `db:push` has
-- already made these changes: every step is guarded, and steps 2 and 4 are
-- skipped entirely once `user_id` is gone.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The cart itself
-- ---------------------------------------------------------------------------
--
-- No separate index on "user_id" — DELIBERATE, do not "fix" this. The UNIQUE
-- constraint already builds a btree on that column, and every lookup in the
-- cart repository is keyed on it; a second index would be the same tree
-- maintained twice on every write. The comment above `carts` in
-- src/db/schema.ts says the same thing.
--
-- The UNIQUE is also what makes "one cart per user" true. Dropping it is what
-- would later allow saved or multiple carts; nothing else needs to change.

CREATE TABLE IF NOT EXISTS "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"coupon_id" uuid,
	"coupon_applied_at" timestamp,
	"coupon_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "carts_user_id_unique" UNIQUE("user_id")
);

-- Deleting the account takes the cart with it.
ALTER TABLE "carts" DROP CONSTRAINT IF EXISTS "carts_user_id_user_id_fk";
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_user_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

-- SET NULL, deliberately not cascade: deleting a coupon must not delete the
-- carts that referenced it.
ALTER TABLE "carts" DROP CONSTRAINT IF EXISTS "carts_coupon_id_coupons_id_fk";
ALTER TABLE "carts" ADD CONSTRAINT "carts_coupon_id_coupons_id_fk"
	FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;

-- ---------------------------------------------------------------------------
-- 3. The new link column, nullable for now
-- ---------------------------------------------------------------------------
--
-- Added before the backfill runs, because step 4 writes into it. It only
-- becomes NOT NULL in step 5, once every row has a value.

ALTER TABLE "cart_items" ADD COLUMN IF NOT EXISTS "cart_id" uuid;

-- ---------------------------------------------------------------------------
-- 2 and 4. Backfill — must happen before step 6 drops "user_id"
-- ---------------------------------------------------------------------------
--
-- Guarded on "user_id" still existing, so this file stays runnable against a
-- database that `db:push` has already migrated. Both statements go through
-- EXECUTE so a database without that column never has to parse a reference
-- to it.
--
-- Both are idempotent: the insert conflicts away on the unique user, and the
-- update only touches rows whose cart_id is still NULL.

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'cart_items'
			AND column_name = 'user_id'
	) THEN
		-- 2. One cart per distinct owner of existing items. A customer with an
		-- empty cart gets no row; the repository creates one on first add.
		EXECUTE '
			INSERT INTO "carts" ("user_id")
			SELECT DISTINCT ci."user_id" FROM "cart_items" ci
			ON CONFLICT ("user_id") DO NOTHING
		';

		-- 4. Point every existing item at its owner's new cart. The apostrophe
		-- is safe here: the DO body is dollar-quoted, not single-quoted.
		EXECUTE '
			UPDATE "cart_items" ci
			SET "cart_id" = c."id"
			FROM "carts" c
			WHERE c."user_id" = ci."user_id"
				AND ci."cart_id" IS NULL
		';
	END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Make the link mandatory
-- ---------------------------------------------------------------------------
--
-- If any row still has a NULL cart_id this fails and the whole transaction
-- rolls back — which is the wanted behaviour. That state means an item could
-- not be traced back to an owner, and failing loudly is better than quietly
-- discarding somebody's cart.

ALTER TABLE "cart_items" ALTER COLUMN "cart_id" SET NOT NULL;

ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_cart_id_carts_id_fk";
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk"
	FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;

-- ---------------------------------------------------------------------------
-- 6. Drop the old ownership column — DESTRUCTIVE, IRREVERSIBLE
-- ---------------------------------------------------------------------------
--
-- The names are the ones 0000_long_ultragirl.sql actually created:
-- "cart_items_user_id_user_id_fk" (Drizzle's <table>_<col>_<ref>_<refcol>_fk)
-- and the index "idx_cart_user_id". Nothing after this point can reconstruct
-- the item → user link except through "carts".

ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_user_id_user_id_fk";
DROP INDEX IF EXISTS "idx_cart_user_id";
ALTER TABLE "cart_items" DROP COLUMN IF EXISTS "user_id";

-- ---------------------------------------------------------------------------
-- 7. Index the new link
-- ---------------------------------------------------------------------------
--
-- Reading a cart is "every item for this cart", so this is the index that
-- replaces idx_cart_user_id. "idx_cart_product_id" is untouched.

CREATE INDEX IF NOT EXISTS "idx_cart_items_cart_id" ON "cart_items" USING btree ("cart_id");

COMMIT;
