/**
 * ProductImage Entity
 *
 * Represents an image associated with a product.
 * Supports ordering and primary image designation.
 */

export class ProductImageEntity {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly imageUrl: string,
    public readonly altText: string | null,
    public readonly displayOrder: number,
    public readonly isPrimary: boolean,
    public readonly createdAt: Date
  ) {}

  /**
   * Get the full image URL
   */
  getImageUrl(): string {
    return this.imageUrl;
  }

  /**
   * Create a copy with primary flag toggled
   */
  setPrimary(isPrimary: boolean): ProductImageEntity {
    return new ProductImageEntity(
      this.id,
      this.productId,
      this.imageUrl,
      this.altText,
      this.displayOrder,
      isPrimary,
      this.createdAt
    );
  }

  /**
   * Create a copy with updated display order
   */
  setDisplayOrder(order: number): ProductImageEntity {
    return new ProductImageEntity(
      this.id,
      this.productId,
      this.imageUrl,
      this.altText,
      order,
      this.isPrimary,
      this.createdAt
    );
  }

  /**
   * Create a copy with updated alt text
   */
  setAltText(altText: string): ProductImageEntity {
    return new ProductImageEntity(
      this.id,
      this.productId,
      this.imageUrl,
      altText,
      this.displayOrder,
      this.isPrimary,
      this.createdAt
    );
  }

  /**
   * Get a thumbnail URL (if using CDN with transformations)
   * Override this for specific CDN implementations
   */
  getThumbnailUrl(_width: number = 200): string {
    // For UploadThing, images are served as-is
    // For other CDNs, you might add transformation params
    return this.imageUrl;
  }
}
