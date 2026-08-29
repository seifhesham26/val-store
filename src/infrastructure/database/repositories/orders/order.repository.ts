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
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  OrderRepositoryInterface,
  OrderFilters,
} from "@/domain/orders/interfaces/repositories/order.repository.interface";
import {
  OrderEntity,
  type OrderAddress,
} from "@/domain/orders/entities/order.entity";
import {
  OrderStatus,
  OrderStatusValue,
} from "@/domain/orders/value-objects/order-status.value-object";
import { OrderNotFoundException } from "@/domain/orders/exceptions/order-not-found.exception";
import { InvalidOrderStatusException } from "@/domain/orders/exceptions/invalid-order-status.exception";

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
        items: true,
        shippingAddress: true,
        billingAddress: true,
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
      for (const item of order.items) {
        if (!item.variantId) continue; // Product has no variants — nothing to track

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

      // Record coupon consumption in the same transaction as the order.
      // Doing this afterwards would leave a discounted order whose coupon was
      // never marked used, letting the same code be redeemed again.
      if (order.couponId) {
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
  async updateStatus(orderId: string, status: string): Promise<OrderEntity> {
    // Find existing order
    const existing = await this.findById(orderId);
    if (!existing) {
      throw new OrderNotFoundException(orderId);
    }

    // Validate status transition using value object
    const currentStatus = OrderStatus.create(existing.status);
    const newStatus = OrderStatus.create(status);

    if (!currentStatus.canTransitionTo(newStatus.getValue())) {
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
    // `cancelled` and `refunded` are final states, so an order can only reach
    // them once — no risk of restoring the same stock twice.
    const shouldRestoreStock = target === "cancelled" || target === "refunded";

    await db.transaction(async (tx) => {
      await tx.update(orders).set(updates).where(eq(orders.id, orderId));

      if (!shouldRestoreStock) return;

      const now = new Date();

      for (const item of existing.items) {
        if (!item.variantId) continue;

        const [variant] = await tx
          .select({ stockQuantity: productVariants.stockQuantity })
          .from(productVariants)
          .where(eq(productVariants.id, item.variantId))
          .for("update")
          .limit(1);

        // The variant may have been deleted since the order was placed.
        if (!variant) continue;

        const newQuantity = variant.stockQuantity + item.quantity;

        await tx
          .update(productVariants)
          .set({ stockQuantity: newQuantity, updatedAt: now })
          .where(eq(productVariants.id, item.variantId));

        await tx.insert(inventoryLogs).values({
          variantId: item.variantId,
          changeType: target === "refunded" ? "return" : "adjustment",
          quantityChange: item.quantity,
          previousQuantity: variant.stockQuantity,
          newQuantity,
          reason: `Order ${target} — restocked`,
          createdAt: now,
        });
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
    createdAt: Date;
    updatedAt: Date;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    items?: Array<{
      productId: string | null;
      variantId?: string | null;
      productName: string;
      variantDetails?: string | null;
      quantity: number;
      unitPrice: string;
    }>;
    shippingAddress?: DbAddress | null;
    billingAddress?: DbAddress | null;
  }): OrderEntity {
    const orderItems =
      dbOrder.items?.map((item) => ({
        productId: item.productId ?? "unknown",
        variantId: item.variantId ?? null,
        productName: item.productName,
        variantDetails: item.variantDetails ?? null,
        quantity: item.quantity,
        price: parseFloat(item.unitPrice), // Map unitPrice to price
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
      null, // paymentMethod not in current schema
      null, // paidAt not in current schema
      dbOrder.shippedAt,
      dbOrder.deliveredAt,
      new Date(dbOrder.createdAt),
      new Date(dbOrder.updatedAt),
      dbOrder.discountAmount ? parseFloat(dbOrder.discountAmount) : 0,
      null, // couponId is recorded in coupon_usages, not on the order row
      toOrderAddress(dbOrder.shippingAddress),
      toOrderAddress(dbOrder.billingAddress)
    );
  }
}
