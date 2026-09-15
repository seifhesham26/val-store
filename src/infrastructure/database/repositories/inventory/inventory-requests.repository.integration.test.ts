/**
 * Inventory inspection and adjustment-request schema invariants.
 *
 * These tests write isolated fixtures because the behavior under test belongs
 * to PostgreSQL: partial uniqueness, check constraints, and `ON DELETE SET
 * NULL`. The application cannot faithfully substitute for any of them.
 */

import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client } from "@/db";

interface Fixture {
  workerId: string;
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
}

let fixture: Fixture;

beforeEach(async () => {
  const token = randomUUID();
  fixture = {
    workerId: `inventory-test-worker-${token}`,
    productId: randomUUID(),
    variantId: randomUUID(),
    sku: `INV-TEST-${token}`,
    productName: `Inventory test product ${token}`,
  };

  await client`
    insert into "user" ("id", "name", "email", "email_verified")
    values (
      ${fixture.workerId},
      'Inventory Test Worker',
      ${`inventory-${token}@example.invalid`},
      true
    )
  `;
  await client`
    insert into "products" (
      "id", "name", "slug", "sku", "base_price"
    ) values (
      ${fixture.productId},
      ${fixture.productName},
      ${`inventory-test-${token}`},
      ${`PRODUCT-${token}`},
      100
    )
  `;
  await client`
    insert into "product_variants" (
      "id", "product_id", "sku", "size", "color", "stock_quantity"
    ) values (
      ${fixture.variantId},
      ${fixture.productId},
      ${fixture.sku},
      'M',
      'Black',
      2
    )
  `;
});

afterEach(async () => {
  const [{ requestsTable, inspectionsTable }] = await client<
    { requestsTable: string | null; inspectionsTable: string | null }[]
  >`
    select
      to_regclass('public.inventory_adjustment_requests')::text as "requestsTable",
      to_regclass('public.inventory_inspections')::text as "inspectionsTable"
  `;

  if (requestsTable) {
    await client`
      delete from "inventory_adjustment_requests" where "sku" = ${fixture.sku}
    `;
  }
  if (inspectionsTable) {
    await client`
      delete from "inventory_inspections" where "sku" = ${fixture.sku}
    `;
  }

  await client`
    delete from "product_variants" where "id" = ${fixture.variantId}
  `;
  await client`delete from "products" where "id" = ${fixture.productId}`;
  await client`delete from "user" where "id" = ${fixture.workerId}`;
});

afterAll(async () => {
  await client.end({ timeout: 5 });
});

describe("inventory inspection cycles", () => {
  it("permits completed history but rejects a second open cycle for one variant", async () => {
    await client`
      insert into "inventory_inspections" (
        "variant_id", "product_name", "sku", "size", "color",
        "trigger_stock", "status", "cycle_ended_at"
      ) values (
        ${fixture.variantId}, ${fixture.productName}, ${fixture.sku}, 'M',
        'Black', 2, 'pending', null
      )
    `;

    await expect(
      client`
        insert into "inventory_inspections" (
          "variant_id", "product_name", "sku", "size", "color",
          "trigger_stock", "status", "cycle_ended_at"
        ) values (
          ${fixture.variantId}, ${fixture.productName}, ${fixture.sku}, 'M',
          'Black', 2, 'pending', null
        )
      `
    ).rejects.toMatchObject({ code: "23505" });

    await client`
      insert into "inventory_inspections" (
        "variant_id", "product_name", "sku", "size", "color",
        "trigger_stock", "status", "cycle_ended_at"
      ) values
        (
          ${fixture.variantId}, ${fixture.productName}, ${fixture.sku}, 'M',
          'Black', 2, 'all_fine', now() - interval '2 days'
        ),
        (
          ${fixture.variantId}, ${fixture.productName}, ${fixture.sku}, 'M',
          'Black', 2, 'flaw_reported', now() - interval '1 day'
        )
    `;

    const [{ count }] = await client<{ count: number }[]>`
      select count(*)::int as count
      from "inventory_inspections"
      where "sku" = ${fixture.sku}
    `;
    expect(count).toBe(3);
  });
});

