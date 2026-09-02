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
  /**
   * Bypass the payment-window guard.
   *
   * Only for the system unwinding its own failure — a Stripe hand-off that
   * never got off the ground. An admin must not be able to cancel an order
   * while the customer may still be entering their card.
   */
  force?: boolean;
}

export interface OrderFilters {
  status?: string; // Changed to string for compatibility with use cases
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
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

  /**
   * Card orders past their payment window that were never marked paid.
   *
   * Only finds them — deciding whether to cancel needs the payment provider,
   * since a missing confirmation is not the same as a missing payment.
   */
  findExpiredCheckouts(
    olderThan: Date,
    limit?: number
  ): Promise<{ orderId: string; sessionId: string | null }[]>;

  /** Mark an order's payment as failed, e.g. after an expired checkout. */
  markPaymentFailed(orderId: string): Promise<void>;

  /**
   * Recognise payment for an order: advance it to `paid`, complete its payment
   * row and redeem any coupon. Idempotent — safe to call from both the webhook
   * and the success page.
   */
  /**
   * Advance a still-unpaid order to `paid`.
   *
   * `transitioned` is false when the order had already moved on — a redelivered
   * webhook, or the success page racing it — so callers can tell a real payment
   * from a duplicate and avoid notifying twice.
   */
  markAsPaid(
    orderId: string,
    options?: { transactionId?: string; gatewayResponse?: unknown }
  ): Promise<{ transitioned: boolean }>;

  /**
   * Delete an order
   */
  delete(orderId: string): Promise<void>;

  /**
   * Get order count by status
   */
  countByStatus(status: string): Promise<number>;

  /**
   * Get order count with filters
   */
  count(filters?: OrderFilters): Promise<number>;
}
