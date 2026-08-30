/**
 * OrderStatus Value Object
 *
 * Represents order status with state machine logic for valid transitions.
 * Matches database enum: pending, processing, paid, shipped, delivered, cancelled, refunded
 */

export type OrderStatusValue =
  | "pending"
  | "processing"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

/**
 * The canonical order status list — the single source of truth for the DB enum,
 * the tRPC input schema, and every admin control.
 *
 * Keep in sync with the `order_status` pgEnum in src/db/schema.ts.
 */
export const ORDER_STATUSES = [
  "pending",
  "processing",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const satisfies readonly OrderStatusValue[];

/**
 * Extra facts a transition may depend on beyond the current status.
 */
export interface OrderTransitionContext {
  /** True when money has actually been taken (card captured, or COD delivered). */
  paymentCaptured?: boolean;
}

/**
 * Legal status transitions. `cancelled` and `refunded` are final states.
 */
const ORDER_STATUS_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  pending: ["processing", "paid", "cancelled"],
  processing: ["paid", "cancelled"],
  paid: ["shipped", "refunded"],
  shipped: ["delivered", "cancelled"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export class OrderStatus {
  private constructor(private readonly value: OrderStatusValue) {}

  /**
   * Create OrderStatus from string
   */
  static create(status: string): OrderStatus {
    const normalizedStatus = status.toLowerCase().trim();

    const validStatuses: OrderStatusValue[] = [
      "pending",
      "processing",
      "paid",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ];

    if (!validStatuses.includes(normalizedStatus as OrderStatusValue)) {
      throw new Error(`Invalid order status: ${status}`);
    }

    return new OrderStatus(normalizedStatus as OrderStatusValue);
  }

  /**
   * Get status value
   */
  getValue(): OrderStatusValue {
    return this.value;
  }

  /**
   * Check if transition to another status is valid
   */
  canTransitionTo(
    newStatus: OrderStatusValue,
    context?: OrderTransitionContext
  ): boolean {
    return OrderStatus.canTransition(this.value, newStatus, context);
  }

  /**
   * Static form of `canTransitionTo`, safe to call with untrusted strings.
   *
   * Used by the admin UI to disable statuses the order cannot legally move to,
   * so an admin cannot pick an option that would throw on the server.
   */
  static canTransition(
    from: string,
    to: string,
    context?: OrderTransitionContext
  ): boolean {
    const allowed = ORDER_STATUS_TRANSITIONS[from as OrderStatusValue];
    if (allowed?.includes(to as OrderStatusValue)) return true;

    // Cancelling does not un-charge the customer. An order whose payment was
    // already captured must therefore stay refundable even from `cancelled`,
    // otherwise money taken has no route back through the system. This cannot
    // live in the transition table because it depends on payment state, not
    // just on the current status.
    if (from === "cancelled" && to === "refunded" && context?.paymentCaptured) {
      return true;
    }

    return false;
  }

  /**
   * Check if status is final (cannot be changed)
   */
  isFinal(): boolean {
    return this.value === "cancelled" || this.value === "refunded";
  }

  /**
   * Convert to string
   */
  toString(): string {
    return this.value;
  }
}