describe("inventory adjustment request constraints", () => {
  it("rejects zero requested and approved quantities", async () => {
    await expect(
      client`
        insert into "inventory_adjustment_requests" (
          "variant_id", "requester_id", "requester_name", "product_name",
          "sku", "size", "color", "category", "requested_quantity",
          "explanation", "stock_at_request", "status"
        ) values (
          ${fixture.variantId}, ${fixture.workerId}, 'Inventory Test Worker',
          ${fixture.productName}, ${fixture.sku}, 'M', 'Black', 'missing', 0,
          'Zero is not a valid adjustment.', 2, 'pending'
        )
      `
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      client`
        insert into "inventory_adjustment_requests" (
          "variant_id", "requester_id", "requester_name", "reviewer_id",
          "reviewer_name", "product_name", "sku", "size", "color",
          "category", "requested_quantity", "explanation",
          "stock_at_request", "status", "approved_quantity",
          "decision_explanation", "reviewed_at"
        ) values (
          ${fixture.variantId}, ${fixture.workerId}, 'Inventory Test Worker',
          ${fixture.workerId}, 'Inventory Test Worker', ${fixture.productName},
          ${fixture.sku}, 'M', 'Black', 'extra', 1,
          'One extra unit was found.', 2, 'approved', 0,
          'Zero is not a valid approved quantity.', now()
        )
      `
    ).rejects.toMatchObject({ code: "23514" });
  });
});

describe("inventory history references", () => {
  it("keeps snapshots when the worker and variant are deleted", async () => {
    const [inspection] = await client<{ id: string }[]>`
      insert into "inventory_inspections" (
        "variant_id", "product_name", "sku", "size", "color",
        "trigger_stock", "status", "completed_by", "completed_by_name",
        "completed_at", "cycle_ended_at"
      ) values (
        ${fixture.variantId}, ${fixture.productName}, ${fixture.sku}, 'M',
        'Black', 2, 'flaw_reported', ${fixture.workerId},
        'Inventory Test Worker', now(), now()
      )
      returning "id"
    `;

    const [inventoryLog] = await client<{ id: string }[]>`
      insert into "inventory_logs" (
        "variant_id", "change_type", "quantity_change", "previous_quantity",
        "new_quantity", "reason", "created_by"
      ) values (
        ${fixture.variantId}, 'adjustment', 1, 2, 3,
        'Inventory adjustment test fixture', ${fixture.workerId}
      )
      returning "id"
    `;

    const [request] = await client<{ id: string }[]>`
      insert into "inventory_adjustment_requests" (
        "variant_id", "inspection_id", "requester_id", "requester_name",
        "reviewer_id", "reviewer_name", "inventory_log_id", "product_name",
        "sku", "size", "color", "category", "requested_quantity",
        "explanation", "stock_at_request", "status", "approved_quantity",
        "decision_explanation", "reviewed_at"
      ) values (
        ${fixture.variantId}, ${inspection.id}, ${fixture.workerId},
        'Inventory Test Worker', ${fixture.workerId}, 'Inventory Test Worker',
        ${inventoryLog.id}, ${fixture.productName}, ${fixture.sku}, 'M',
        'Black', 'extra', 1, 'One extra unit was found.', 2, 'approved', 1,
        'Count verified.', now()
      )
      returning "id"
    `;

    await client`delete from "user" where "id" = ${fixture.workerId}`;
    await client`
      delete from "product_variants" where "id" = ${fixture.variantId}
    `;

    const [storedInspection] = await client<
      {
        variantId: string | null;
        completedBy: string | null;
        completedByName: string | null;
        productName: string;
        sku: string;
        size: string | null;
        color: string | null;
      }[]
    >`
      select
        "variant_id" as "variantId",
        "completed_by" as "completedBy",
        "completed_by_name" as "completedByName",
        "product_name" as "productName",
        "sku",
        "size",
        "color"
      from "inventory_inspections"
      where "id" = ${inspection.id}
    `;
    const [storedRequest] = await client<
      {
        variantId: string | null;
        requesterId: string | null;
        reviewerId: string | null;
        inventoryLogId: string | null;
        inspectionId: string | null;
        requesterName: string;
        reviewerName: string | null;
        productName: string;
        sku: string;
        size: string | null;
        color: string | null;
      }[]
    >`
      select
        "variant_id" as "variantId",
        "requester_id" as "requesterId",
        "reviewer_id" as "reviewerId",
        "inventory_log_id" as "inventoryLogId",
        "inspection_id" as "inspectionId",
        "requester_name" as "requesterName",
        "reviewer_name" as "reviewerName",
        "product_name" as "productName",
        "sku",
        "size",
        "color"
      from "inventory_adjustment_requests"
      where "id" = ${request.id}
    `;

    expect(storedInspection).toEqual({
      variantId: null,
      completedBy: null,
      completedByName: "Inventory Test Worker",
      productName: fixture.productName,
      sku: fixture.sku,
      size: "M",
      color: "Black",
    });
    expect(storedRequest).toEqual({
      variantId: null,
      requesterId: null,
      reviewerId: null,
      inventoryLogId: null,
      inspectionId: inspection.id,
      requesterName: "Inventory Test Worker",
      reviewerName: "Inventory Test Worker",
      productName: fixture.productName,
      sku: fixture.sku,
      size: "M",
      color: "Black",
    });
  });
});
