import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { sql } from "drizzle-orm";
import { NET_REVENUE, COLLECTED_PAYMENT } from "./revenue";
import { container } from "@/application/container";

/**
 * Revenue: the SQL against the domain logic it encodes.
 *
 * The suite exists to assert that the SQL a repository emits agrees with the
 * domain object it replaced — `refundableOnly` against `canRefund()`,
 * `returnedOnly` against `getRefundedItems()`. Revenue is the same shape: the
 * `CASE` in `revenue.ts` is `OrderEntity.paidFraction()` transcribed by hand,
 * and the refund subtraction is `refundedAmount()` transcribed by hand. Two
 * hand-transcriptions are exactly what drifts.
 *
 * Read-only, like the rest of the suite, so it is safe to point at real data.
 */
describe("revenue SQL", () => {
  it("agrees with OrderEntity.refundedAmount() on every order", async () => {
    const rows = await db
      .select({
        id: orders.id,
        netRevenue: sql<string>`${NET_REVENUE}`,
        collected: sql<boolean>`${COLLECTED_PAYMENT}`,
      })
      .from(orders)
      .limit(200);

    if (rows.length === 0) {
      console.log("[revenue] no orders in this database — nothing to compare");
      return;
    }

    const repo = container.getOrderRepository();
    const mismatches: string[] = [];
    let collectedCount = 0;

    for (const row of rows) {
      const order = await repo.findById(row.id);
      if (!order) continue;

      const sqlNet = parseFloat(row.netRevenue);

      if (!row.collected) {
        // Nothing collected: the SQL must contribute exactly zero, whatever
        // the order total says.
        if (sqlNet !== 0) {
          mismatches.push(
            `${order.orderNumber ?? row.id}: uncollected but SQL says ${sqlNet}`
          );
        }
        continue;
      }

      collectedCount++;

      // Collected: SQL net must equal total minus what the entity computes as
      // refunded, to the cent.
      const entityNet = order.totalAmount - order.refundedAmount();
      if (Math.abs(sqlNet - entityNet) > 0.01) {
        mismatches.push(
          `${order.orderNumber ?? row.id}: SQL ${sqlNet} vs entity ${entityNet} ` +
            `(total ${order.totalAmount}, refunded ${order.refundedAmount()})`
        );
      }
    }

    console.log(
      `[revenue] compared ${rows.length} orders, ${collectedCount} collected, ` +
        `${mismatches.length} mismatches`
    );
    if (mismatches.length > 0) {
      console.log(mismatches.slice(0, 10).join("\n"));
    }

    expect(mismatches).toEqual([]);
  });

  it("never counts an order that took no money", async () => {
    const [row] = await db
      .select({
        leaked: sql<number>`
          COUNT(*) FILTER (WHERE NOT ${COLLECTED_PAYMENT} AND ${NET_REVENUE} <> 0)
        `,
        total: sql<number>`COUNT(*)`,
      })
      .from(orders);

    console.log(
      `[revenue] ${row.total} orders scanned, ${row.leaked} uncollected orders contributing revenue`
    );

    expect(Number(row.leaked)).toBe(0);
  });

  it("recognises a delivered cash-on-delivery order", async () => {
    const [row] = await db
      .select({
        codDelivered: sql<number>`
          COUNT(*) FILTER (
            WHERE ${orders.status} = 'delivered'
              AND EXISTS (
                SELECT 1 FROM payments p
                WHERE p.order_id = ${orders.id}
                  AND p.payment_method = 'cash_on_delivery'
              )
          )
        `,
        codDeliveredCounted: sql<number>`
          COUNT(*) FILTER (
            WHERE ${orders.status} = 'delivered'
              AND EXISTS (
                SELECT 1 FROM payments p
                WHERE p.order_id = ${orders.id}
                  AND p.payment_method = 'cash_on_delivery'
              )
              AND ${COLLECTED_PAYMENT}
          )
        `,
      })
      .from(orders);

    console.log(
      `[revenue] ${row.codDelivered} delivered COD orders, ${row.codDeliveredCounted} recognised`
    );

    // Every delivered COD order must count. Before this definition existed
    // they contributed nothing, because markAsPaid is Stripe-only and their
    // payment rows stay pending.
    expect(Number(row.codDeliveredCounted)).toBe(Number(row.codDelivered));
  });
});
