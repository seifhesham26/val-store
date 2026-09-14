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
});
