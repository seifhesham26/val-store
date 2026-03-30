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
    const transitions: Record<OrderStatusValue, OrderStatusValue[]> = {
      pending: ["processing", "paid", "cancelled"],
      processing: ["paid", "cancelled"],
      paid: ["shipped", "refunded"],
      shipped: ["delivered", "cancelled"],
      delivered: ["refunded"],
      cancelled: [], // Final state
      refunded: [], // Final state
    };

    return transitions[this.value]?.includes(newStatus) || false;
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
