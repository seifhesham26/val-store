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

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { DrizzleOrderRepository } from "./order.repository";
import { client, db } from "@/db";
import {
  addresses,
  inventoryAdjustmentRequests,
  inventoryInspections,
  inventoryLogs,
  orderItems,
  orders,
  productVariants,
  products,
  user,
} from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import {
  OrderEntity,
  type OrderItem,
} from "@/domain/orders/entities/order.entity";

const repo = new DrizzleOrderRepository();

interface MutableOrderFixture {
  userId: string;
  addressId: string;
  productId: string;
  variantId: string;
  sku: string;
}

const mutableFixtures: MutableOrderFixture[] = [];

async function createMutableFixture(stockQuantity: number) {
  const suffix = randomUUID();
  const fixture: MutableOrderFixture = {
    userId: "order-race-" + suffix,
    addressId: randomUUID(),
    productId: randomUUID(),
    variantId: randomUUID(),
    sku: "ORDER-RACE-" + suffix,
  };
  mutableFixtures.push(fixture);

  await db.insert(user).values({
    id: fixture.userId,
    name: "Order Race Fixture",
    email: "order-race-" + suffix + "@example.com",
  });
  await db.insert(addresses).values({
    id: fixture.addressId,
    userId: fixture.userId,
    addressType: "shipping",
    fullName: "Order Race Fixture",
    addressLine1: "1 Test Street",
    city: "Cairo",
    state: "Cairo",
    postalCode: "11511",
    country: "Egypt",
    phone: "+201000000000",
  });
  await db.insert(products).values({
    id: fixture.productId,
    name: "Order Race Product",
    slug: "order-race-" + suffix,
    sku: "ORDER-PRODUCT-" + suffix,
    basePrice: "100.00",
  });
  await db.insert(productVariants).values({
    id: fixture.variantId,
    productId: fixture.productId,
    sku: fixture.sku,
    stockQuantity,
  });

  return fixture;
}

function orderFor(
  fixture: MutableOrderFixture,
  quantity: number,
  paymentMethod: "stripe" | "cash_on_delivery" = "cash_on_delivery"
): OrderEntity {
  const now = new Date();
  const items: OrderItem[] = [
    {
      id: "",
      productId: fixture.productId,
      variantId: fixture.variantId,
      productName: "Order Race Product",
      variantDetails: "Test",
      quantity,
      price: 100,
      refundedQuantity: 0,
    },
  ];
  return new OrderEntity(
    randomUUID(),
    fixture.userId,
    "pending",
    items,
    quantity * 100,
    0,
    0,
    quantity * 100,
    fixture.addressId,
    fixture.addressId,
    paymentMethod,
    "pending",
    null,
    null,
    null,
    now,
    now
  );
}

async function stockOf(variantId: string): Promise<number> {
  const [row] = await db
    .select({ stock: productVariants.stockQuantity })
    .from(productVariants)
    .where(eq(productVariants.id, variantId));
  return row?.stock ?? -1;
}

afterEach(async () => {
  for (const fixture of mutableFixtures.splice(0).reverse()) {
    await db
      .delete(inventoryAdjustmentRequests)
      .where(eq(inventoryAdjustmentRequests.variantId, fixture.variantId));
    await db
      .delete(inventoryInspections)
      .where(eq(inventoryInspections.variantId, fixture.variantId));
    await db.delete(orders).where(eq(orders.userId, fixture.userId));
    await db.delete(products).where(eq(products.id, fixture.productId));
    await db.delete(user).where(eq(user.id, fixture.userId));
  }
});

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

