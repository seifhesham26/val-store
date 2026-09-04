import { db } from "@/db";
import {
  addresses,
  orders,
  orderItems,
  payments,
  coupons,
  couponUsages,
  productVariants,
  inventoryLogs,
  user,
} from "@/db/schema";
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm";
import {
  OrderRepositoryInterface,
  OrderFilters,
  UpdateOrderStatusOptions,
} from "@/domain/orders/interfaces/repositories/order.repository.interface";
import {
  OrderEntity,
  type OrderAddress,
  type OrderCustomer,
  type OrderPaymentStatus,
  type RefundLine,
} from "@/domain/orders/entities/order.entity";
import {
  OrderStatus,
  OrderStatusValue,
} from "@/domain/orders/value-objects/order-status.value-object";
import { OrderNotFoundException } from "@/domain/orders/exceptions/order-not-found.exception";
import { InvalidOrderStatusException } from "@/domain/orders/exceptions/invalid-order-status.exception";
import { STORE_CURRENCY } from "@/lib/currency";
import {
  generateOrderNumber,
  isOrderNumberCollision,
} from "@/domain/orders/order-number";

/**
 * How many order numbers to try before giving up.
 *
 * Four retries at 32^8 possibilities per day is not a probability worth
 * computing — if it is ever reached, the cause is not bad luck.
 */
const ORDER_NUMBER_ATTEMPTS = 5;

/** Append a timestamped line to the order's admin notes, preserving history. */
function appendAdminNote(existing: string | null, note: string): string {
  const stamped = `[${new Date().toISOString()}] ${note}`;
  return existing
    ? `${existing}
${stamped}`
    : stamped;
}

/** Shape of a joined `addresses` row, as returned by the relational query. */
type DbAddress = {
  fullName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
};

/**
 * Narrow a joined address row to the presentational DTO.
 *
 * Drops ids and timestamps: the entity crosses the tRPC boundary, where Dates
 * would silently arrive as strings.
 */
function toOrderAddress(
  row: DbAddress | null | undefined
): OrderAddress | null {
  if (!row) return null;
  return {
    fullName: row.fullName,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    country: row.country,
    phone: row.phone,
  };
}

/**
 * The address as the order recorded it, falling back to the live row.
 *
 * The snapshot is authoritative: it is what the customer actually entered at
 * checkout, and it survives the address being edited, deleted by the customer,
 * or cascaded away with their account. The join is the fallback for orders
 * written before `orders.shipping_address_snapshot` existed.
 *
 * Validated rather than cast. The column is `jsonb`, so nothing in the type
 * system guarantees its shape — a hand-written row or a future schema change
 * would otherwise surface as `undefined` fields rendered into an address
 * label.
 */
function resolveOrderAddress(
  snapshot: unknown,
  joined: DbAddress | null | undefined
): OrderAddress | null {
  const fromSnapshot = parseAddressSnapshot(snapshot);
  return fromSnapshot ?? toOrderAddress(joined);
}

/** Every field an `OrderAddress` needs, as strings, or null. */
function parseAddressSnapshot(value: unknown): OrderAddress | null {
  if (!value || typeof value !== "object") return null;

  const row = value as Record<string, unknown>;
  const str = (key: string) =>
    typeof row[key] === "string" ? (row[key] as string) : null;

  const fullName = str("fullName");
  const addressLine1 = str("addressLine1");
  const city = str("city");

  // Enough to be an address at all. A partial snapshot is treated as no
  // snapshot, so the join still gets its chance.
  if (!fullName || !addressLine1 || !city) return null;

  return {
    fullName,
    addressLine1,
    addressLine2: str("addressLine2"),
    city,
    state: str("state") ?? "",
    postalCode: str("postalCode") ?? "",
    country: str("country") ?? "",
    phone: str("phone") ?? "",
  };
}

/**
 * Resolve the customers behind a set of orders in one query.
 *
 * There is no `orders → user` relation to lean on, so the join is manual —
 * batched rather than per-row to keep the admin list at two queries.
 */
async function loadCustomers(
  userIds: (string | null)[]
): Promise<Map<string, OrderCustomer>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();

  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(inArray(user.id, ids));

  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Order Repository Implementation using Drizzle ORM
 * Aligned with actual database schema
 */
