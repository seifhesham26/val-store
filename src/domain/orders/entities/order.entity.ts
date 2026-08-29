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
  /** The variant actually bought. Required to decrement the right stock row. */
  variantId: string | null;
  productName: string;
  variantDetails: string | null;
  quantity: number;
  price: number; // Price at time of order
}

/**
 * A shipping/billing address resolved for display on an order.
 *
 * Deliberately string-only: this crosses the tRPC boundary, and the client has
 * no date transformer configured, so any Date field would arrive as a string
 * while claiming to be a Date.
 */
export interface OrderAddress {
  fullName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
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
    // Foreign keys into `addresses`. Named *Id because that is what they hold —
    // the previous single `shippingAddress: string` was written as an id and
    // read back as an id, but rendered as if it were a printable address.
    public readonly shippingAddressId: string,
    public readonly billingAddressId: string,
    public readonly paymentMethod: string | null,
    public readonly paidAt: Date | null,
    public readonly shippedAt: Date | null,
    public readonly deliveredAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    // Discount applied to this order (coupon). Subtracted from the total.
    public readonly discount: number = 0,
    public readonly couponId: string | null = null,
    // Resolved addresses, populated by the repository when it joins them.
    // Null on write and on list queries that don't need them.
    public readonly shippingAddress: OrderAddress | null = null,
    public readonly billingAddress: OrderAddress | null = null
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
    const expectedTotal =
      this.subtotal + this.tax + this.shippingCost - this.discount;
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
