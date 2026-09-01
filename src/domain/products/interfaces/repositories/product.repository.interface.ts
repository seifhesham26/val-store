/**
 * Product Repository Interface
 *
 * Defines the contract for Product data operations.
 * Implementation will be in the infrastructure layer.
 */

import { ProductEntity } from "@/domain/products/entities/product.entity";

/**
 * Images and variants supplied at creation time.
 *
 * They belong to the same write as the product: a product that exists with none
 * of its images, because a second request failed, is not a product anyone asked
 * for. Passing them here lets the repository commit all three together.
 */
export interface NewProductRelations {
  images?: {
    imageUrl: string;
    altText?: string | null;
    isPrimary?: boolean;
  }[];
  variants?: {
    sku: string;
    size?: string | null;
    color?: string | null;
    stockQuantity: number;
    priceAdjustment: number;
  }[];
}

export interface ProductFilters {
  isActive?: boolean;
  isFeatured?: boolean;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  /** Max number of results to return */
  limit?: number;
  /** Rows to skip. Pair with `limit` for pagination. */
  offset?: number;
  /** Exclude a specific product ID from results */
  excludeId?: string;
  /** Restrict to one gender. Was applied in JS after fetching everything. */
  gender?: string;
  /** Only products whose sale price actually undercuts the base price. */
  isOnSale?: boolean;
  /**
   * Case-insensitive match against name or description.
   *
   * Lives here rather than in a separate `search()` so it composes with the
   * other filters and, crucially, with `limit`/`offset` — a search that cannot
   * be paginated in SQL is a search that loads the whole catalogue.
   */
  search?: string;
}

export interface ProductRepositoryInterface {
  /**
   * Find a product by ID
   */
  findById(productId: string): Promise<ProductEntity | null>;

  /**
   * Find a product by slug
   */
  findBySlug(slug: string): Promise<ProductEntity | null>;

  /**
   * Find several products by id, in one query.
   *
   * Order is not guaranteed — a caller that curates an order (the homepage's
   * featured list) must re-apply it itself.
   */
  findByIds(productIds: string[]): Promise<ProductEntity[]>;

  /**
   * Find all products with optional filters
   */
  findAll(filters?: ProductFilters): Promise<ProductEntity[]>;

  /**
   * Find products by category
   */
  findByCategory(categoryId: string): Promise<ProductEntity[]>;

  /**
   * Find featured products
   */
  findFeatured(limit?: number): Promise<ProductEntity[]>;

  /**
   * Create a new product
   */
  create(
    product: ProductEntity,
    relations?: NewProductRelations
  ): Promise<ProductEntity>;

  /**
   * Update an existing product
   */
  update(product: ProductEntity): Promise<ProductEntity>;

  /**
   * Delete a product
   */
  delete(productId: string): Promise<void>;

  /**
   * Update product stock to an absolute value
   * @param productId - Product ID
   * @param newStock - New stock quantity (absolute value, must be >= 0)
   */
  updateStock(productId: string, newStock: number): Promise<void>;

  /**
   * Check if a product slug exists
   */
  existsBySlug(slug: string): Promise<boolean>;

  /**
   * Check if a SKU exists
   */
  existsBySKU(sku: string): Promise<boolean>;

  /**
   * Toggle product active status
   */
  toggleStatus(productId: string): Promise<ProductEntity>;

  /**
   * Get products count
   */
  count(filters?: ProductFilters): Promise<number>;
}
