/**
 * Inventory inspection and adjustment-request schema invariants.
 *
 * These tests write isolated fixtures because the behavior under test belongs
 * to PostgreSQL: partial uniqueness, check constraints, and `ON DELETE SET
 * NULL`. The application cannot faithfully substitute for any of them.
 */

import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/db";
import { DrizzleInventoryRepository } from "./inventory.repository";
import { DrizzleInventoryRequestsRepository } from "./inventory-requests.repository";
import { lockVariantStockState } from "./inventory-stock-state";

const inventory = new DrizzleInventoryRepository();
const requests = new DrizzleInventoryRequestsRepository();

function submit(
  category: "damaged" | "missing" | "extra" = "missing",
  inspectionId?: string
) {
  return requests.submit({
    variantId: fixture.variantId,
    inspectionId,
    requester: { id: fixture.workerId, name: "Original Worker" },
    category,
    requestedQuantity: 2,
    explanation: "Original count explanation",
  });
}

function review(
  requestId: string,
  decision: "approved" | "rejected" = "approved",
  approvedQuantity?: number,
  decisionExplanation?: string
) {
  return requests.review({
    requestId,
    decision,
    approvedQuantity,
    decisionExplanation,
    reviewer: { id: fixture.workerId, name: "Reviewing Admin" },
  });
}

function adjust(newQuantity: number) {
  return inventory.adjustStockWithLog(fixture.variantId, newQuantity, {
    changeType: "adjustment",
    reason: "Transactional stock-state test",
    createdBy: fixture.workerId,
  });
}

function cycles() {
  return client<{ id: string; status: string; cycleEndedAt: Date | null }[]>`
    select id, status, cycle_ended_at as "cycleEndedAt"
    from inventory_inspections where variant_id = ${fixture.variantId}
    order by created_at, id
  `;
}

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

