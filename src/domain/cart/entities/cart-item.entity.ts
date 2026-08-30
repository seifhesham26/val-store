/**
 * CartItem Entity
 *
 * Represents an item in a user's shopping cart.
 * Contains business logic for quantity validation and subtotal calculation.
 */

export class CartItemEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly productId: string,
    public readonly productName: string,
    public readonly productPrice: number,
    public readonly productImage: string | null,
    public readonly quantity: number,
    public readonly maxStock: number, // Available stock for this product
    public readonly addedAt: Date,
    public readonly updatedAt: Date,
    // The specific variant (size/colour) chosen. Null only for products that
    // have no variants at all. Carried through to the order so stock can be
    // decremented against the right row.
    public readonly variantId: string | null = null,
    public readonly variantSize: string | null = null,
    public readonly variantColor: string | null = null
  ) {}

  /** Human-readable variant label, e.g. "Black / L". */
  getVariantLabel(): string | null {
    const parts = [this.variantColor, this.variantSize].filter(Boolean);
    return parts.length > 0 ? parts.join(" / ") : null;
  }

  /**
   * Calculate subtotal for this cart item
   */
  calculateSubtotal(): number {
    return this.productPrice * this.quantity;
  }

  /**
   * Check if quantity can be increased
   */
  canIncrease(amount: number = 1): boolean {
    return this.quantity + amount <= this.maxStock;
  }

  /**
   * Check if quantity can be decreased
   */
  canDecrease(amount: number = 1): boolean {
    return this.quantity - amount > 0;
  }

  /**
   * Check if item is at maximum stock
   */
  isAtMaxStock(): boolean {
    return this.quantity >= this.maxStock;
  }

  /**
   * Get new quantity after increase
   */
  getIncreasedQuantity(amount: number = 1): number {
    return Math.min(this.quantity + amount, this.maxStock);
  }

  /**
   * Get new quantity after decrease
   */
  getDecreasedQuantity(amount: number = 1): number {
    return Math.max(this.quantity - amount, 0);
  }
}
