import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  ProductRepositoryInterface,
  ProductFilters,
} from "@/domain/products/interfaces/repositories/product.repository.interface";
import { ProductEntity } from "@/domain/products/entities/product.entity";
import { ProductNotFoundException } from "@/domain/products/exceptions/product-not-found.exception";
import { DuplicateSKUException } from "@/domain/products/exceptions/duplicate-sku.exception";

/**
 * Product Repository Implementation using Drizzle ORM
 *
 * Implements the ProductRepositoryInterface using PostgreSQL via Drizzle.
 */
export class DrizzleProductRepository implements ProductRepositoryInterface {
  /**
   * Find product by ID
   */
  async findById(productId: string): Promise<ProductEntity | null> {
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      with: {
        variants: true,
        images: true,
      },
    });

    if (!product) {
      return null;
    }

    return this.mapToEntity(product);
  }

  /**
   * Find product by slug
   */
  async findBySlug(slug: string): Promise<ProductEntity | null> {
    const product = await db.query.products.findFirst({
      where: eq(products.slug, slug),
      with: {
        variants: true,
        images: true,
      },
    });

    if (!product) {
      return null;
    }

    return this.mapToEntity(product);
  }

  /**
   * Find all products with optional filtering
   */
  async findAll(filters?: ProductFilters): Promise<ProductEntity[]> {
    const conditions = this.buildFiltersConditions(filters);

    const productsList = await db.query.products.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        variants: true,
        images: true,
      },
      orderBy: [desc(products.createdAt)],
    });

    return productsList.map((p) => this.mapToEntity(p));
  }

  /**
   * Find products by category
   */
  async findByCategory(categoryId: string): Promise<ProductEntity[]> {
    return this.findAll({ categoryId });
  }

  /**
   * Find featured products
   */
  async findFeatured(limit: number = 10): Promise<ProductEntity[]> {
    const productsList = await db.query.products.findMany({
      where: and(eq(products.isFeatured, true), eq(products.isActive, true)),
      with: {
        variants: true,
        images: true,
      },
      limit,
      orderBy: [desc(products.createdAt)],
    });

    return productsList.map((p) => this.mapToEntity(p));
  }

  /**
   * Search products by name or description
   */
  async search(query: string): Promise<ProductEntity[]> {
    const searchTerm = `%${query}%`;

    const productsList = await db.query.products.findMany({
      where: and(
        eq(products.isActive, true),
        sql`(${products.name} ILIKE ${searchTerm} OR ${products.description} ILIKE ${searchTerm})`
      ),
      with: {
        variants: true,
        images: true,
      },
      orderBy: [desc(products.createdAt)],
    });

    return productsList.map((p) => this.mapToEntity(p));
  }

  /**
   * Create a new product
   */
  async create(product: ProductEntity): Promise<ProductEntity> {
    // Check if SKU exists
    const skuExists = await this.existsBySKU(product.slug); // Using slug as SKU for now
    if (skuExists) {
      throw new DuplicateSKUException(product.slug);
    }

    // Create product (without relations for now - variants/images handled separately)
    const [newProduct] = await db
      .insert(products)
      .values({
        name: product.name,
        slug: product.slug,
        sku: product.slug, // Using slug as SKU
        description: product.description,
        categoryId: product.categoryId,
        basePrice: product.basePrice.toString(),
        salePrice: product.salePrice?.toString() || null,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        gender: product.gender as "men" | "women" | "unisex" | "kids" | null,
        material: product.material,
        careInstructions: product.careInstructions,
        metaTitle: product.metaTitle,
        metaDescription: product.metaDescription,
      })
      .returning();

    return this.mapToEntity(newProduct);
  }

  /**
   * Update an existing product
   */
  async update(product: ProductEntity): Promise<ProductEntity> {
    const existing = await this.findById(product.id);
    if (!existing) {
      throw new ProductNotFoundException(product.id);
    }

    const [updated] = await db
      .update(products)
      .set({
        name: product.name,
        slug: product.slug,
        description: product.description,
        categoryId: product.categoryId,
        basePrice: product.basePrice.toString(),
        salePrice: product.salePrice?.toString() || null,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        gender: product.gender as "men" | "women" | "unisex" | "kids" | null,
        material: product.material,
        careInstructions: product.careInstructions,
        metaTitle: product.metaTitle,
        metaDescription: product.metaDescription,
        updatedAt: new Date(),
      })
      .where(eq(products.id, product.id))
      .returning();

    return this.mapToEntity(updated);
  }

  /**
   * Delete a product (soft delete)
   */
  async delete(productId: string): Promise<void> {
    await db
      .update(products)
      .set({ isActive: false })
      .where(eq(products.id, productId));
  }

  /**
   * Update product stock
   * @param productId - Product ID
   * Note: Stock is managed at variant level in this schema
   */
  async updateStock(productId: string): Promise<void> {
    // This is a simplified implementation - just updates the timestamp
    await db
      .update(products)
      .set({ updatedAt: new Date() })
      .where(eq(products.id, productId));
  }

  /**
   * Check if slug exists
   */
  async existsBySlug(slug: string): Promise<boolean> {
    const product = await db.query.products.findFirst({
      where: eq(products.slug, slug),
      columns: { id: true },
    });
    return !!product;
  }

  /**
   * Check if SKU exists
   */
  async existsBySKU(sku: string): Promise<boolean> {
    const product = await db.query.products.findFirst({
      where: eq(products.sku, sku),
      columns: { id: true },
    });
    return !!product;
  }

  /**
   * Toggle product active status
   */
  async toggleStatus(productId: string): Promise<ProductEntity> {
    const product = await this.findById(productId);
    if (!product) {
      throw new ProductNotFoundException(productId);
    }

    const [updated] = await db
      .update(products)
      .set({
        isActive: !product.isActive,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))
      .returning();

    return this.mapToEntity(updated);
  }

  /**
   * Get products count
   */
  async count(filters?: ProductFilters): Promise<number> {
    const conditions = this.buildFiltersConditions(filters);

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result[0]?.count || 0;
  }

  /**
   * Build filter conditions for queries
   */
  private buildFiltersConditions(filters?: ProductFilters) {
    const conditions = [];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(products.isActive, filters.isActive));
    }

    if (filters?.isFeatured !== undefined) {
      conditions.push(eq(products.isFeatured, filters.isFeatured));
    }

    if (filters?.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }

    if (filters?.minPrice !== undefined) {
      conditions.push(gte(products.basePrice, filters.minPrice.toString()));
    }

    if (filters?.maxPrice !== undefined) {
      conditions.push(lte(products.basePrice, filters.maxPrice.toString()));
    }

    return conditions;
  }

  /**
   * Map database result to ProductEntity
   */
  private mapToEntity(dbProduct: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    basePrice: string;
    salePrice: string | null;
    categoryId: string | null;
    isActive: boolean;
    isFeatured: boolean;
    createdAt: Date;
    updatedAt: Date;
    gender?: string | null;
    material?: string | null;
    careInstructions?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
    variants?: { stockQuantity: number | null }[];
    images?: { imageUrl: string }[];
  }): ProductEntity {
    // Calculate total stock from variants
    const totalStock =
      dbProduct.variants?.reduce((sum, v) => sum + (v.stockQuantity || 0), 0) ||
      0;

    // Extract image URLs
    const imageUrls = dbProduct.images?.map((img) => img.imageUrl) || [];

    return new ProductEntity(
      dbProduct.id,
      dbProduct.name,
      dbProduct.slug,
      dbProduct.description || "",
      parseFloat(dbProduct.basePrice),
      dbProduct.salePrice ? parseFloat(dbProduct.salePrice) : null,
      dbProduct.categoryId,
      totalStock,
      imageUrls,
      dbProduct.isActive,
      dbProduct.isFeatured,
      new Date(dbProduct.createdAt),
      new Date(dbProduct.updatedAt),
      // Product detail fields
      dbProduct.gender as "men" | "women" | "unisex" | "kids" | null,
      dbProduct.material ?? null,
      dbProduct.careInstructions ?? null,
      dbProduct.metaTitle ?? null,
      dbProduct.metaDescription ?? null
      // Note: createdBy and updatedBy would need to be added to schema
    );
  }
}
