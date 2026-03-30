import { db } from "@/db";
import { orders, orderItems, payments } from "@/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  OrderRepositoryInterface,
  OrderFilters,
} from "@/domain/orders/interfaces/repositories/order.repository.interface";
import { OrderEntity } from "@/domain/orders/entities/order.entity";
import {
  OrderStatus,
  OrderStatusValue,
} from "@/domain/orders/value-objects/order-status.value-object";
import { OrderNotFoundException } from "@/domain/orders/exceptions/order-not-found.exception";
import { InvalidOrderStatusException } from "@/domain/orders/exceptions/invalid-order-status.exception";

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
        discountAmount: "0",
        totalAmount: order.totalAmount.toFixed(2),
        currency: "EGP",
        shippingAddressId: order.shippingAddress,
        billingAddressId: order.billingAddress,
        createdAt: now,
        updatedAt: now,
      });

      if (order.items.length > 0) {
        await tx.insert(orderItems).values(
          order.items.map((item) => ({
            orderId: order.id,
            productId: item.productId,
            variantId: null,
            productName: item.productName,
            variantDetails: null,
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

    // Update database
    await db.update(orders).set(updates).where(eq(orders.id, orderId));

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
    createdAt: Date;
    updatedAt: Date;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    items?: Array<{
      productId: string | null;
      productName: string;
      quantity: number;
      unitPrice: string;
    }>;
  }): OrderEntity {
    const orderItems =
      dbOrder.items?.map((item) => ({
        productId: item.productId ?? "unknown",
        productName: item.productName,
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
      dbOrder.shippingAddressId ?? "", // Map ID to string for now
      dbOrder.billingAddressId ?? "", // Map ID to string for now
      null, // paymentMethod not in current schema
      null, // paidAt not in current schema
      dbOrder.shippedAt,
      dbOrder.deliveredAt,
      new Date(dbOrder.createdAt),
      new Date(dbOrder.updatedAt)
    );
  }
}