describe("inventory request transactions", () => {
  it("isolates inspection and quarantine predicates between two variants", async () => {
    const otherId = randomUUID();
    await client`insert into product_variants (id, product_id, sku, stock_quantity)
      values (${otherId}, ${fixture.productId}, ${`${fixture.sku}-OTHER`}, 19)`;
    await adjust(0);
    await adjust(15);
    expect(
      await inventory.getVariantSellability([fixture.variantId, otherId])
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantId: fixture.variantId,
          availabilityState: "inspection_pending",
          sellableStock: 5,
        }),
        expect.objectContaining({
          variantId: otherId,
          availabilityState: "available",
          sellableStock: 19,
        }),
      ])
    );
    await submit("missing");
    expect(
      await inventory.getVariantSellability([fixture.variantId, otherId])
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantId: fixture.variantId,
          availabilityState: "quarantined",
          sellableStock: 0,
        }),
        expect.objectContaining({
          variantId: otherId,
          availabilityState: "available",
          sellableStock: 19,
        }),
      ])
    );
    const other = await db.transaction((tx) =>
      lockVariantStockState(tx, otherId)
    );
    expect(other).toMatchObject({
      pendingInspection: false,
      pendingFlaw: false,
      openInspectionId: null,
      sellableStock: 19,
    });
  });

  it("stores immutable snapshots and multiple pending requests while quarantining only flaws", async () => {
    const extra = await submit("extra");
    expect(extra).toMatchObject({
      success: true,
      request: {
        stockAtRequest: 2,
        sku: fixture.sku,
        requester: { name: "Original Worker" },
      },
    });
    expect(
      (await inventory.getVariantSellability([fixture.variantId]))[0]
        .sellableStock
    ).toBe(2);
    const missing = await submit();
    const damaged = await submit("damaged");
    expect(missing.success && damaged.success).toBe(true);
    expect(
      (await inventory.getVariantSellability([fixture.variantId]))[0]
        .availabilityState
    ).toBe("quarantined");
    expect(await inventory.getLogsByVariant(fixture.variantId)).toEqual([]);
    const work = await requests.listWork();
    expect(
      work.pendingRequestGroups.find(
        (group) => group.variantId === fixture.variantId
      )?.requests
    ).toHaveLength(3);
  });

  it("links a pending inspection and completes it as flaw_reported in the submission transaction", async () => {
    await adjust(0);
    await adjust(15);
    const [inspection] = await cycles();
    const result = await submit("damaged", inspection.id);
    expect(result).toMatchObject({
      success: true,
      request: { inspectionId: inspection.id, stockAtRequest: 15 },
    });
    expect((await cycles())[0].status).toBe("flaw_reported");
    const work = await requests.listWork();
    const history = work.history.find(
      (item) =>
        item.kind === "inspection" && item.inspection.id === inspection.id
    );
    expect(history).toMatchObject({
      kind: "inspection",
      inspection: {
        completedBy: { name: "Original Worker" },
        adjustmentRequestId: result.success ? result.request.id : "missing",
      },
    });
  });

  it("completes all-fine once without moving stock or logging, releasing the inspection hold", async () => {
    await adjust(0);
    await adjust(15);
    const [inspection] = await cycles();
    const before = await inventory.getLogsByVariant(fixture.variantId);
    const results = await Promise.all(
      [1, 2].map(() =>
        requests.completeAllFine({
          inspectionId: inspection.id,
          worker: { id: fixture.workerId, name: "Checking Worker" },
        })
      )
    );
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => !result.success)).toEqual([
      { success: false, error: "conflict" },
    ]);
    expect(await inventory.getLogsByVariant(fixture.variantId)).toEqual(before);
    expect(
      (await inventory.getVariantSellability([fixture.variantId]))[0]
    ).toMatchObject({ stockQuantity: 15, sellableStock: 15 });
  });

  it("approves against current stock once, preserving originals and linking exactly one truthful log", async () => {
    const saved = await submit();
    if (!saved.success) throw new Error("submit failed");
    await adjust(8);
    const results = await Promise.all([
      review(saved.request.id),
      review(saved.request.id),
    ]);
    const success = results.find((result) => result.success)!;
    expect(results.filter((result) => !result.success)).toEqual([
      { success: false, error: "conflict" },
    ]);
    expect(success).toMatchObject({
      success: true,
      request: {
        status: "approved",
        approvedQuantity: 2,
        requestedQuantity: 2,
        stockAtRequest: 2,
        explanation: "Original count explanation",
        reviewer: { name: "Reviewing Admin" },
        inventoryLogId: expect.any(String),
      },
    });
    const logs = await inventory.getLogsByVariant(fixture.variantId);
    expect(logs).toHaveLength(2);
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          previousQuantity: 8,
          newQuantity: 6,
          quantityChange: -2,
        }),
      ])
    );
    expect(
      (await inventory.getVariantSellability([fixture.variantId]))[0]
        .stockQuantity
    ).toBe(6);
  });

  it("requires explanations for correction and rejection, then records a corrected delta without changing the original", async () => {
    const saved = await submit("extra");
    if (!saved.success) throw new Error("submit failed");
    expect(await review(saved.request.id, "approved", 3)).toEqual({
      success: false,
      error: "decision_explanation_required",
    });
    expect(await review(saved.request.id, "rejected", undefined, "  ")).toEqual(
      { success: false, error: "decision_explanation_required" }
    );
    expect(await inventory.getLogsByVariant(fixture.variantId)).toEqual([]);
    expect(
      await review(saved.request.id, "approved", 3, " Recounted three ")
    ).toMatchObject({
      success: true,
      request: {
        requestedQuantity: 2,
        approvedQuantity: 3,
        decisionExplanation: "Recounted three",
      },
    });
    expect(
      (await inventory.getVariantSellability([fixture.variantId]))[0]
        .stockQuantity
    ).toBe(5);
  });

  it("rejects negative resulting stock and allows rejection without a stock log", async () => {
    const saved = await submit();
    if (!saved.success) throw new Error("submit failed");
    await adjust(1);
    expect(await review(saved.request.id)).toEqual({
      success: false,
      error: "insufficient_stock",
    });
    const before = await inventory.getLogsByVariant(fixture.variantId);
    expect(
      await review(saved.request.id, "rejected", undefined, "Recount matched")
    ).toMatchObject({
      success: true,
      request: {
        status: "rejected",
        inventoryLogId: null,
        approvedQuantity: null,
      },
    });
    expect(await inventory.getLogsByVariant(fixture.variantId)).toEqual(before);
    expect(
      (await inventory.getVariantSellability([fixture.variantId]))[0]
    ).toMatchObject({ stockQuantity: 1, sellableStock: 1 });
  });

  it("retains quarantine until every pending flaw resolves", async () => {
    const first = await submit();
    const second = await submit("damaged");
    if (!first.success || !second.success) throw new Error("submit failed");
    await review(first.request.id, "rejected", undefined, "Duplicate count");
    expect(
      (await inventory.getVariantSellability([fixture.variantId]))[0]
        .availabilityState
    ).toBe("quarantined");
    await review(second.request.id, "rejected", undefined, "Recount matched");
    expect(
      (await inventory.getVariantSellability([fixture.variantId]))[0]
        .sellableStock
    ).toBe(2);
  });

  it("rolls approval stock, request and cycle back when the audit actor cannot be saved", async () => {
    const saved = await submit();
    if (!saved.success) throw new Error("submit failed");
    await expect(
      requests.review({
        requestId: saved.request.id,
        decision: "approved",
        reviewer: { id: "missing-reviewer", name: "Missing" },
      })
    ).rejects.toMatchObject({ cause: { code: "23503" } });
    expect(
      (await inventory.getVariantSellability([fixture.variantId]))[0]
    ).toMatchObject({ stockQuantity: 2, availabilityState: "quarantined" });
    expect(await inventory.getLogsByVariant(fixture.variantId)).toEqual([]);
    expect(
      (await requests.listWork()).pendingRequestGroups.find(
        (group) => group.variantId === fixture.variantId
      )?.requests[0].status
    ).toBe("pending");
  });

  it("permits only rejection after deletion and retains product and actor snapshots", async () => {
    const saved = await submit();
    if (!saved.success) throw new Error("submit failed");
    await client`delete from product_variants where id = ${fixture.variantId}`;
    expect(await review(saved.request.id)).toEqual({
      success: false,
      error: "variant_deleted",
    });
    expect(
      await review(saved.request.id, "rejected", undefined, "Variant removed")
    ).toMatchObject({
      success: true,
      request: {
        variantId: null,
        sku: fixture.sku,
        productName: fixture.productName,
      },
    });
    expect(await submit()).toEqual({
      success: false,
      error: "variant_deleted",
    });
  });

  it("rejects manually unavailable submissions and stale inspection commands", async () => {
    await client`update product_variants set is_available = false where id = ${fixture.variantId}`;
    expect(await submit()).toEqual({
      success: false,
      error: "variant_unavailable",
    });
    await client`update product_variants set is_available = true where id = ${fixture.variantId}`;
    expect(await submit("missing", randomUUID())).toEqual({
      success: false,
      error: "conflict",
    });
    expect(
      await requests.completeAllFine({
        inspectionId: randomUUID(),
        worker: { id: fixture.workerId, name: "Worker" },
      })
    ).toEqual({ success: false, error: "not_found" });
  });

  it("counts work items and excludes closed pending inspections", async () => {
    const initial = await requests.countPending();
    await adjust(0);
    await adjust(15);
    await submit("extra");
    await submit("extra");
    expect(await requests.countPending()).toBe(initial + 3);
    await adjust(25);
    expect(await requests.countPending()).toBe(initial + 2);
  });
});

