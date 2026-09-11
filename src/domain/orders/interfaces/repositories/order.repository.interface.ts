/**
 * Order Repository Interface
 *
 * Defines the contract for Order data operations.
 * Implementation will be in the infrastructure layer.
 */

import {
  OrderEntity,
  type RefundLine,
} from "@/domain/orders/entities/order.entity";

/** How much of each line to return to stock when closing an order. */
export interface RestockLine {
  orderItemId: string;
  quantity: number;
}

export interface UpdateOrderStatusOptions {
  /** Why the order was cancelled or refunded. Stored on the order and on each stock log. */
  reason?: string;
  /**
   * Lines to return to stock. Omit to restock everything (the default for API
   * callers); pass an explicit list — including an empty one — to restock only
   * part of the order, e.g. when a returned item comes back damaged.
   */
  restock?: RestockLine[];
}

export interface OrderFilters {
  status?: string; // Changed to string for compatibility with use cases
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  /** Inclusive lower bound on `orders.total_amount`. */
  minTotal?: number;
  /** Inclusive upper bound on `orders.total_amount`. */
  maxTotal?: number;
  /** Max rows to return. */
  limit?: number;
  /** Rows to skip. Pair with `limit` for pagination. */
  offset?: number;
  /**
   * Only orders with captured money that has not been fully returned — the
   * SQL equivalent of `OrderEntity.canRefund()`.
   *
   * Derived state, but expressible: it reads the order's status and its payment
   * row. Keeping it in SQL is what lets the admin list stay paginated; applying
   * it in JavaScript would mean loading every order to find one page of them.
   */
  refundableOnly?: boolean;
  /** Only orders with at least one unit sent back. */
  returnedOnly?: boolean;
}

export interface OrderRepositoryInterface {
  /**
   * Find an order by ID
   */
  findById(orderId: string): Promise<OrderEntity | null>;

  /**
   * Find all orders with optional filters
   */
  findAll(filters?: OrderFilters): Promise<OrderEntity[]>;

  /**
   * Find orders by user ID
   */
  findByUserId(userId: string): Promise<OrderEntity[]>;

  /**
   * Find orders by status
   */
  findByStatus(status: string): Promise<OrderEntity[]>;

  /**
   * Get user's recent orders
   */
  findRecentByUserId(userId: string, limit?: number): Promise<OrderEntity[]>;

  /**
   * Create a new order
   */
  create(order: OrderEntity): Promise<OrderEntity>;

  /**
   * Update an existing order
   */

  /**
   * Update order status
   */
  updateStatus(
    orderId: string,
    status: string,
    options?: UpdateOrderStatusOptions
  ): Promise<OrderEntity>;

  /**
   * Record a return: refund the units sent back and restock the resellable
   * ones. The order only reaches `refunded` once every unit has come back.
   */
  refund(
    orderId: string,
    input: { lines: RefundLine[]; reason?: string }
  ): Promise<OrderEntity>;

  // `delete(orderId)` was removed — no caller, and declaring it here was the
  // risk: an interface method is a standing invitation. Deleting an order
  // bypasses every invariant `updateStatus` enforces (stock restock, coupon
  // release, transition rules) and destroys a financial record. Orders reach a
  // terminal state instead; they do not disappear.

  /**
   * Get order count by status
   */
  countByStatus(status: string): Promise<number>;

  /**
   * Get order count with filters
   */
  count(filters?: OrderFilters): Promise<number>;
}
