/**
 * ProductVariant Entity
 *
 * Represents a specific variant of a product (size, color combination).
 * Contains stock management and pricing logic.
 */

export class ProductVariantEntity {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly sku: string,
    public readonly size: string | null,
    public readonly color: string | null,
    public readonly stockQuantity: number,
    public readonly priceAdjustment: number,
    public readonly isAvailable: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  /**
   * Check if variant is in stock
   */
  isInStock(): boolean {
    return this.stockQuantity > 0 && this.isAvailable;
  }

  /**
   * Check if requested quantity is available
   */
  hasStock(quantity: number): boolean {
    return this.stockQuantity >= quantity && this.isAvailable;
  }

  /**
   * Get final price with adjustment applied
   * @param basePrice - The product's base price
   */
  getFinalPrice(basePrice: number): number {
    return Math.max(0, basePrice + this.priceAdjustment);
  }

  /**
   * Create a variant with adjusted stock
   * Use for stock updates (add/remove inventory)
   */
  adjustStock(delta: number): ProductVariantEntity {
    const newQuantity = Math.max(0, this.stockQuantity + delta);
    return new ProductVariantEntity(
      this.id,
      this.productId,
      this.sku,
      this.size,
      this.color,
      newQuantity,
      this.priceAdjustment,
      this.isAvailable,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Create a variant with updated availability
   */
  setAvailable(available: boolean): ProductVariantEntity {
    return new ProductVariantEntity(
      this.id,
      this.productId,
      this.sku,
      this.size,
      this.color,
      this.stockQuantity,
      this.priceAdjustment,
      available,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Get display name for the variant (e.g., "Red / Large")
   */
  getDisplayName(): string {
    const parts: string[] = [];
    if (this.color) parts.push(this.color);
    if (this.size) parts.push(this.size);
    return parts.length > 0 ? parts.join(" / ") : this.sku;
  }

  /**
   * Check if variant matches given size and color
   */
  matches(size: string | null, color: string | null): boolean {
    return this.size === size && this.color === color;
  }
}