describe("inventory inspection cycles", () => {
  it("serializes concurrent adjustments with truthful logs and one open cycle", async () => {
    await client`update product_variants set stock_quantity = 21 where id = ${fixture.variantId}`;
    const results = await Promise.all([adjust(20), adjust(19)]);
    const first = results.find((result) => result?.previousQuantity === 21)!;
    const second = results.find((result) => result?.previousQuantity !== 21)!;
    expect(first).not.toBeNull();
    expect(second.previousQuantity).toBe(first.newQuantity);
    const logs = await inventory.getLogsByVariant(fixture.variantId);
    expect(logs).toHaveLength(2);
    expect(
      logs.map((log) => ({
        previousQuantity: log.previousQuantity,
        newQuantity: log.newQuantity,
      }))
    ).toEqual(
      expect.arrayContaining([
        { previousQuantity: 21, newQuantity: first.newQuantity },
        {
          previousQuantity: first.newQuantity,
          newQuantity: second.newQuantity,
        },
      ])
    );
    expect(await cycles()).toHaveLength(1);
    expect(
      (await inventory.getVariantSellability([fixture.variantId]))[0]
    ).toMatchObject({
      stockQuantity: second.newQuantity,
      availabilityState: "inspection_pending",
    });
  });

  it("opens once at 21 to 20, retains all_fine through 1, closes at zero and starts a fresh cycle", async () => {
    await client`update product_variants set stock_quantity = 21 where id = ${fixture.variantId}`;
    await adjust(20);
    const opened = await cycles();
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ status: "pending", cycleEndedAt: null });
    await adjust(19);
    expect(await cycles()).toEqual(opened);
    await client`update inventory_inspections set status = 'all_fine', completed_at = now() where id = ${opened[0].id}`;
    await adjust(1);
    expect(await cycles()).toEqual([{ ...opened[0], status: "all_fine" }]);
    expect(
      (await inventory.getVariantSellability([fixture.variantId]))[0]
    ).toMatchObject({
      sellableStock: 1,
      availabilityState: "available",
    });
    await adjust(0);
    expect((await cycles())[0].cycleEndedAt).not.toBeNull();
    await adjust(15);
    const restarted = await cycles();
    expect(restarted).toHaveLength(2);
    expect(restarted[1]).toMatchObject({
      status: "pending",
      cycleEndedAt: null,
    });
    expect(restarted[1].id).not.toBe(opened[0].id);
  });

  it("closes a pending cycle on restock above 20 and reports sellability changes", async () => {
    await adjust(0);
    const opened = await adjust(15);
    expect(opened).toMatchObject({
      previousQuantity: 0,
      newQuantity: 15,
      sellabilityChanged: true,
    });
    expect(await inventory.getVariantSellability([fixture.variantId])).toEqual([
      {
        variantId: fixture.variantId,
        stockQuantity: 15,
        isAvailable: true,
        sellableStock: 5,
        availabilityState: "inspection_pending",
      },
    ]);
    await adjust(21);
    expect((await cycles())[0].cycleEndedAt).not.toBeNull();
    expect(await inventory.getVariantSellability([fixture.variantId])).toEqual([
      {
        variantId: fixture.variantId,
        stockQuantity: 21,
        isAvailable: true,
        sellableStock: 21,
        availabilityState: "available",
      },
    ]);
  });

  it("closes the cycle from 10 to 25 without changing manual availability", async () => {
    await client`update product_variants
      set stock_quantity = 21, is_available = false
      where id = ${fixture.variantId}`;
    await adjust(10);
    const [opened] = await cycles();
    expect(opened).toMatchObject({ status: "pending", cycleEndedAt: null });

    await adjust(25);

    expect((await cycles())[0].cycleEndedAt).not.toBeNull();
    const [variant] = await client<
      { stockQuantity: number; isAvailable: boolean }[]
    >`
      select stock_quantity as "stockQuantity", is_available as "isAvailable"
      from product_variants where id = ${fixture.variantId}
    `;
    expect(variant).toEqual({ stockQuantity: 25, isAvailable: false });
  });

  it.each([true, false])(
    "keeps manual availability %s through zero and positive writes",
    async (available) => {
      await client`update product_variants set is_available = ${available} where id = ${fixture.variantId}`;
      for (const quantity of [0, 15, 25]) {
        await adjust(quantity);
        const [row] =
          await client`select is_available from product_variants where id = ${fixture.variantId}`;
        expect(row.is_available).toBe(available);
      }
      const [{ count }] =
        await client`select count(*)::int as count from inventory_logs where variant_id = ${fixture.variantId}`;
      expect(count).toBe(3);
    }
  );

  it("rolls stock and reconciliation back if the audit insert fails", async () => {
    await expect(
      inventory.adjustStockWithLog(fixture.variantId, 0, {
        changeType: "adjustment",
        createdBy: "missing-inventory-test-actor",
      })
    ).rejects.toMatchObject({ cause: { code: "23503" } });
    const [row] =
      await client`select stock_quantity from product_variants where id = ${fixture.variantId}`;
    expect(row.stock_quantity).toBe(2);
    expect(await cycles()).toEqual([]);
  });

  it.each([-1, 1.5, Number.NaN])(
    "rejects invalid target %s from the locked read without writing",
    async (quantity) => {
      expect(await adjust(quantity)).toMatchObject({
        previousQuantity: 2,
        newQuantity: 2,
        sellabilityChanged: false,
        error: expect.any(String),
      });
      const [row] =
        await client`select stock_quantity from product_variants where id = ${fixture.variantId}`;
      expect(row.stock_quantity).toBe(2);
      const [{ count }] =
        await client`select count(*)::int as count from inventory_logs where variant_id = ${fixture.variantId}`;
      expect(count).toBe(0);
    }
  );

  it("omits missing ids, deduplicates ids, and quarantines only pending damaged or missing requests", async () => {
    expect(await inventory.getVariantSellability([])).toEqual([]);
    expect(await inventory.getVariantSellability([randomUUID()])).toEqual([]);
    for (const category of ["extra", "damaged", "missing"] as const) {
      const [request] = await client`
        insert into inventory_adjustment_requests (variant_id, requester_id, requester_name, product_name, sku, category, requested_quantity, explanation, stock_at_request)
        values (${fixture.variantId}, ${fixture.workerId}, 'Test Worker', ${fixture.productName}, ${fixture.sku}, ${category}, 1, 'Test count', 2) returning id
      `;
      const result = await inventory.getVariantSellability([
        fixture.variantId,
        fixture.variantId,
        randomUUID(),
      ]);
      expect(result).toEqual([
        {
          variantId: fixture.variantId,
          stockQuantity: 2,
          isAvailable: true,
          sellableStock: category === "extra" ? 2 : 0,
          availabilityState: category === "extra" ? "available" : "quarantined",
        },
      ]);
      await client`update inventory_adjustment_requests set status = 'rejected' where id = ${request.id}`;
      expect(
        (await inventory.getVariantSellability([fixture.variantId]))[0]
          .sellableStock
      ).toBe(2);
    }
  });

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
  it.each([0, -1])(
    "rejects nonpositive requested and approved quantities (%s)",
    async (quantity) => {
      await expect(
        client`
        insert into "inventory_adjustment_requests" (
          "variant_id", "requester_id", "requester_name", "product_name",
          "sku", "size", "color", "category", "requested_quantity",
          "explanation", "stock_at_request", "status"
        ) values (
          ${fixture.variantId}, ${fixture.workerId}, 'Inventory Test Worker',
          ${fixture.productName}, ${fixture.sku}, 'M', 'Black', 'missing', ${quantity},
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
          'One extra unit was found.', 2, 'approved', ${quantity},
          'Zero is not a valid approved quantity.', now()
        )
      `
      ).rejects.toMatchObject({ code: "23514" });
    }
  );
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