export class DrizzleOrderRepository implements OrderRepositoryInterface {
  /**
   * Find order by ID
   */
  async findById(orderId: string): Promise<OrderEntity | null> {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        // Images are joined only here, not in the list queries: the detail view
        // is the only place that renders them.
        items: { with: { product: { with: { images: true } } } },
        shippingAddress: true,
        billingAddress: true,
        payments: true,
      },
    });

    if (!order) {
      return null;
    }

    const customers = await loadCustomers([order.userId]);

    return this.mapToEntity(
      order,
      order.userId ? (customers.get(order.userId) ?? null) : null
    );
  }

  /**
   * Find orders by user ID
   */
  async findByUserId(userId: string): Promise<OrderEntity[]> {
    return this.findAll({ userId });
  }

  /**
   * Find all orders with optional filtering
   */
  async findAll(filters?: OrderFilters): Promise<OrderEntity[]> {
    const conditions = this.buildFiltersConditions(filters);

    const ordersList = await db.query.orders.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        items: true,
        shippingAddress: true,
        billingAddress: true,
        payments: true,
      },
      orderBy: [desc(orders.createdAt), desc(orders.id)],
      limit: filters?.limit,
      offset: filters?.offset,
    });

    const customers = await loadCustomers(ordersList.map((o) => o.userId));

    return ordersList.map((o) =>
      this.mapToEntity(o, o.userId ? (customers.get(o.userId) ?? null) : null)
    );
  }

  /**
   * Find orders by status
   */
  async findByStatus(status: string): Promise<OrderEntity[]> {
    return this.findAll({ status });
  }

  /**
   * Create a new order
   */
  async create(order: OrderEntity): Promise<OrderEntity> {
    const now = new Date();

    // Copy the addresses onto the order before anything is written. Read
    // outside the transaction on purpose: they are the customer's own rows,
    // already ownership-checked by `CreateOrderUseCase`, and nothing in this
    // transaction writes them.
    const [shippingSnapshot, billingSnapshot] = await Promise.all([
      this.loadAddressSnapshot(order.shippingAddressId),
      this.loadAddressSnapshot(order.billingAddressId),
    ]);

    // Assigned per attempt — see the retry below.
    let orderNumber = generateOrderNumber(now);

    const commit = () =>
      db.transaction(async (tx) => {
        await tx.insert(orders).values({
          id: order.id,
          orderNumber,
          userId: order.userId,
          status: order.status,
          subtotal: order.subtotal.toFixed(2),
          taxAmount: order.tax.toFixed(2),
          shippingAmount: order.shippingCost.toFixed(2),
          discountAmount: order.discount.toFixed(2),
          totalAmount: order.totalAmount.toFixed(2),
          currency: STORE_CURRENCY,
          couponId: order.couponId,
          shippingAddressId: order.shippingAddressId,
          billingAddressId: order.billingAddressId,
          shippingAddressSnapshot: shippingSnapshot,
          billingAddressSnapshot: billingSnapshot,
          createdAt: now,
          updatedAt: now,
        });

        if (order.items.length > 0) {
          await tx.insert(orderItems).values(
            order.items.map((item) => ({
              orderId: order.id,
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              variantDetails: item.variantDetails,
              quantity: item.quantity,
              unitPrice: item.price.toFixed(2),
              totalPrice: (item.price * item.quantity).toFixed(2),
              createdAt: now,
            }))
          );
        }

        await tx.insert(payments).values({
          orderId: order.id,
          paymentMethod:
            order.paymentMethod === "cash_on_delivery"
              ? "cash_on_delivery"
              : "stripe",
          paymentStatus: "pending",
          amount: order.totalAmount.toFixed(2),
          currency: STORE_CURRENCY,
          transactionId: null,
          paymentGatewayResponse: null,
          createdAt: now,
          updatedAt: now,
        });

        // Reserve stock in the same transaction as the order.
        //
        // Locking each variant row (FOR UPDATE) serialises concurrent checkouts
        // for the same variant, so two customers cannot both pass the stock check
        // and oversell the last unit.
        //
        // Items are locked in a fixed (variant id) order. Two carts containing the
        // same two variants would otherwise be able to grab them in opposite
        // orders and deadlock each other.
        const stockedItems = order.items
          .filter((item) => item.variantId !== null)
          .sort((a, b) => a.variantId!.localeCompare(b.variantId!));

        for (const item of stockedItems) {
          if (!item.variantId) continue; // Narrowing for TypeScript; filtered above

          const [variant] = await tx
            .select({
              id: productVariants.id,
              stockQuantity: productVariants.stockQuantity,
            })
            .from(productVariants)
            .where(eq(productVariants.id, item.variantId))
            .for("update")
            .limit(1);

          if (!variant) {
            throw new Error(
              `${item.productName} is no longer available and was removed from sale.`
            );
          }

          if (variant.stockQuantity < item.quantity) {
            throw new Error(
              `Not enough stock for ${item.productName}${
                item.variantDetails ? ` (${item.variantDetails})` : ""
              }. Only ${variant.stockQuantity} left.`
            );
          }

          const newQuantity = variant.stockQuantity - item.quantity;

          await tx
            .update(productVariants)
            .set({ stockQuantity: newQuantity, updatedAt: now })
            .where(eq(productVariants.id, item.variantId));

          await tx.insert(inventoryLogs).values({
            variantId: item.variantId,
            changeType: "sale",
            quantityChange: -item.quantity,
            previousQuantity: variant.stockQuantity,
            newQuantity,
            reason: `Order ${orderNumber}`,
            createdBy: order.userId,
            createdAt: now,
          });
        }

        // Redeem the coupon only when the order is already a real commitment.
        //
        // Cash on delivery is: the customer has ordered, and the courier collects
        // later. A card order is not — it is a session the customer may never
        // pay for, and counting that as a redemption burned a one-per-customer
        // code on an attempt that never charged anyone. Card orders redeem in
        // `markAsPaid` instead.
        if (order.couponId && order.paymentMethod === "cash_on_delivery") {
          // Guarded increment, not a plain one. `ValidateCouponUseCase` checks
          // usageLimit/perUserLimit with an unlocked SELECT in a separate,
          // earlier transaction — nothing stops several concurrent checkouts
          // from all passing that check and all reaching here. The row lock
          // this UPDATE takes implicitly is what arbitrates them: both limits
          // are re-checked against the row as it stands right now, not the
          // stale read from validation, so only as many racing checkouts as
          // the limit actually allows can win it. Same guarded-update shape
          // `refund()` above uses for `order_items.refunded_quantity`.
          //
          // Taken after the stock loop above, not before — every transaction
          // that locks both a variant row and this coupon row must do so in
          // the same order, or two transactions each holding one lock while
          // waiting on the other's deadlock.
          const [redeemed] = await tx
            .update(coupons)
            .set({
              usageCount: sql`${coupons.usageCount} + 1`,
              updatedAt: now,
            })
            .where(
              and(
                eq(coupons.id, order.couponId),
                sql`(${coupons.usageLimit} IS NULL OR ${coupons.usageCount} < ${coupons.usageLimit})`,
                sql`(
                  ${coupons.perUserLimit} IS NULL OR (
                    SELECT COUNT(*)::int FROM coupon_usages
                    WHERE coupon_id = ${order.couponId} AND user_id = ${order.userId}
                  ) < ${coupons.perUserLimit}
                )`
              )
            )
            .returning({ id: coupons.id });

          // No charge has happened yet for cash on delivery, so losing this
          // race is the same shape as the stock checks above: abort the whole
          // order and let the customer see why. Nothing has committed that a
          // retry (without the code) can't recover from.
          if (!redeemed) {
            throw new Error(
              "This coupon has just reached its usage limit and can no longer be applied."
            );
          }

          await tx.insert(couponUsages).values({
            couponId: order.couponId,
            userId: order.userId,
            orderId: order.id,
          });
        }
      });

    // The order number carries a unique constraint, and the insert that uses
    // it shares a transaction with the items, the payment row, the stock
    // decrement and the coupon redemption. So a duplicate number did not fail
    // the *name* — it failed the whole checkout, and the customer saw a generic
    // error on an order that would have succeeded if simply tried again.
    //
    // Retried with a fresh number instead. Only a name clash is retried; stock
    // and coupon failures are answers the customer needs to see, not conditions
    // to attempt four more times. The transaction rolls back completely on
    // abort, so each attempt starts from clean state and nothing is written
    // twice.
    //
    // Bounded rather than unbounded: at 32^8 per day, needing four fresh
    // numbers in a row means something is wrong that retrying will not fix, and
    // an infinite loop against the database would be a far worse failure than
    // the one being handled.
    for (let attempt = 1; ; attempt++) {
      try {
        await commit();
        break;
      } catch (error) {
        if (
          attempt >= ORDER_NUMBER_ATTEMPTS ||
          !isOrderNumberCollision(error)
        ) {
          throw error;
        }
        orderNumber = generateOrderNumber(now);
      }
    }

    const created = await this.findById(order.id);
    if (!created) {
      throw new Error("Failed to create order");
    }

    return created;
  }

  /**
   * Update order status
   */
  async updateStatus(
    orderId: string,
    status: string,
    options?: UpdateOrderStatusOptions
  ): Promise<OrderEntity> {
    // Find existing order
    const existing = await this.findById(orderId);
    if (!existing) {
      throw new OrderNotFoundException(orderId);
    }

    // Validate status transition using value object
    const currentStatus = OrderStatus.create(existing.status);
    const newStatus = OrderStatus.create(status);

    if (
      !currentStatus.canTransitionTo(newStatus.getValue(), {
        paymentCaptured: existing.hasCapturedPayment(),
      })
    ) {
      throw new InvalidOrderStatusException(
        currentStatus.getValue(),
        newStatus.getValue()
      );
    }

    // Update timestamps based on status
    const updates: {
      status: OrderStatusValue;
      updatedAt: Date;
      shippedAt?: Date;
      deliveredAt?: Date;
      adminNotes?: string;
    } = {
      status: newStatus.getValue(),
      updatedAt: new Date(),
    };

    if (newStatus.getValue() === "shipped" && !existing.shippedAt) {
      updates.shippedAt = new Date();
    }

    if (newStatus.getValue() === "delivered" && !existing.deliveredAt) {
      updates.deliveredAt = new Date();
    }

    const target = newStatus.getValue();

    // Refunds move money and stock per line, so they go through `refund()`
    // where the returned quantities are recorded. Flipping the status here
    // would mark the whole order refunded without any record of what actually
    // came back.
    if (target === "refunded") {
      throw new Error(
        "Use the refund operation to record a return, not a status change"
      );
    }

    // An unpaid card order inside its payment window is genuinely in flight —
    // the customer may be on Stripe's page entering a card right now. Pulling
    // it out from under them would take the stock back mid-payment and leave
    // Stripe to charge for an order that no longer exists.
    if (
      target === "cancelled" &&
      !options?.force &&
      existing.isAwaitingPayment()
    ) {
      const deadline = existing.paymentDeadline();
      throw new Error(
        `This order is still within its payment window and cannot be cancelled yet. ` +
          `It will be cancelled automatically at ${deadline?.toISOString()} if it is not paid.`
      );
    }
    // `cancelled` is a final state, so an order can only reach it once — no
    // risk of restoring the same stock twice.
    const isClosing = target === "cancelled";

    // Reject a restock that asks for more than was ordered, or names a line
    // belonging to some other order, before anything is written. The clamp
    // below still stands as a second line of defence.
    if (options?.restock) {
      existing.validateRestock(options.restock);
    }

    // Default to returning everything; an explicit list (even an empty one)
    // means the caller decided line by line — a damaged return should not go
    // back on sale.
    const restockByItem = options?.restock
      ? new Map(
          options.restock.map((line) => [line.orderItemId, line.quantity])
        )
      : null;

    await db.transaction(async (tx) => {
      if (options?.reason) {
        updates.adminNotes = appendAdminNote(
          existing.adminNotes,
          `Cancelled: ${options.reason}`
        );
      }

      await tx.update(orders).set(updates).where(eq(orders.id, orderId));

      // Cash on delivery collects at the door, and nothing recorded it.
      //
      // `markAsPaid` is the only other writer of `payment_status = 'completed'`
      // and all of its callers are Stripe paths, so a COD order's payment row
      // stayed `pending` forever no matter what an admin did to it — which
      // made every revenue figure blind to the payment method this store most
      // likely depends on.
      //
      // Conditional on the row still being pending, so redelivering the same
      // transition cannot double-write, and scoped to COD so it can never
      // mark a card order paid that Stripe has not confirmed.
      if (target === "delivered") {
        await tx
          .update(payments)
          .set({ paymentStatus: "completed", updatedAt: new Date() })
          .where(
            and(
              eq(payments.orderId, orderId),
              eq(payments.paymentMethod, "cash_on_delivery"),
              eq(payments.paymentStatus, "pending")
            )
          );
      }

      if (!isClosing) return;

      const now = new Date();

      // Lock variant rows in a consistent order across every path that touches
      // them (creation, cancellation, returns). Two transactions taking the
      // same two rows in opposite orders can deadlock each other.
      const restockable = existing.items
        .filter((item) => item.variantId !== null)
        .sort((a, b) => a.variantId!.localeCompare(b.variantId!));

      for (const item of restockable) {
        if (!item.variantId) continue;

        // A partial return already restocked whatever came back before this
        // order was cancelled — `existing.refundableQuantity()` is exactly
        // `item.quantity - item.refundedQuantity`, floored at zero. Falling
        // back to the full ordered quantity here (or capping an explicit
        // restock request against it instead of what's actually left) would
        // put those units back on the shelf a second time.
        const restockQuantity = this.resolveRestockQuantity(
          existing.refundableQuantity(item.id),
          restockByItem ? (restockByItem.get(item.id) ?? 0) : undefined
        );

        if (restockQuantity <= 0) continue;

        const [variant] = await tx
          .select({ stockQuantity: productVariants.stockQuantity })
          .from(productVariants)
          .where(eq(productVariants.id, item.variantId))
          .for("update")
          .limit(1);

        // The variant may have been deleted since the order was placed.
        if (!variant) continue;

        const newQuantity = variant.stockQuantity + restockQuantity;

        await tx
          .update(productVariants)
          .set({ stockQuantity: newQuantity, updatedAt: now })
          .where(eq(productVariants.id, item.variantId));

        await tx.insert(inventoryLogs).values({
          variantId: item.variantId,
          changeType: "adjustment",
          quantityChange: restockQuantity,
          previousQuantity: variant.stockQuantity,
          newQuantity,
          reason: options?.reason
            ? `Order cancelled: ${options.reason}`
            : "Order cancelled — restocked",
          createdAt: now,
        });
      }

      // Cancelling releases the coupon. The sale never happened, so it must not
      // keep counting against the customer's per-user allowance or the code's
      // total — otherwise a checkout that failed before payment silently burns
      // a one-per-customer coupon.
      //
      // Refunds deliberately do not release it: there the purchase did happen,
      // and handing the coupon back would let it be recycled through repeated
      // returns.
      if (target === "cancelled") {
        const [released] = await tx
          .delete(couponUsages)
          .where(eq(couponUsages.orderId, orderId))
          .returning({ couponId: couponUsages.couponId });

        if (released) {
          await tx
            .update(coupons)
            .set({
              // Floored, so a hand-edited counter can never go negative.
              usageCount: sql`GREATEST(${coupons.usageCount} - 1, 0)`,
              updatedAt: now,
            })
            .where(eq(coupons.id, released.couponId));
        }
      }
    });

    // Fetch with items
    const orderWithItems = await this.findById(orderId);
    if (!orderWithItems) {
      throw new OrderNotFoundException(orderId);
    }

    return orderWithItems;
  }

  /**
   * Record a return: refund money for the units sent back, and put the
   * resellable ones back on sale.
   *
   * Separate from `updateStatus` because a return is not a status change. A
   * customer may send back one of three shirts; the order is not "refunded", it
   * is partly refunded, and the remaining two must still be returnable later.
   * The order only reaches `refunded` once every unit has come back.
   */
  async refund(
    orderId: string,
    input: { lines: RefundLine[]; reason?: string }
  ): Promise<OrderEntity> {
    const existing = await this.findById(orderId);
    if (!existing) {
      throw new OrderNotFoundException(orderId);
    }

    if (!existing.canRefund()) {
      throw new Error("This order has no captured payment left to refund");
    }

    existing.validateRefund(input.lines);

    const amount = existing.refundValue(input.lines);
    const returnedUnits = input.lines.reduce(
      (sum, line) => sum + line.returned,
      0
    );

    // Does this return complete the order?
    const fullyRefunded = existing.items.every((item) => {
      const line = input.lines.find((l) => l.orderItemId === item.id);
      return item.refundedQuantity + (line?.returned ?? 0) >= item.quantity;
    });

    if (fullyRefunded) {
      const currentStatus = OrderStatus.create(existing.status);
      if (
        !currentStatus.canTransitionTo("refunded", {
          paymentCaptured: existing.hasCapturedPayment(),
        })
      ) {
        throw new InvalidOrderStatusException(existing.status, "refunded");
      }
    }

    await db.transaction(async (tx) => {
      const now = new Date();

      // Same ordering discipline as everywhere else that locks variant rows:
      // two concurrent returns touching the same variants must take them in the
      // same order or they can deadlock each other.
      const ordered = [...input.lines]
        .filter((line) => line.returned > 0)
        .map((line) => ({
          line,
          item: existing.items.find((i) => i.id === line.orderItemId),
        }))
        .filter((entry) => entry.item !== undefined)
        // Same lock ordering as everywhere else that touches variant rows.
        // Lines with no variant sort last; they take no lock at all.
        .sort((a, b) =>
          (a.item!.variantId ?? "￿").localeCompare(b.item!.variantId ?? "￿")
        );

      for (const { line, item } of ordered) {
        if (!item) continue;

        // Guarded increment rather than a plain one. The validation above ran
        // outside this transaction, so two returns submitted at the same moment
        // could both have passed it; this makes the database the arbiter and
        // rolls the whole thing back if the units are no longer there.
        const [bumped] = await tx
          .update(orderItems)
          .set({
            refundedQuantity: sql`${orderItems.refundedQuantity} + ${line.returned}`,
          })
          .where(
            and(
              eq(orderItems.id, line.orderItemId),
              lte(
                sql`${orderItems.refundedQuantity} + ${line.returned}`,
                orderItems.quantity
              )
            )
          )
          .returning({ id: orderItems.id });

        if (!bumped) {
          throw new Error(
            `${item.productName} has already been returned by someone else — reload the order and try again`
          );
        }

        if (line.restocked <= 0 || !item.variantId) continue;

        const [variant] = await tx
          .select({ stockQuantity: productVariants.stockQuantity })
          .from(productVariants)
          .where(eq(productVariants.id, item.variantId))
          .for("update")
          .limit(1);

        // The variant may have been deleted since the order was placed.
        if (!variant) continue;

        const newQuantity = variant.stockQuantity + line.restocked;

        await tx
          .update(productVariants)
          .set({ stockQuantity: newQuantity, updatedAt: now })
          .where(eq(productVariants.id, item.variantId));

        await tx.insert(inventoryLogs).values({
          variantId: item.variantId,
          changeType: "return",
          quantityChange: line.restocked,
          previousQuantity: variant.stockQuantity,
          newQuantity,
          reason: input.reason
            ? `Order return: ${input.reason}`
            : "Order return",
          createdAt: now,
        });
      }

      const summary =
        `Refunded ${amount.toFixed(2)} for ${returnedUnits} unit` +
        `${returnedUnits === 1 ? "" : "s"}` +
        `${fullyRefunded ? " (order fully refunded)" : " (partial return)"}` +
        `${input.reason ? `: ${input.reason}` : ""}`;

      await tx
        .update(orders)
        .set({
          adminNotes: appendAdminNote(existing.adminNotes, summary),
          // A partial return leaves the order where it is — there is still an
          // order in the customer's hands, and more of it may come back later.
          ...(fullyRefunded ? { status: "refunded" as const } : {}),
          updatedAt: now,
        })
        .where(eq(orders.id, orderId));

      if (fullyRefunded) {
        await tx
          .update(payments)
          .set({ paymentStatus: "refunded", updatedAt: now })
          .where(eq(payments.orderId, orderId));
      }
    });

    const updated = await this.findById(orderId);
    if (!updated) {
      throw new OrderNotFoundException(orderId);
    }
    return updated;
  }

  /**
   * Card orders whose payment window has elapsed without being marked paid.
   *
   * Deliberately only *finds* them. Whether such an order should be cancelled
   * cannot be answered from this database alone: the payment may have gone
   * through with the confirmation never arriving, and cancelling then would
   * destroy an order the customer has already been charged for. The caller
   * asks the payment provider before deciding.
   */
  async findExpiredCheckouts(
    olderThan: Date,
    limit = 20
  ): Promise<{ orderId: string; sessionId: string | null }[]> {
    const rows = await db
      .select({
        orderId: orders.id,
        sessionId: payments.transactionId,
      })
      .from(orders)
      .innerJoin(payments, eq(payments.orderId, orders.id))
      .where(
        and(
          eq(orders.status, "pending"),
          eq(payments.paymentMethod, "stripe"),
          eq(payments.paymentStatus, "pending"),
          lte(orders.createdAt, olderThan)
        )
      )
      .limit(limit);

    return rows;
  }

  /** Mark an order's payment as failed, e.g. after an expired checkout. */
  async markPaymentFailed(orderId: string): Promise<void> {
    await db
      .update(payments)
      .set({ paymentStatus: "failed", updatedAt: new Date() })
      .where(eq(payments.orderId, orderId));
  }

  /**
   * Move an order to `paid` — the single place a payment is recognised.
   *
   * Both the Stripe webhook and the success page call this, either may arrive
   * first, and either may arrive twice, so the conditional order update is the
   * gate: only the caller that actually moves the row out of `pending` does the
   * rest. Everything runs in one transaction.
   */
  async markAsPaid(
    orderId: string,
    options?: { transactionId?: string; gatewayResponse?: unknown }
  ): Promise<{
    transitioned: boolean;
    orderNumber: string | null;
    userId: string | null;
    /**
     * The coupon on this order was redeemed past its usage or per-customer
     * limit. The payment is still recognised and the discount still stands —
     * see the redemption block below for why refusing is not an option once
     * the customer has been charged. Surfaced so a caller can log it as the
     * anomaly it is rather than letting it pass as an ordinary payment.
     */
    couponLimitExceeded: boolean;
  }> {
    return db.transaction(async (tx) => {
      const now = new Date();
      let couponLimitExceeded = false;

      // Only advance an order still awaiting payment. Without this a late
      // webhook could resurrect an order an admin had already cancelled — and
      // cancelling returns the reserved stock, so it would end up "paid" with
      // nothing held for it.
      const [updated] = await tx
        .update(orders)
        .set({ status: "paid", updatedAt: now })
        .where(
          and(
            eq(orders.id, orderId),
            inArray(orders.status, ["pending", "processing"])
          )
        )
        .returning({
          id: orders.id,
          orderNumber: orders.orderNumber,
          userId: orders.userId,
          couponId: orders.couponId,
          adminNotes: orders.adminNotes,
        });

      // Nothing matched: the order had already moved on. Callers use this to
      // avoid notifying twice when a webhook is redelivered.
      if (!updated) {
        return {
          transitioned: false,
          orderNumber: null,
          userId: null,
          couponLimitExceeded: false,
        };
      }

      await tx
        .update(payments)
        .set({
          paymentStatus: "completed",
          ...(options?.transactionId
            ? { transactionId: options.transactionId }
            : {}),
          ...(options?.gatewayResponse
            ? {
                paymentGatewayResponse: JSON.stringify(options.gatewayResponse),
              }
            : {}),
          updatedAt: now,
        })
        .where(eq(payments.orderId, orderId));

      // Redeem the coupon now that money has actually changed hands. Guarded on
      // the usage row not already existing, so a cash-on-delivery order — which
      // redeems at creation — can never be counted twice.
      if (updated.couponId && updated.userId) {
        const [alreadyRecorded] = await tx
          .select({ id: couponUsages.id })
          .from(couponUsages)
          .where(eq(couponUsages.orderId, orderId))
          .limit(1);

        if (!alreadyRecorded) {
          // Same guarded increment `create()` uses for the cash-on-delivery
          // redemption, closing the same race for the card path. This runs
          // from the Stripe webhook (or the success page racing it), after
          // the customer has already been charged — unlike the COD path,
          // there is no "abort and let them retry" option here. Throwing
          // would roll back this whole transaction, including the order's
          // move to `paid`, and Stripe would have taken the customer's money
          // for an order stuck `pending` forever: a worse outcome than the
          // coupon's usage count reading one over its limit. So a lost race
          // here is logged, not thrown — the payment is still recognised, the
          // coupon simply is not recorded as used for it. This coupon has no
          // variant lock to stay ordered against: markAsPaid never locks a
          // variant row, so there is nothing for this lock to deadlock with.
          const [redeemed] = await tx
            .update(coupons)
            .set({
              usageCount: sql`${coupons.usageCount} + 1`,
              updatedAt: now,
            })
            .where(
              and(
                eq(coupons.id, updated.couponId),
                sql`(${coupons.usageLimit} IS NULL OR ${coupons.usageCount} < ${coupons.usageLimit})`,
                sql`(
                  ${coupons.perUserLimit} IS NULL OR (
                    SELECT COUNT(*)::int FROM coupon_usages
                    WHERE coupon_id = ${updated.couponId} AND user_id = ${updated.userId}
                  ) < ${coupons.perUserLimit}
                )`
              )
            )
            .returning({ id: coupons.id });

          if (!redeemed) {
            // The guard lost, but the customer has already been charged the
            // discounted total — the redemption is a fact whether or not the
            // limit allowed it. Two things follow from that.
            //
            // First, increment anyway. Declining to count a redemption that
            // really happened leaves `usage_count` *under*-reporting, so the
            // next validation still sees room and lets the overrun grow. An
            // unguarded increment makes the counter tell the truth, which also
            // makes the limit self-correcting: at 101/100 every subsequent
            // checkout is refused by the ordinary pre-check.
            await tx
              .update(coupons)
              .set({
                usageCount: sql`${coupons.usageCount} + 1`,
                updatedAt: now,
              })
              .where(eq(coupons.id, updated.couponId));

            // Second, leave a record a person will actually find. This used to
            // be a `console.error` and nothing else, which meant the only trace
            // of a discount given beyond its limit lived in a log nobody reads
            // until they already suspect something. The note is attached to the
            // order the discrepancy is on, and renders on the order detail page
            // alongside the refund notes.
            //
            // Deliberately not an admin notification: `notification_type` has
            // no value for this, and adding one without applying the enum
            // migration would throw at insert.
            couponLimitExceeded = true;

            await tx
              .update(orders)
              .set({
                adminNotes: appendAdminNote(
                  updated.adminNotes,
                  `Coupon redeemed past its limit. The code was already at its ` +
                    `usage or per-customer cap when this payment was ` +
                    `recognised, but the customer had already been charged the ` +
                    `discounted total, so the discount stands and the ` +
                    `redemption has been counted. Review the coupon if this ` +
                    `repeats.`
                ),
                updatedAt: now,
              })
              .where(eq(orders.id, orderId));

            console.error(
              `[Orders] Coupon ${updated.couponId} was redeemed past its limit by order ${orderId} — payment recognised, redemption counted, order annotated.`
            );
          }

          // Recorded on both paths, because both are a real redemption.
          // `idx_coupon_usages_unique` covers (coupon, user, order), so a
          // redelivered webhook cannot double-write this row.
          await tx
            .insert(couponUsages)
            .values({
              couponId: updated.couponId,
              userId: updated.userId,
              orderId,
            })
            .onConflictDoNothing();
        }
      }

      return {
        transitioned: true,
        orderNumber: updated.orderNumber,
        userId: updated.userId,
        couponLimitExceeded,
      };
    });
  }

  /**
   * Find recent orders by user ID
   */
  async findRecentByUserId(
    userId: string,
    limit: number = 10
  ): Promise<OrderEntity[]> {
    const ordersList = await db.query.orders.findMany({
      where: eq(orders.userId, userId),
      with: {
        items: true,
        shippingAddress: true,
        billingAddress: true,
        payments: true,
      },
      orderBy: [desc(orders.createdAt), desc(orders.id)],
      limit,
    });

    return ordersList.map((o) => this.mapToEntity(o));
  }

  // `delete()` was removed. It had no caller and was one autocomplete away
  // from silently destroying an order: it dropped the row outside a
  // transaction while bypassing every invariant `updateStatus` protects — no
  // stock restocked, no coupon released, no status-transition check — and the
  // explicit `order_items` delete was redundant anyway, since that FK already
  // cascades. An order should only ever reach a terminal state (`cancelled`,
  // `refunded`), never vanish: the financial record has to outlive the
  // customer's interest in it. Removed from the interface too.

  /**
   * Count orders by status
   */
  async countByStatus(status: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(sql`${orders.status} = ${status}`);

    return result[0]?.count || 0;
  }

  /**
   * Get orders count
   */
  async count(filters?: OrderFilters): Promise<number> {
    const conditions = this.buildFiltersConditions(filters);

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result[0]?.count || 0;
  }

  /**
   * How many units of a line to actually put back on the shelf when an
   * order closes.
   *
   * `remaining` is what a return hasn't already restocked. `requested` is the
   * caller's ask: `undefined` for "restock everything left" (the default when
   * an admin cancels without an explicit line list), or a specific quantity
   * from an explicit restock instruction. Either way the result is capped at
   * `remaining` — an explicit request is a ceiling on what an admin wants
   * back on sale, not a ceiling `validateRestock` already enforces, since
   * that only checks against the full ordered quantity.
   */
  private resolveRestockQuantity(
    remaining: number,
    requested: number | undefined
  ): number {
    return requested === undefined ? remaining : Math.min(requested, remaining);
  }

  /**
   * Build filter conditions
   */
  private buildFiltersConditions(filters?: OrderFilters) {
    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(orders.userId, filters.userId));
    }

    if (filters?.status) {
      conditions.push(sql`${orders.status} = ${filters.status}`);
    }

    if (filters?.startDate) {
      conditions.push(gte(orders.createdAt, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(lte(orders.createdAt, filters.endDate));
    }

    // `orders.total_amount` is a decimal column, which Drizzle maps to a
    // string — the bound value has to be one too, or the comparison never
    // matches. Same `.toString()` the product repository's price range
    // filter already uses. Postgres still compares numerically once it casts
    // the parameter to the column's type; only the JS-side representation is
    // a string.
    if (filters?.minTotal !== undefined) {
      conditions.push(gte(orders.totalAmount, filters.minTotal.toString()));
    }

    if (filters?.maxTotal !== undefined) {
      conditions.push(lte(orders.totalAmount, filters.maxTotal.toString()));
    }

    // `returnedOnly` and `refundableOnly` mirror `OrderEntity.getRefundedItems()`
    // and `canRefund()`. They are derived rather than stored, but every fact
    // they derive from lives in a table, so they belong in the WHERE clause —
    // that is what keeps the admin list from having to load every order to
    // filter one page of them.
    // ---------------------------------------------------------------------
    // Read this before "tidying" the two filters below.
    //
    // Inside a raw `sql` fragment, Drizzle's **relational** query builder
    // (`db.query.orders.findMany`, which `findAll` uses) rewrites every
    // embedded column object to the query's root table, whatever table that
    // column actually belongs to. `${orderItems.orderId}` does not render as
    // `"order_items"."order_id"` — it renders as `"orders"."order_id"`, a
    // column that does not exist, and Postgres rejects the query with 42703.
    //
    // The core builder (`db.select().from(orders)`, which `count` uses) has no
    // such behaviour and renders the same fragment correctly. So the two paths
    // that share this method produced *different SQL from the same input*:
    // `count` worked and `findAll` threw, meaning the admin orders list 500'd
    // whenever either filter was applied.
    //
    // Only these two filters reach into another table; every other raw
    // fragment here touches `orders` alone, where the rewrite is a harmless
    // no-op. That is why this went unnoticed.
    //
    // The rule that keeps both renderings correct:
    //   - outer/correlated references stay column objects — a root-table
    //     column rewrites to itself, so it is right either way;
    //   - the subquery's own columns are written as literal `alias.column`
    //     text, which no rewrite touches.
    // Table names are safe as `${table}` — only *columns* are rewritten.
    //
    // Putting `${orderItems.refundedQuantity}` back would look like a
    // type-safety improvement and would silently restore the bug.
    // ---------------------------------------------------------------------

    if (filters?.returnedOnly) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${orderItems} oi
          WHERE oi.order_id = ${orders.id}
            AND oi.refunded_quantity > 0
        )`
      );
    }

    if (filters?.refundableOnly) {
      // Mirrors canRefund(): not already refunded, and money actually captured
      // — a completed card payment, or a delivered cash-on-delivery order.
      //
      // Reads the order's single payment row, which `create()` guarantees:
      // exactly one is inserted per order and no path adds a second. If that
      // ever changes, this needs the same "latest row wins" rule `mapToEntity`
      // applies.
      conditions.push(
        sql`${orders.status} <> 'refunded' AND EXISTS (
          SELECT 1 FROM ${payments} p
          WHERE p.order_id = ${orders.id}
            AND p.payment_status <> 'refunded'
            AND (
              p.payment_status = 'completed'
              OR (p.payment_method = 'cash_on_delivery' AND ${orders.deliveredAt} IS NOT NULL)
            )
        )`
      );
    }

    return conditions;
  }

  /**
   * Map database result to OrderEntity
   * Maps actual database schema fields to entity expectations
   */
  /**
   * The address as it stands right now, to be frozen onto the order.
   *
   * Returns null for an id that resolves to nothing rather than throwing: the
   * snapshot is a record, and failing a checkout over one would be a worse
   * outcome than an order that falls back to the join for its address.
   */
  private async loadAddressSnapshot(
    addressId: string | null
  ): Promise<OrderAddress | null> {
    if (!addressId) return null;

    const row = await db.query.addresses.findFirst({
      where: eq(addresses.id, addressId),
      columns: {
        fullName: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        phone: true,
      },
    });

    return toOrderAddress(row);
  }

  private mapToEntity(
    dbOrder: {
      id: string;
      orderNumber?: string | null;
      userId: string | null;
      status: OrderEntity["status"]; // Use entity's OrderStatus type
      subtotal: string;
      taxAmount: string;
      shippingAmount: string;
      totalAmount: string;
      shippingAddressId: string | null;
      billingAddressId: string | null;
      discountAmount?: string;
      couponId?: string | null;
      adminNotes?: string | null;
      createdAt: Date;
      updatedAt: Date;
      shippedAt: Date | null;
      deliveredAt: Date | null;
      items?: Array<{
        id: string;
        productId: string | null;
        variantId?: string | null;
        productName: string;
        variantDetails?: string | null;
        quantity: number;
        unitPrice: string;
        refundedQuantity?: number;
        product?: {
          images?: Array<{ imageUrl: string; isPrimary: boolean }>;
        } | null;
      }>;
      shippingAddress?: DbAddress | null;
      billingAddress?: DbAddress | null;
      shippingAddressSnapshot?: unknown;
      billingAddressSnapshot?: unknown;
      payments?: Array<{
        paymentMethod: string;
        paymentStatus: OrderPaymentStatus;
        updatedAt: Date;
      }> | null;
    },
    customer: OrderCustomer | null = null
  ): OrderEntity {
    // One payment row is written per order at creation. If that ever changes,
    // the most recently updated row is the authoritative one.
    const payment = dbOrder.payments?.length
      ? [...dbOrder.payments].sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
        )[0]
      : null;
    const orderItems =
      dbOrder.items?.map((item) => ({
        id: item.id,
        productId: item.productId ?? "unknown",
        variantId: item.variantId ?? null,
        productName: item.productName,
        variantDetails: item.variantDetails ?? null,
        quantity: item.quantity,
        price: parseFloat(item.unitPrice), // Map unitPrice to price
        refundedQuantity: item.refundedQuantity ?? 0,
        productImage:
          item.product?.images?.find((img) => img.isPrimary)?.imageUrl ??
          item.product?.images?.[0]?.imageUrl ??
          null,
      })) ?? [];

    return new OrderEntity(
      dbOrder.id,
      dbOrder.userId ?? "guest",
      dbOrder.status, // Use as-is, matches entity type
      orderItems,
      parseFloat(dbOrder.subtotal),
      parseFloat(dbOrder.taxAmount), // Map taxAmount to tax
      parseFloat(dbOrder.shippingAmount), // Map shippingAmount to shippingCost
      parseFloat(dbOrder.totalAmount),
      dbOrder.shippingAddressId ?? "",
      dbOrder.billingAddressId ?? "",
      payment?.paymentMethod ?? null,
      payment?.paymentStatus ?? null,
      // The schema has no dedicated paid_at column; the payment row's updatedAt
      // is when it moved to completed.
      payment?.paymentStatus === "completed" ? payment.updatedAt : null,
      dbOrder.shippedAt,
      dbOrder.deliveredAt,
      new Date(dbOrder.createdAt),
      new Date(dbOrder.updatedAt),
      dbOrder.discountAmount ? parseFloat(dbOrder.discountAmount) : 0,
      dbOrder.couponId ?? null,
      resolveOrderAddress(
        dbOrder.shippingAddressSnapshot,
        dbOrder.shippingAddress
      ),
      resolveOrderAddress(
        dbOrder.billingAddressSnapshot,
        dbOrder.billingAddress
      ),
      dbOrder.adminNotes ?? null,
      dbOrder.orderNumber ?? null,
      customer
    );
  }
}
