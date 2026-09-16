/**
 * ProductVariant Repository Interface
 *
 * Defines the contract for ProductVariant data operations.
 */

import { ProductVariantEntity } from "@/domain/products/entities/product-variant.entity";
import type { InventoryAvailabilityState } from "@/domain/inventory/inventory-policy";

export interface SellableProductVariant {
  variant: ProductVariantEntity;
  sellableStock: number;
  availabilityState: InventoryAvailabilityState;
}

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

  /** Batch-load specific variants by id. */
  findByIds(variantIds: string[]): Promise<ProductVariantEntity[]>;

  /**
   * Batch-load variants for several products at once.
   * Avoids an N+1 when a grid needs every card's variant options.
   */
  findByProducts(
    productIds: string[]
  ): Promise<Map<string, ProductVariantEntity[]>>;

  /** Read variants with the server-owned sellable stock calculation. */
  findSellableByIds(variantIds: string[]): Promise<SellableProductVariant[]>;

  /** Read every variant for a product with derived stock and state. */
  findSellableByProduct(productId: string): Promise<SellableProductVariant[]>;

  /** Batch-read product variants with derived stock and state. */
  findSellableByProducts(
    productIds: string[]
  ): Promise<Map<string, SellableProductVariant[]>>;

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
