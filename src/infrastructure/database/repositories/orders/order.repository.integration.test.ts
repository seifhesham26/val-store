/**
 * Order repository — derived-filter integration tests.
 *
 * `refundableOnly` and `returnedOnly` are the riskiest part of the performance
 * work: they are SQL translations of `OrderEntity.canRefund()` and
 * `getRefundedItems() > 0`, which are domain methods reading a joined payment
 * row and per-line refund quantities. A translation that is subtly wrong shows
 * an admin the wrong orders, and no unit test can catch it because the whole
 * point is what the database does.
 *
 * So these tests do the only thing that settles it: run the SQL, run the domain
 * method over every order, and require the two to name the same set.
 *
 * Read-only. Nothing here writes.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DrizzleOrderRepository } from "./order.repository";
import { client } from "@/db";
import type { OrderEntity } from "@/domain/orders/entities/order.entity";

const repo = new DrizzleOrderRepository();

let allOrders: OrderEntity[] = [];

beforeAll(async () => {
  allOrders = await repo.findAll();
  const refundable = allOrders.filter((o) => o.canRefund());
  const returned = allOrders.filter((o) => o.getRefundedItems() > 0);
  console.log(
    `[orders] baseline: ${allOrders.length} orders, ` +
      `${refundable.length} refundable, ${returned.length} with returns`
  );
  console.log(
    `[orders] statuses: ${JSON.stringify(
      allOrders.reduce<Record<string, number>>((acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
      }, {})
    )}`
  );
});

afterAll(async () => {
  await client.end({ timeout: 5 });
});

describe("refundableOnly is a faithful translation of canRefund()", () => {
  it("names exactly the orders the entity calls refundable", async () => {
    const fromSql = await repo.findAll({ refundableOnly: true });
    const fromDomain = allOrders.filter((o) => o.canRefund());

    const sqlIds = fromSql.map((o) => o.id).sort();
    const domainIds = fromDomain.map((o) => o.id).sort();

    if (sqlIds.length !== domainIds.length) {
      // Print the disagreement so a failure is diagnosable from the log alone.
      const onlySql = sqlIds.filter((id) => !domainIds.includes(id));
      const onlyDomain = domainIds.filter((id) => !sqlIds.includes(id));
      console.log(
        `[orders] MISMATCH refundableOnly — only in SQL: ${JSON.stringify(onlySql)}, only in domain: ${JSON.stringify(onlyDomain)}`
      );
    }

    expect(sqlIds).toEqual(domainIds);
  });

  it("every row it returns really can be refunded", async () => {
    const rows = await repo.findAll({ refundableOnly: true });
    for (const order of rows) {
      expect(order.canRefund()).toBe(true);
      expect(order.status).not.toBe("refunded");
      expect(order.hasCapturedPayment()).toBe(true);
    }
  });

  it("counts what it returns", async () => {
    const [rows, total] = await Promise.all([
      repo.findAll({ refundableOnly: true }),
      repo.count({ refundableOnly: true }),
    ]);
    expect(total).toBe(rows.length);
  });
});

describe("returnedOnly is a faithful translation of getRefundedItems()", () => {
  it("names exactly the orders with at least one unit sent back", async () => {
    const fromSql = await repo.findAll({ returnedOnly: true });
    const fromDomain = allOrders.filter((o) => o.getRefundedItems() > 0);

    expect(fromSql.map((o) => o.id).sort()).toEqual(
      fromDomain.map((o) => o.id).sort()
    );
  });

  it("every row it returns has a refunded line", async () => {
    const rows = await repo.findAll({ returnedOnly: true });
    for (const order of rows) {
      expect(order.getRefundedItems()).toBeGreaterThan(0);
      expect(order.items.some((i) => i.refundedQuantity > 0)).toBe(true);
    }
  });

  it("counts what it returns", async () => {
    const [rows, total] = await Promise.all([
      repo.findAll({ returnedOnly: true }),
      repo.count({ returnedOnly: true }),
    ]);
    expect(total).toBe(rows.length);
  });
});

describe("derived filters compose with the ordinary ones", () => {
  it("combines with a status filter", async () => {
    const rows = await repo.findAll({
      status: "delivered",
      refundableOnly: true,
    });
    for (const order of rows) {
      expect(order.status).toBe("delivered");
      expect(order.canRefund()).toBe(true);
    }
  });

  it("combines with pagination without losing or duplicating rows", async () => {
    const total = await repo.count({ refundableOnly: true });
    if (total < 2) {
      console.log("[orders] too few refundable orders to page — skipped");
      return;
    }

    const limit = 1;
    const seen: string[] = [];
    for (let offset = 0; offset < total; offset += limit) {
      const page = await repo.findAll({ refundableOnly: true, limit, offset });
      seen.push(...page.map((o) => o.id));
    }

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(total);
  });
});

describe("user-scoped pagination, which is what 'My orders' now does", () => {
  it("pages a customer's own orders without gaps", async () => {
    const withUser = allOrders.find((o) => o.userId && o.userId !== "guest");
    if (!withUser) {
      console.log("[orders] no user-owned orders found — skipped");
      return;
    }
    const userId = withUser.userId;

    const total = await repo.count({ userId });
    const limit = 2;
    const seen: string[] = [];
    for (let offset = 0; offset < total; offset += limit) {
      const page = await repo.findAll({ userId, limit, offset });
      seen.push(...page.map((o) => o.id));
    }

    console.log(`[orders] user ${userId.slice(0, 8)}… has ${total} orders`);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(total);
  });

  it("returns only that customer's orders", async () => {
    const withUser = allOrders.find((o) => o.userId && o.userId !== "guest");
    if (!withUser) return;

    const rows = await repo.findAll({ userId: withUser.userId, limit: 50 });
    for (const order of rows) {
      expect(order.userId).toBe(withUser.userId);
    }
  });
});
