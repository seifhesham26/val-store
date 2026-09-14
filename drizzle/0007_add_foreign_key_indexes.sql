-- NOT JOURNALLED. Apply this file out of band to existing databases. Fresh
-- databases created with `db:push` receive the indexes from `schema.ts`.
--
-- These are the eight previously uncovered foreign keys whose child tables
-- can grow substantially, whose parent rows are physically deleted, or whose
-- columns are used directly by application queries.

CREATE INDEX IF NOT EXISTS "idx_cart_items_variant_id" ON "cart_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_carts_coupon_id" ON "carts" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_coupon_usages_order_id" ON "coupon_usages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inventory_created_by" ON "inventory_logs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_order_items_variant_id" ON "order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orders_billing_address_id" ON "orders" USING btree ("billing_address_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orders_coupon_id" ON "orders" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orders_shipping_address_id" ON "orders" USING btree ("shipping_address_id");
