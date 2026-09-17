/**
 * Database index invariants.
 *
 * Read-only: this inspects the live schema so `db:push`, a baseline rebuild,
 * or a future migration cannot silently recreate duplicate btree indexes.
 */

import { afterAll, describe, expect, it } from "vitest";
import { client } from "@/db";

afterAll(async () => {
  await client.end({ timeout: 5 });
});

describe("public database indexes", () => {
  it("has no two indexes with the same table, method, keys, and predicate", async () => {
    const duplicates = await client<
      { tableName: string; indexNames: string[] }[]
    >`
      select
        table_rel.relname as "tableName",
        array_agg(index_rel.relname order by index_rel.relname) as "indexNames"
      from pg_index index_info
      join pg_class index_rel on index_rel.oid = index_info.indexrelid
      join pg_class table_rel on table_rel.oid = index_info.indrelid
      join pg_namespace namespace on namespace.oid = table_rel.relnamespace
      cross join lateral (
        select string_agg(
          pg_get_indexdef(index_info.indexrelid, key_position, true),
          ', ' order by key_position
        ) as key_definition
        from generate_series(1, index_info.indnkeyatts) key_position
      ) keys
      where namespace.nspname = 'public'
      group by
        table_rel.relname,
        index_rel.relam,
        keys.key_definition,
        pg_get_expr(index_info.indexprs, index_info.indrelid),
        pg_get_expr(index_info.indpred, index_info.indrelid)
      having count(*) > 1
      order by table_rel.relname
    `;

    expect(duplicates).toEqual([]);
  });

  it("retains the unique constraints that own catalogue identifiers", async () => {
    const constraints = await client<{ constraintName: string }[]>`
      select constraint_name as "constraintName"
      from information_schema.table_constraints
      where constraint_schema = 'public'
        and constraint_type = 'UNIQUE'
        and constraint_name in (
          'categories_slug_unique',
          'content_sections_section_type_unique',
          'coupons_code_unique',
          'customers_phone_unique',
          'legal_pages_slug_unique',
          'newsletter_subscribers_email_unique',
          'orders_order_number_unique',
          'product_variants_sku_unique',
          'products_sku_unique',
          'products_slug_unique'
        )
      order by constraint_name
    `;

    expect(constraints.map((row) => row.constraintName)).toEqual([
      "categories_slug_unique",
      "content_sections_section_type_unique",
      "coupons_code_unique",
      "customers_phone_unique",
      "legal_pages_slug_unique",
      "newsletter_subscribers_email_unique",
      "orders_order_number_unique",
      "product_variants_sku_unique",
      "products_sku_unique",
      "products_slug_unique",
    ]);
  });

  it("leaves only reviewed low-value foreign keys without a supporting index", async () => {
    const uncovered = await client<{ constraintName: string }[]>`
      select constraint_info.conname as "constraintName"
      from pg_constraint constraint_info
      join pg_class table_rel on table_rel.oid = constraint_info.conrelid
      join pg_namespace namespace on namespace.oid = table_rel.relnamespace
      where constraint_info.contype = 'f'
        and namespace.nspname = 'public'
        and not exists (
          select 1
          from pg_index index_info
          where index_info.indrelid = constraint_info.conrelid
            and index_info.indisvalid
            and index_info.indisready
            and index_info.indpred is null
            and index_info.indnkeyatts >= cardinality(constraint_info.conkey)
            and not exists (
              select 1
              from generate_subscripts(constraint_info.conkey, 1) position
              where (index_info.indkey::smallint[])[position - 1]
                is distinct from constraint_info.conkey[position]
            )
        )
      order by constraint_info.conname
    `;

    expect(uncovered.map((row) => row.constraintName)).toEqual([
      // History is read by section, not author, and grows only on CMS edits.
      "content_sections_history_created_by_user_id_fk",
      // Bounded configuration table, never filtered by editor.
      "content_sections_updated_by_user_id_fk",
      // History is read by page, not author, and grows only on legal edits.
      "legal_pages_history_created_by_user_id_fk",
      // Bounded configuration table, never filtered by editor.
      "legal_pages_updated_by_user_id_fk",
      // Orders are retained rather than deleted, and no query resolves a
      // review from its order id.
      "reviews_order_id_orders_id_fk",
      // Bounded configuration tables, never filtered by editor.
      "shipping_rates_updated_by_user_id_fk",
      "site_settings_updated_by_user_id_fk",
      // Notification lists start from their indexed user id, while products
      // are soft-deleted rather than physically removed.
      "user_notifications_product_id_products_id_fk",
    ]);
  });
});
