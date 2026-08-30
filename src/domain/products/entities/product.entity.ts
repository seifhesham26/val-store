/**
 * Product Entity
 *
 * Represents a product in the e-commerce store.
 * Contains business logic for pricing, availability, and discounts.
 */

// Gender enum matching database enum
export type Gender = "men" | "women" | "unisex" | "kids";

export class ProductEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    /**
     * The stock-keeping unit the admin typed.
     *
     * Distinct from `slug`: the slug is a URL and may be renamed for SEO, while
     * the SKU is the warehouse's name for the product and must not move. Both are
     * unique columns; conflating them is what made renaming a product corrupt its
     * inventory identity.
     */
    public readonly sku: string,
    public readonly description: string,
    public readonly basePrice: number,
    public readonly salePrice: number | null,
    public readonly categoryId: string | null,
    public readonly stock: number,
    public readonly images: string[], // Array of image URLs
    public readonly isActive: boolean,
    public readonly isFeatured: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    // Product detail fields.
    // Deliberately NOT defaulted: these are persisted columns, and a caller that
    // forgets one would silently overwrite it with null on update. Requiring them
    // turns that mistake into a compile error.
    public readonly gender: Gender | null,
    public readonly material: string | null,
    public readonly careInstructions: string | null,
    public readonly metaTitle: string | null,
    public readonly metaDescription: string | null,
    // Audit fields (not persisted yet — no columns for these)
    public readonly createdBy: string | null = null,
    public readonly updatedBy: string | null = null
  ) {}

  /**
   * Get the current selling price (sale price if on sale, otherwise base price)
   */
  getCurrentPrice(): number {
    return this.salePrice ?? this.basePrice;
  }

  /**
   * Check if product is currently on sale
   */
  isOnSale(): boolean {
    return this.salePrice !== null && this.salePrice < this.basePrice;
  }

  /**
   * Calculate discount percentage
   */
  getDiscountPercentage(): number {
    if (!this.isOnSale()) return 0;
    return Math.round(
      ((this.basePrice - this.salePrice!) / this.basePrice) * 100
    );
  }

  /**
   * Check if product is available for purchase
   */
  isAvailable(): boolean {
    return this.isActive && this.stock > 0;
  }

  /**
   * Check if product can be purchased in given quantity
   */
  canPurchase(quantity: number): boolean {
    return this.isAvailable() && this.stock >= quantity;
  }

  /**
   * Check if stock is low (less than 10 items)
   */
  isLowStock(): boolean {
    return this.stock > 0 && this.stock < 10;
  }

  /**
   * Check if product is out of stock
   */
  isOutOfStock(): boolean {
    return this.stock === 0;
  }

  /**
   * Get primary image (first in array)
   */
  getPrimaryImage(): string | null {
    return this.images.length > 0 ? this.images[0] : null;
  }
}
