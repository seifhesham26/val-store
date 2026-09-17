-- Additive customer-data access audit foundation.
--
-- This repository's day-to-day schema workflow is `pnpm db:push`. The
-- migration journal intentionally does not include the later out-of-band SQL
-- files, so do not assume `pnpm db:migrate` will apply this file.

CREATE TABLE IF NOT EXISTS "customer_data_access_audits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" text NOT NULL,
  "actor_name" varchar(255),
  "actor_email" varchar(255) NOT NULL,
  "actor_role" "user_role" NOT NULL,
  "subject_user_id" text,
  "order_id" uuid,
  "action" varchar(32) NOT NULL,
  "field_group" varchar(32) NOT NULL,
  "reason" varchar(32) NOT NULL,
  "reason_note" text,
  "confirmed_customer_request" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_customer_access_actor_created"
  ON "customer_data_access_audits" USING btree ("actor_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_customer_access_subject_created"
  ON "customer_data_access_audits" USING btree ("subject_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_customer_access_order_created"
  ON "customer_data_access_audits" USING btree ("order_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_customer_access_created_at"
  ON "customer_data_access_audits" USING btree ("created_at");