describe("transactional stock integrity", () => {
  it("honours the protected inspection floor during checkout", async () => {
    const fixture = await createMutableFixture(11);
    await db.insert(inventoryInspections).values({
      variantId: fixture.variantId,
      productName: "Order Race Product",
      sku: fixture.sku,
      triggerStock: 11,
    });

    await expect(repo.create(orderFor(fixture, 1))).resolves.toBeDefined();
    expect(await stockOf(fixture.variantId)).toBe(10);

    await expect(repo.create(orderFor(fixture, 2))).rejects.toThrow(
      /Not enough stock/
    );
    expect(await stockOf(fixture.variantId)).toBe(10);
  });

  it("serializes concurrent orders at the protected floor", async () => {
    const fixture = await createMutableFixture(19);
    await db.insert(inventoryInspections).values({
      variantId: fixture.variantId,
      productName: "Order Race Product",
      sku: fixture.sku,
      triggerStock: 19,
    });

    const firstWave = await Promise.all(
      Array.from({ length: 3 }, () => repo.create(orderFor(fixture, 3)))
    );
    expect(firstWave).toHaveLength(3);
    expect(await stockOf(fixture.variantId)).toBe(10);

    await expect(repo.create(orderFor(fixture, 1))).rejects.toThrow(
      /Not enough stock/
    );
    expect(await stockOf(fixture.variantId)).toBe(10);
  });

  it("blocks shipping while an order variant is quarantined", async () => {
    const fixture = await createMutableFixture(5);
    const created = await repo.create(orderFor(fixture, 1, "stripe"));
    await repo.markAsPaid(created.id);
    const [request] = await db
      .insert(inventoryAdjustmentRequests)
      .values({
        variantId: fixture.variantId,
        requesterId: fixture.userId,
        productName: "Order Race Product",
        sku: fixture.sku,
        category: "damaged",
        requestedQuantity: 1,
        explanation: "Fixture quarantine",
        stockAtRequest: 4,
        requesterName: "Order Race Fixture",
      })
      .returning();

    await expect(
      repo.updateStatus(created.id, "shipped")
    ).rejects.toMatchObject({
      name: "InventoryQuarantineError",
      message: expect.stringContaining(fixture.sku),
    });

    await db
      .update(inventoryAdjustmentRequests)
      .set({ status: "rejected", decisionExplanation: "Checked" })
      .where(eq(inventoryAdjustmentRequests.id, request.id));
    await expect(
      repo.updateStatus(created.id, "shipped")
    ).resolves.toMatchObject({
      status: "shipped",
    });
  });

  it("credits stock only once across concurrent cancellations", async () => {
    const fixture = await createMutableFixture(5);
    const created = await repo.create(orderFor(fixture, 1));

    const results = await Promise.allSettled([
      repo.updateStatus(created.id, "cancelled"),
      repo.updateStatus(created.id, "cancelled"),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(await stockOf(fixture.variantId)).toBe(5);
    const credited = await db
      .select({ id: inventoryLogs.id })
      .from(inventoryLogs)
      .where(
        and(
          eq(inventoryLogs.variantId, fixture.variantId),
          eq(inventoryLogs.changeType, "adjustment"),
          gt(inventoryLogs.quantityChange, 0)
        )
      );
    expect(credited).toHaveLength(1);
  });

  it("credits a concurrently returned unit only once", async () => {
    const fixture = await createMutableFixture(5);
    const created = await repo.create(orderFor(fixture, 1, "stripe"));
    await repo.markAsPaid(created.id);
    const item = (await repo.findById(created.id))!.items[0];
    const request = {
      lines: [{ orderItemId: item.id, returned: 1, restocked: 1 }],
    };

    const results = await Promise.allSettled([
      repo.refund(created.id, request),
      repo.refund(created.id, request),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(await stockOf(fixture.variantId)).toBe(5);
    const [line] = await db
      .select({ refunded: orderItems.refundedQuantity })
      .from(orderItems)
      .where(eq(orderItems.id, item.id));
    expect(line.refunded).toBe(1);
  });

  it("cannot credit the same unit through cancellation and return", async () => {
    const fixture = await createMutableFixture(5);
    const created = await repo.create(orderFor(fixture, 1, "stripe"));
    await repo.markAsPaid(created.id);
    await repo.updateStatus(created.id, "shipped");
    const item = (await repo.findById(created.id))!.items[0];

    const results = await Promise.allSettled([
      repo.updateStatus(created.id, "cancelled"),
      repo.refund(created.id, {
        lines: [{ orderItemId: item.id, returned: 1, restocked: 1 }],
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(await stockOf(fixture.variantId)).toBe(5);
  });
});
