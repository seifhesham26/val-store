-- NOT JOURNALLED. Apply this file out of band to databases created from the
-- current baseline. The future canonical baseline must omit these indexes.
--
-- Each dropped index duplicates a UNIQUE constraint-backed btree on the same
-- table and column. The constraint indexes are deliberately preserved.

DROP INDEX IF EXISTS "public"."idx_categories_slug";--> statement-breakpoint
DROP INDEX IF EXISTS "public"."idx_content_sections_type";--> statement-breakpoint
DROP INDEX IF EXISTS "public"."idx_coupons_code";--> statement-breakpoint
DROP INDEX IF EXISTS "public"."idx_customers_phone";--> statement-breakpoint
DROP INDEX IF EXISTS "public"."idx_legal_pages_slug";--> statement-breakpoint
DROP INDEX IF EXISTS "public"."idx_newsletter_email";--> statement-breakpoint
DROP INDEX IF EXISTS "public"."idx_orders_order_number";--> statement-breakpoint
DROP INDEX IF EXISTS "public"."idx_variants_sku";--> statement-breakpoint
DROP INDEX IF EXISTS "public"."idx_products_sku";--> statement-breakpoint
DROP INDEX IF EXISTS "public"."idx_products_slug";
