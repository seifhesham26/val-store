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
  /** order_items row id — needed to restock specific lines. */
  id: string;
  productId: string;
  /** The variant actually bought. Required to decrement the right stock row. */
  variantId: string | null;
  productName: string;
  variantDetails: string | null;
  quantity: number;
  price: number; // Price at time of order
  /** Primary product image, when the repository joined it. */
  productImage?: string | null;
}

/**
 * A shipping/billing address resolved for display on an order.
 *
 * Deliberately string-only: this crosses the tRPC boundary, and the client has
 * no date transformer configured, so any Date field would arrive as a string
 * while claiming to be a Date.
 */
/** Payment state for an order, read from the `payments` row. */
export type OrderPaymentStatus =
  | "pending"
  | "completed"
  | "failed"
  | "refunded";

/**
 * How long an unpaid card order is held before it is cancelled automatically.
 *
 * The order reserves its stock the moment it is created, before the customer
 * is handed to Stripe — so an abandoned checkout takes inventory out of
 * circulation. This is the window we are willing to hold it for.
 *
 * Set to match the Stripe Checkout session's own expiry exactly, so there is
 * one deadline rather than two that disagree. 30 minutes is Stripe's minimum,
 * which is what pins the number.
 */
export const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

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
    public readonly paymentStatus: OrderPaymentStatus | null,
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
    public readonly billingAddress: OrderAddress | null = null,
    /** Internal notes, including cancellation and refund reasons. */
    public readonly adminNotes: string | null = null
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
   * Check if order can be cancelled.
   *
   * An unpaid card order inside its payment window is excluded: the customer
   * may be on Stripe's page entering a card, and it will release itself if
   * they do not.
   */
  canCancel(): boolean {
    if (this.isAwaitingPayment()) return false;
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
   * Has money actually changed hands?
   *
   * Card payments are captured when Stripe confirms them. Cash on delivery is
   * captured when the courier hands the order over, which is the point the order
   * is marked delivered.
   *
   * This is deliberately independent of `status`: an order that was paid and
   * then cancelled still had money taken, and must remain refundable.
   */
  hasCapturedPayment(): boolean {
    if (this.paymentStatus === "completed") return true;
    if (
      this.paymentMethod === "cash_on_delivery" &&
      this.deliveredAt !== null
    ) {
      return true;
    }
    return false;
  }

  /**
   * When this order stops being held for an unpaid card payment, or null if it
   * is not waiting on one.
   */
  paymentDeadline(): Date | null {
    if (this.paymentMethod !== "stripe") return null;
    if (this.status !== "pending") return null;
    if (this.hasCapturedPayment()) return null;
    return new Date(this.createdAt.getTime() + PAYMENT_WINDOW_MS);
  }

  /**
   * Is this order still inside its payment window?
   *
   * While it is, the order is genuinely in flight — the customer may be on
   * Stripe's page entering a card — so it must not be cancelled out from under
   * them.
   */
  isAwaitingPayment(at: Date = new Date()): boolean {
    const deadline = this.paymentDeadline();
    return deadline !== null && deadline.getTime() > at.getTime();
  }

  /**
   * Check a proposed restock against what was actually ordered.
   *
   * Returning more units than a line contains would invent stock out of
   * nothing. This rejects rather than silently clamping: a request asking for
   * more than exists is a bug, and swallowing it hides whatever produced it.
   *
   * @throws Error describing the first problem found
   */
  validateRestock(lines: { orderItemId: string; quantity: number }[]): void {
    const seen = new Set<string>();

    for (const line of lines) {
      if (seen.has(line.orderItemId)) {
        throw new Error(
          `The same order line was listed twice in the restock request`
        );
      }
      seen.add(line.orderItemId);

      const item = this.items.find((i) => i.id === line.orderItemId);
      if (!item) {
        throw new Error(`That line is not part of this order`);
      }

      if (!Number.isInteger(line.quantity) || line.quantity < 0) {
        throw new Error(
          `Cannot return ${line.quantity} of ${item.productName} — the quantity must be a whole number of units`
        );
      }

      if (line.quantity > item.quantity) {
        throw new Error(
          `Cannot return ${line.quantity} of ${item.productName} — only ${item.quantity} ${
            item.quantity === 1 ? "was" : "were"
          } ordered`
        );
      }
    }
  }

  /**
   * Check if order can be refunded.
   *
   * Money must have been captured and not already returned. Note this holds for
   * cancelled orders too — cancelling a paid order does not un-charge the
   * customer, so the refund path has to stay open.
   */
  canRefund(): boolean {
    if (this.status === "refunded") return false;
    if (this.paymentStatus === "refunded") return false;
    return this.hasCapturedPayment();
  }
}
