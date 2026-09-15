-- Add immutable inventory inspection and adjustment-request history.
--
-- This repository's day-to-day schema workflow is `pnpm db:push`. The
-- migration journal intentionally does not include the later out-of-band SQL
-- files, so do not assume `pnpm db:migrate` will apply this file.

DO $$ BEGIN
  CREATE TYPE "inventory_adjustment_category" AS ENUM (
    'damaged',
    'missing',
    'extra'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "inventory_adjustment_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "inventory_inspection_status" AS ENUM (
    'pending',
    'all_fine',
    'flaw_reported'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TYPE "notification_type"
  ADD VALUE IF NOT EXISTS 'inventory_request';

CREATE TABLE IF NOT EXISTS "inventory_inspections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "variant_id" uuid,
  "product_name" varchar(255) NOT NULL,
  "sku" varchar(100) NOT NULL,
  "size" varchar(50),
  "color" varchar(50),
  "trigger_stock" integer NOT NULL,
  "status" "inventory_inspection_status" DEFAULT 'pending' NOT NULL,
  "completed_by" text,
  "completed_by_name" varchar(255),
  "completed_at" timestamp,
  "cycle_ended_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_inspections_variant_id_product_variants_id_fk"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id")
    ON DELETE SET NULL,
  CONSTRAINT "inventory_inspections_completed_by_user_id_fk"
    FOREIGN KEY ("completed_by") REFERENCES "user"("id")
    ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_inventory_inspections_open_variant"
  ON "inventory_inspections" USING btree ("variant_id")
  WHERE "cycle_ended_at" IS NULL AND "variant_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_inventory_inspections_variant"
  ON "inventory_inspections" USING btree ("variant_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_inspections_completed_by"
  ON "inventory_inspections" USING btree ("completed_by");

CREATE TABLE IF NOT EXISTS "inventory_adjustment_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "variant_id" uuid,
  "inspection_id" uuid,
  "requester_id" text,
  "reviewer_id" text,
  "inventory_log_id" uuid,
  "product_name" varchar(255) NOT NULL,
  "sku" varchar(100) NOT NULL,
  "size" varchar(50),
  "color" varchar(50),
  "category" "inventory_adjustment_category" NOT NULL,
  "requested_quantity" integer NOT NULL,
  "explanation" text NOT NULL,
  "stock_at_request" integer NOT NULL,
  "status" "inventory_adjustment_status" DEFAULT 'pending' NOT NULL,
  "approved_quantity" integer,
  "decision_explanation" text,
  "requester_name" varchar(255) NOT NULL,
  "reviewer_name" varchar(255),
  "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_adjustment_requests_requested_quantity_positive"
    CHECK ("requested_quantity" > 0),
  CONSTRAINT "inventory_adjustment_requests_approved_quantity_positive"
    CHECK ("approved_quantity" IS NULL OR "approved_quantity" > 0),
  CONSTRAINT "inventory_adjustment_requests_variant_id_product_variants_id_fk"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id")
    ON DELETE SET NULL,
  CONSTRAINT "inventory_requests_inspection_id_fk"
    FOREIGN KEY ("inspection_id") REFERENCES "inventory_inspections"("id")
    ON DELETE SET NULL,
  CONSTRAINT "inventory_adjustment_requests_requester_id_user_id_fk"
    FOREIGN KEY ("requester_id") REFERENCES "user"("id")
    ON DELETE SET NULL,
  CONSTRAINT "inventory_adjustment_requests_reviewer_id_user_id_fk"
    FOREIGN KEY ("reviewer_id") REFERENCES "user"("id")
    ON DELETE SET NULL,
  CONSTRAINT "inventory_requests_inventory_log_id_fk"
    FOREIGN KEY ("inventory_log_id") REFERENCES "inventory_logs"("id")
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_inventory_adjustment_requests_status_created"
  ON "inventory_adjustment_requests" USING btree ("status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_inventory_adjustment_requests_variant_status"
  ON "inventory_adjustment_requests" USING btree ("variant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_inventory_adjustment_requests_requester"
  ON "inventory_adjustment_requests" USING btree ("requester_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_adjustment_requests_reviewer"
  ON "inventory_adjustment_requests" USING btree ("reviewer_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_adjustment_requests_inspection"
  ON "inventory_adjustment_requests" USING btree ("inspection_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_adjustment_requests_inventory_log"
  ON "inventory_adjustment_requests" USING btree ("inventory_log_id");
