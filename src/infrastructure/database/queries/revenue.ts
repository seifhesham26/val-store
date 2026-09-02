/**
 * What counts as revenue.
 *
 * One definition, in one place, because there used to be three and they
 * disagreed. The dashboard summed `total_amount` over a date window with no
 * status filter at all — so an abandoned card order counted, a cancelled order
 * counted, and a fully refunded order counted at its original value.
 * `getTotalRevenue()` in the order repository gave a different answer again,
 * and the admin customer screens gave a third.
 *
 * Two clauses, because the store has two payment methods that record money in
 * different places.
 */

import { sql, type SQL } from "drizzle-orm";
import { orders, orderItems, payments } from "@/db/schema";

/**
 * Did this order actually take money?
 *
 * **Card** — the payment row reads `completed`. `markAsPaid` is the only thing
 * in the codebase that writes that value, and it is written inside the same
 * transaction that advances the order, so it is the authoritative signal. It
 * is deliberately not a status list: `OrderStatus` permits
 * `cancelled -> refunded` when payment was captured, which means a cancelled
 * order can still hold real money, and no status can see a partial refund.
 *
 * **Cash on delivery** — the money arrives when the courier hands the goods
 * over, so it is recognised at `delivered`. It cannot key off `paid`, because
 * the transition table runs `pending -> processing -> paid -> shipped ->
 * delivered`: `paid` comes *before* `shipped`, which is backwards for COD and
 * would recognise cash a whole shipping window before it exists.
 *
 * `updateStatus` now completes a COD order's payment row on delivery, so new
 * COD orders satisfy the first clause on their own. The second clause is what
 * covers every COD order placed before that fix, which cannot be backfilled
 * without a database write.
 *
 * EXISTS rather than a join: the entity mapper explicitly allows an order to
 * carry more than one payment row, and a join would fan out and double-count
 * every such order in a per-day SUM.
 */
export const COLLECTED_PAYMENT: SQL = sql`(
  EXISTS (
    SELECT 1 FROM ${payments} p
    WHERE p.order_id = ${orders.id} AND p.payment_status = 'completed'
  )
  OR (
    EXISTS (
      SELECT 1 FROM ${payments} p2
      WHERE p2.order_id = ${orders.id} AND p2.payment_method = 'cash_on_delivery'
    )
    AND ${orders.status} = 'delivered'
  )
)`;

/**
 * The fraction of list price the customer actually paid.
 *
 * `OrderEntity.paidFraction()` transcribed to SQL, so a refund on a coupon
 * order returns what was charged rather than what was listed. Kept identical
 * to the entity on purpose — the integration test compares the two.
 */
const PAID_FRACTION: SQL = sql`(
  CASE
    WHEN ${orders.discountAmount} <= 0 OR ${orders.subtotal} <= 0 THEN 1
    ELSE GREATEST(0, (${orders.subtotal} - ${orders.discountAmount}) / ${orders.subtotal})
  END
)`;

/**
 * Money handed back, per order, scaled for coupons.
 *
 * `order_items.refunded_quantity` is the only stored fact the whole return
 * system derives from, and no dashboard query used to reach it — so the
 * figures included money that had been taken and given back.
 */
const REFUNDED_AMOUNT: SQL = sql`(
  COALESCE((
    SELECT SUM(oi.unit_price * oi.refunded_quantity)
    FROM ${orderItems} oi
    WHERE oi.order_id = ${orders.id}
  ), 0) * ${PAID_FRACTION}
)`;

/**
 * Recognised revenue for a single order row: collected, net of returns.
 *
 * Zero for anything that never took money, so it is safe to SUM across a
 * window without also filtering — though filtering with `COLLECTED_PAYMENT`
 * as well is cheaper when only paid orders are wanted.
 */
export const NET_REVENUE: SQL = sql`(
  CASE
    WHEN ${COLLECTED_PAYMENT}
      THEN ROUND((${orders.totalAmount} - ${REFUNDED_AMOUNT})::numeric, 2)
    ELSE 0
  END
)`;

/** `SUM(NET_REVENUE)`, coalesced — the form every consumer actually wants. */
export const SUM_NET_REVENUE: SQL = sql`COALESCE(SUM(${NET_REVENUE}), 0)`;
