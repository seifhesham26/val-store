/**
 * Order Entity
 *
 * Represents a customer order with items, payment, and shipping information.
 * Contains business logic for order status and calculations.
 */

export type OrderStatus =
  | "pending"
  | "processing"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number; // Price at time of order
}

export class OrderEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly status: OrderStatus,
    public readonly items: OrderItem[],
    public readonly subtotal: number,
    public readonly tax: number,
    public readonly shippingCost: number,
    public readonly totalAmount: number,
    public readonly shippingAddress: string,
    public readonly billingAddress: string,
    public readonly paymentMethod: string | null,
    public readonly paidAt: Date | null,
    public readonly shippedAt: Date | null,
    public readonly deliveredAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  /**
   * Check if order has been paid
   */
  isPaid(): boolean {
    return (
      this.paidAt !== null ||
      this.status === "paid" ||
      this.status === "processing" ||
      this.status === "shipped" ||
      this.status === "delivered"
    );
  }

  /**
   * Check if order can be cancelled
   */
  canCancel(): boolean {
    return this.status === "pending" || this.status === "processing";
  }

  /**
   * Check if order has been shipped
   */
  isShipped(): boolean {
    return (
      this.shippedAt !== null ||
      this.status === "shipped" ||
      this.status === "delivered"
    );
  }

  /**
   * Check if order has been delivered
   */
  isDelivered(): boolean {
    return this.deliveredAt !== null || this.status === "delivered";
  }

  /**
   * Validate that stored total matches calculated total
   * @throws Error if totals don't match (more than 1 cent difference)
   */
  validateTotal(): void {
    const expectedTotal = this.subtotal + this.tax + this.shippingCost;
    if (Math.abs(expectedTotal - this.totalAmount) > 0.01) {
      throw new Error(
        `Order total mismatch: expected ${expectedTotal.toFixed(
          2
        )}, got ${this.totalAmount.toFixed(2)}`
      );
    }
  }

  /**
   * Get total number of items
   */
  getTotalItems(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Check if order is in a final state (can't be modified)
   */
  isFinalState(): boolean {
    return (
      this.status === "delivered" ||
      this.status === "cancelled" ||
      this.status === "refunded"
    );
  }

  /**
   * Check if order can be refunded
   * Allows refunds for paid, shipped, and delivered orders
   */
  canRefund(): boolean {
    // Allow refunds for paid/shipped/delivered orders, but not cancelled/refunded
    return (
      this.isPaid() && this.status !== "cancelled" && this.status !== "refunded"
    );
  }
}
