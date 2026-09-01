-- Written to be safe to run twice, and safe to run on a database that was
-- built with `db:push`.
--
-- The first three statements are not new work: `order_items.refunded_quantity`
-- (the partial-refund model) and `orders.coupon_id` were added to
-- `src/db/schema.ts` and applied with `db:push`, but never captured in a
-- migration — so the 0000 baseline did not actually describe the schema, and
-- `drizzle-kit generate` swept them up here alongside the two indexes. On a
-- pushed database they already exist; on a fresh one they must be created.
-- Guarding each statement is what makes both cases work.
--
-- The last two are the point of this migration: the storefront lists products
-- with `WHERE is_active = true ORDER BY created_at DESC LIMIT n`, and "My
-- orders" pages `WHERE user_id = ? ORDER BY created_at DESC`. Neither
-- single-column index can serve those without sorting the whole match set.

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "refunded_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "coupon_id" uuid;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk"
    FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_orders_user_created" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_products_active_created" ON "products" USING btree ("is_active","created_at");
