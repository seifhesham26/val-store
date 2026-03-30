/**
 * ProductVariant Repository Interface
 *
 * Defines the contract for ProductVariant data operations.
 */

import { ProductVariantEntity } from "@/domain/products/entities/product-variant.entity";

export interface VariantFilter {
  productId?: string;
  size?: string;
  color?: string;
  isAvailable?: boolean;
  inStock?: boolean;
}

export interface ProductVariantRepositoryInterface {
  /**
   * Find variant by ID
   */
  findById(variantId: string): Promise<ProductVariantEntity | null>;

  /**
   * Find variant by SKU
   */
  findBySku(sku: string): Promise<ProductVariantEntity | null>;

  /**
   * Find all variants for a product
   */
  findByProduct(productId: string): Promise<ProductVariantEntity[]>;

  /**
   * Find variants with filters
   */
  findMany(filter: VariantFilter): Promise<ProductVariantEntity[]>;

  /**
   * Find available variants for a product
   */
  findAvailableByProduct(productId: string): Promise<ProductVariantEntity[]>;

  /**
   * Create a new variant
   */
  create(variant: ProductVariantEntity): Promise<ProductVariantEntity>;

  /**
   * Update an existing variant
   */
  update(variant: ProductVariantEntity): Promise<ProductVariantEntity>;

  /**
   * Update stock quantity for a variant
   */
  updateStock(
    variantId: string,
    quantity: number
  ): Promise<ProductVariantEntity>;

  /**
   * Adjust stock by delta (positive adds, negative removes)
   */
  adjustStock(variantId: string, delta: number): Promise<ProductVariantEntity>;

  /**
   * Delete a variant
   */
  delete(variantId: string): Promise<void>;

  /**
   * Delete all variants for a product
   */
  deleteByProduct(productId: string): Promise<void>;

  /**
   * Check if SKU exists
   */
  existsBySku(sku: string): Promise<boolean>;

  /**
   * Get total stock for a product (sum of all variant stocks)
   */
  getTotalStockByProduct(productId: string): Promise<number>;
}
