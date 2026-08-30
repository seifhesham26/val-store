import { db } from "@/db";
import {
  orders,
  orderItems,
  payments,
  coupons,
  couponUsages,
  productVariants,
  inventoryLogs,
} from "@/db/schema";
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm";
import {
  OrderRepositoryInterface,
  OrderFilters,
  UpdateOrderStatusOptions,
} from "@/domain/orders/interfaces/repositories/order.repository.interface";
import {
  OrderEntity,
  PAYMENT_WINDOW_MS,
  type OrderAddress,
  type OrderPaymentStatus,
} from "@/domain/orders/entities/order.entity";
import {
  OrderStatus,
  OrderStatusValue,
} from "@/domain/orders/value-objects/order-status.value-object";
import { OrderNotFoundException } from "@/domain/orders/exceptions/order-not-found.exception";
import { InvalidOrderStatusException } from "@/domain/orders/exceptions/invalid-order-status.exception";

/** How often the lazy expiry sweep is allowed to run, per server process. */
const EXPIRY_SWEEP_INTERVAL_MS = 60_000;
let lastExpirySweep = 0;

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

    return this.mapToEntity(order);
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
      orderBy: [desc(orders.createdAt)],
    });

    return ordersList.map((o) => this.mapToEntity(o));
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

    const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    const orderNumber = `VLK-${datePart}-${randomPart}`;

    await db.transaction(async (tx) => {
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
        currency: "EGP",
        couponId: order.couponId,
        shippingAddressId: order.shippingAddressId,
        billingAddressId: order.billingAddressId,
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
        currency: "EGP",
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
        await tx.insert(couponUsages).values({
          couponId: order.couponId,
          userId: order.userId,
          orderId: order.id,
        });

        await tx
          .update(coupons)
          .set({
            usageCount: sql`${coupons.usageCount} + 1`,
            updatedAt: now,
          })
          .where(eq(coupons.id, order.couponId));
      }
    });

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
    // `cancelled` and `refunded` are final states, so an order can only reach
    // them once — no risk of restoring the same stock twice.
    const isClosing = target === "cancelled" || target === "refunded";

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
          `${target === "refunded" ? "Refunded" : "Cancelled"}: ${options.reason}`
        );
      }

      await tx.update(orders).set(updates).where(eq(orders.id, orderId));

      if (!isClosing) return;

      const now = new Date();

      for (const item of existing.items) {
        if (!item.variantId) continue;

        const restockQuantity = restockByItem
          ? Math.min(restockByItem.get(item.id) ?? 0, item.quantity)
          : item.quantity;

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
          changeType: target === "refunded" ? "return" : "adjustment",
          quantityChange: restockQuantity,
          previousQuantity: variant.stockQuantity,
          newQuantity,
          reason: options?.reason
            ? `Order ${target}: ${options.reason}`
            : `Order ${target} — restocked`,
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
   * Cancel card orders whose payment window has elapsed.
   *
   * There is no scheduler in this app, so this is swept lazily from a few read
   * paths rather than run on a timer. It is throttled per process so those
   * reads do not each pay for it.
   */
  async cancelExpiredCheckouts(): Promise<number> {
    const now = Date.now();
    if (now - lastExpirySweep < EXPIRY_SWEEP_INTERVAL_MS) return 0;
    lastExpirySweep = now;

    // A minute's grace past the deadline, so Stripe's own `checkout.session
    // .expired` event — which expires at the same instant — gets first go at
    // cancelling. This sweep is the fallback for when that webhook is not
    // being delivered, which is always the case in local development.
    const cutoff = new Date(now - PAYMENT_WINDOW_MS - 60_000);

    const stale = await db
      .select({ id: orders.id })
      .from(orders)
      .innerJoin(payments, eq(payments.orderId, orders.id))
      .where(
        and(
          eq(orders.status, "pending"),
          eq(payments.paymentMethod, "stripe"),
          eq(payments.paymentStatus, "pending"),
          lte(orders.createdAt, cutoff)
        )
      )
      .limit(50);

    let cancelled = 0;

    for (const row of stale) {
      try {
        await this.updateStatus(row.id, "cancelled", {
          reason: "Payment window expired",
        });

        await db
          .update(payments)
          .set({ paymentStatus: "failed", updatedAt: new Date() })
          .where(eq(payments.orderId, row.id));

        cancelled += 1;
      } catch (error) {
        // One bad order must not stop the rest being cleaned up.
        console.error(
          `[Orders] Failed to expire unpaid order ${row.id}`,
          error instanceof Error ? error.message : error
        );
      }
    }

    return cancelled;
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
  ): Promise<{ transitioned: boolean }> {
    return db.transaction(async (tx) => {
      const now = new Date();

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
          userId: orders.userId,
          couponId: orders.couponId,
        });

      if (!updated) return { transitioned: false };

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
          await tx.insert(couponUsages).values({
            couponId: updated.couponId,
            userId: updated.userId,
            orderId,
          });

          await tx
            .update(coupons)
            .set({
              usageCount: sql`${coupons.usageCount} + 1`,
              updatedAt: now,
            })
            .where(eq(coupons.id, updated.couponId));
        }
      }

      return { transitioned: true };
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
      orderBy: [desc(orders.createdAt)],
      limit,
    });

    return ordersList.map((o) => this.mapToEntity(o));
  }

  /**
   * Update an order - NOT IMPLEMENTED
   */
  async update(): Promise<OrderEntity> {
    throw new Error("Order update not implemented - use specific methods");
  }

  /**
   * Delete an order
   */
  async delete(orderId: string): Promise<void> {
    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await db.delete(orders).where(eq(orders.id, orderId));
  }

  /**
   * Count orders by status
   */
  async countByStatus(status: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
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
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result[0]?.count || 0;
  }

  /**
   * Get total revenue
   */
  async getTotalRevenue(): Promise<number> {
    // Only count paid/delivered orders
    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${orders.totalAmount} AS NUMERIC)), 0)`,
      })
      .from(orders)
      .where(sql`${orders.status} IN ('processing', 'shipped', 'delivered')`);

    return parseFloat(result[0]?.total || "0");
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

    return conditions;
  }

  /**
   * Map database result to OrderEntity
   * Maps actual database schema fields to entity expectations
   */
  private mapToEntity(dbOrder: {
    id: string;
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
      product?: {
        images?: Array<{ imageUrl: string; isPrimary: boolean }>;
      } | null;
    }>;
    shippingAddress?: DbAddress | null;
    billingAddress?: DbAddress | null;
    payments?: Array<{
      paymentMethod: string;
      paymentStatus: OrderPaymentStatus;
      updatedAt: Date;
    }> | null;
  }): OrderEntity {
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
      toOrderAddress(dbOrder.shippingAddress),
      toOrderAddress(dbOrder.billingAddress),
      dbOrder.adminNotes ?? null
    );
  }
}
