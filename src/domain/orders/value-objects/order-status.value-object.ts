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
  canTransitionTo(newStatus: OrderStatusValue): boolean {
    return OrderStatus.canTransition(this.value, newStatus);
  }

  /**
   * Static form of `canTransitionTo`, safe to call with untrusted strings.
   *
   * Used by the admin UI to disable statuses the order cannot legally move to,
   * so an admin cannot pick an option that would throw on the server.
   */
  static canTransition(from: string, to: string): boolean {
    const allowed = ORDER_STATUS_TRANSITIONS[from as OrderStatusValue];
    return allowed ? allowed.includes(to as OrderStatusValue) : false;
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
