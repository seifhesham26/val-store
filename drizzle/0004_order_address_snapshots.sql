-- Order address snapshots, and the two foreign keys that made deletion
-- impossible.
--
-- NOT in meta/_journal.json, like 0002 and 0003 — `pnpm db:migrate` will not
-- run it. Apply with `db:push` (which handles the column additions and the FK
-- changes from src/db/schema.ts) and then run the BACKFILL section below by
-- hand, from the Neon SQL editor or psql. The backfill is the half `db:push`
-- cannot infer, and it is safe to run more than once.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS WRONG
-- ---------------------------------------------------------------------------
--
-- `orders.shipping_address_id` and `orders.billing_address_id` referenced
-- `addresses` with no ON DELETE clause, so Postgres used NO ACTION. Two
-- consequences, both reachable from the UI:
--
--   1. A customer could not delete a saved address once any order referenced
--      it. The delete raised 23503, and the account page's delete mutation had
--      no onError handler, so the button did nothing at all — silently, every
--      time. On the database as found, 2 of 2 saved addresses were in this
--      state.
--
--   2. `addresses.user_id` cascades from `user`, so deleting a customer tried
--      to delete their addresses and hit the same NO ACTION. Any customer who
--      had ever ordered could not be deleted — even though `orders.user_id` is
--      SET NULL specifically so that orders outlive the account. Account
--      deletion and any erasure request were blocked at the database.
--
-- `inventory_logs.created_by` had the same NO ACTION and blocked the same
-- deletion. It is set to the *buyer* on every `sale` row written at checkout,
-- so it is not only an admin-attribution column.
--
-- Dropping the reference is not the answer: an order has to keep the address
-- it was shipped to. So the address is copied onto the order at checkout and
-- the ids become a convenience link. That is also more correct on its own
-- terms — editing a saved address must not retroactively change where an
-- already-shipped order says it went.
--
-- ---------------------------------------------------------------------------
-- SCHEMA (db:push applies this from src/db/schema.ts; here for the record)
-- ---------------------------------------------------------------------------

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "shipping_address_snapshot" jsonb,
  ADD COLUMN IF NOT EXISTS "billing_address_snapshot" jsonb;

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_shipping_address_id_addresses_id_fk";
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_address_id_addresses_id_fk"
  FOREIGN KEY ("shipping_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL;

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_billing_address_id_addresses_id_fk";
ALTER TABLE "orders" ADD CONSTRAINT "orders_billing_address_id_addresses_id_fk"
  FOREIGN KEY ("billing_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL;

ALTER TABLE "inventory_logs" DROP CONSTRAINT IF EXISTS "inventory_logs_created_by_user_id_fk";
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_created_by_user_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- BACKFILL — run this once, by hand, on an existing database
-- ---------------------------------------------------------------------------
--
-- Fills the snapshot for orders placed before the column existed, from the
-- address rows that are still there. Orders whose address is already gone
-- cannot be recovered and keep a NULL snapshot; the repository falls back to
-- the (now null) join for those, exactly as it did before.
--
-- Keys match the `OrderAddress` DTO in
-- src/domain/orders/entities/order.entity.ts. If that shape changes, this has
-- to change with it.
--
-- Idempotent: only touches rows whose snapshot is still NULL.

UPDATE "orders" o
SET "shipping_address_snapshot" = jsonb_build_object(
      'fullName',     a."full_name",
      'addressLine1', a."address_line1",
      'addressLine2', a."address_line2",
      'city',         a."city",
      'state',        a."state",
      'postalCode',   a."postal_code",
      'country',      a."country",
      'phone',        a."phone"
    )
FROM "addresses" a
WHERE o."shipping_address_id" = a."id"
  AND o."shipping_address_snapshot" IS NULL;

UPDATE "orders" o
SET "billing_address_snapshot" = jsonb_build_object(
      'fullName',     a."full_name",
      'addressLine1', a."address_line1",
      'addressLine2', a."address_line2",
      'city',         a."city",
      'state',        a."state",
      'postalCode',   a."postal_code",
      'country',      a."country",
      'phone',        a."phone"
    )
FROM "addresses" a
WHERE o."billing_address_id" = a."id"
  AND o."billing_address_snapshot" IS NULL;
