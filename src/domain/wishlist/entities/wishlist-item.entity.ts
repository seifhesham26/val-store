/**
 * WishlistItem Entity
 *
 * Represents an item in a user's wishlist, including essential product details
 * needed for display without requiring additional database joins.
 */

export class WishlistItemEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly productId: string,
    public readonly productName: string,
    public readonly productPrice: number,
    public readonly productSalePrice: number | null,
    public readonly productImage: string | null,
    public readonly productImageAlt: string | null,
    public readonly productSlug: string,
    public readonly inStock: boolean,
    public readonly addedAt: Date
  ) {}

  /**
   * Check if the item is currently on sale
   */
  isOnSale(): boolean {
    return (
      this.productSalePrice !== null &&
      this.productSalePrice < this.productPrice
    );
  }

  /**
   * Get the current effective price (sale price if applicable, otherwise base price)
   */
  getCurrentPrice(): number {
    return this.isOnSale() && this.productSalePrice !== null
      ? this.productSalePrice
      : this.productPrice;
  }
}
