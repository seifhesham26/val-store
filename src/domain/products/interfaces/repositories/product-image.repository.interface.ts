/**
 * ProductImage Repository Interface
 *
 * Defines the contract for ProductImage data operations.
 */

import { ProductImageEntity } from "@/domain/products/entities/product-image.entity";

export interface ProductImageRepositoryInterface {
  /**
   * Find image by ID
   */
  findById(imageId: string): Promise<ProductImageEntity | null>;

  /**
   * Find all images for a product
   */
  findByProduct(productId: string): Promise<ProductImageEntity[]>;

  /**
   * Find primary image for a product
   */
  findPrimaryByProduct(productId: string): Promise<ProductImageEntity | null>;

  /**
   * Create a new image
   */
  create(image: ProductImageEntity): Promise<ProductImageEntity>;

  /**
   * Update an existing image
   */
  update(image: ProductImageEntity): Promise<ProductImageEntity>;

  /**
   * Delete an image
   */
  delete(imageId: string): Promise<void>;

  /**
   * Delete all images for a product
   */
  deleteByProduct(productId: string): Promise<void>;

  /**
   * Set an image as primary (and unset others)
   */
  setPrimary(productId: string, imageId: string): Promise<void>;

  /**
   * Update display order for multiple images
   */
  updateDisplayOrder(
    imageOrders: Array<{ id: string; displayOrder: number }>
  ): Promise<void>;

  /**
   * Get count of images for a product
   */
  countByProduct(productId: string): Promise<number>;
}
