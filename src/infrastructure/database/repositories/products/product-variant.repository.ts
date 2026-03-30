/**
 * ProductVariant Repository Implementation
 *
 * Implements ProductVariantRepositoryInterface using Drizzle ORM.
 */

import { db } from "@/db";
import { productVariants } from "@/db/schema";
import { eq, and, sql, gt } from "drizzle-orm";
import {
  ProductVariantRepositoryInterface,
  VariantFilter,
} from "@/domain/products/interfaces/repositories/product-variant.repository.interface";
import { ProductVariantEntity } from "@/domain/products/entities/product-variant.entity";

export class DrizzleProductVariantRepository implements ProductVariantRepositoryInterface {
  /**
   * Find variant by ID
   */
  async findById(variantId: string): Promise<ProductVariantEntity | null> {
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, variantId),
    });

    if (!variant) return null;
    return this.mapToEntity(variant);
  }

  /**
   * Find variant by SKU
   */
  async findBySku(sku: string): Promise<ProductVariantEntity | null> {
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.sku, sku),
    });

    if (!variant) return null;
    return this.mapToEntity(variant);
  }

  /**
   * Find all variants for a product
   */
  async findByProduct(productId: string): Promise<ProductVariantEntity[]> {
    const variants = await db.query.productVariants.findMany({
      where: eq(productVariants.productId, productId),
    });

    return variants.map((v) => this.mapToEntity(v));
  }

  /**
   * Find variants with filters
   */
  async findMany(filter: VariantFilter): Promise<ProductVariantEntity[]> {
    const conditions = [];

    if (filter.productId) {
      conditions.push(eq(productVariants.productId, filter.productId));
    }
    if (filter.size) {
      conditions.push(eq(productVariants.size, filter.size));
    }
    if (filter.color) {
      conditions.push(eq(productVariants.color, filter.color));
    }
    if (filter.isAvailable !== undefined) {
      conditions.push(eq(productVariants.isAvailable, filter.isAvailable));
    }
    if (filter.inStock) {
      conditions.push(gt(productVariants.stockQuantity, 0));
    }

    const variants = await db.query.productVariants.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
    });

    return variants.map((v) => this.mapToEntity(v));
  }

  /**
   * Find available variants for a product
   */
  async findAvailableByProduct(
    productId: string
  ): Promise<ProductVariantEntity[]> {
    const variants = await db.query.productVariants.findMany({
      where: and(
        eq(productVariants.productId, productId),
        eq(productVariants.isAvailable, true),
        gt(productVariants.stockQuantity, 0)
      ),
    });

    return variants.map((v) => this.mapToEntity(v));
  }

  /**
   * Create a new variant
   */
  async create(variant: ProductVariantEntity): Promise<ProductVariantEntity> {
    const [newVariant] = await db
      .insert(productVariants)
      .values({
        productId: variant.productId,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        stockQuantity: variant.stockQuantity,
        priceAdjustment: variant.priceAdjustment.toString(),
        isAvailable: variant.isAvailable,
      })
      .returning();

    return this.mapToEntity(newVariant);
  }

  /**
   * Update an existing variant
   */
  async update(variant: ProductVariantEntity): Promise<ProductVariantEntity> {
    const [updated] = await db
      .update(productVariants)
      .set({
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        stockQuantity: variant.stockQuantity,
        priceAdjustment: variant.priceAdjustment.toString(),
        isAvailable: variant.isAvailable,
        updatedAt: new Date(),
      })
      .where(eq(productVariants.id, variant.id))
      .returning();

    return this.mapToEntity(updated);
  }

  /**
   * Update stock quantity to an absolute value
   */
  async updateStock(
    variantId: string,
    quantity: number
  ): Promise<ProductVariantEntity> {
    const [updated] = await db
      .update(productVariants)
      .set({
        stockQuantity: quantity,
        updatedAt: new Date(),
      })
      .where(eq(productVariants.id, variantId))
      .returning();

    return this.mapToEntity(updated);
  }

  /**
   * Adjust stock by delta
   */
  async adjustStock(
    variantId: string,
    delta: number
  ): Promise<ProductVariantEntity> {
    const [updated] = await db
      .update(productVariants)
      .set({
        stockQuantity: sql`GREATEST(0, ${productVariants.stockQuantity} + ${delta})`,
        updatedAt: new Date(),
      })
      .where(eq(productVariants.id, variantId))
      .returning();

    return this.mapToEntity(updated);
  }

  /**
   * Delete a variant
   */
  async delete(variantId: string): Promise<void> {
    await db.delete(productVariants).where(eq(productVariants.id, variantId));
  }

  /**
   * Delete all variants for a product
   */
  async deleteByProduct(productId: string): Promise<void> {
    await db
      .delete(productVariants)
      .where(eq(productVariants.productId, productId));
  }

  /**
   * Check if SKU exists
   */
  async existsBySku(sku: string): Promise<boolean> {
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.sku, sku),
      columns: { id: true },
    });
    return !!variant;
  }

  /**
   * Get total stock for a product
   */
  async getTotalStockByProduct(productId: string): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(${productVariants.stockQuantity}), 0)`,
      })
      .from(productVariants)
      .where(eq(productVariants.productId, productId));

    return Number(result[0]?.total ?? 0);
  }

  /**
   * Map database result to entity
   */
  private mapToEntity(dbVariant: {
    id: string;
    productId: string;
    sku: string;
    size: string | null;
    color: string | null;
    stockQuantity: number;
    priceAdjustment: string | null;
    isAvailable: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ProductVariantEntity {
    return new ProductVariantEntity(
      dbVariant.id,
      dbVariant.productId,
      dbVariant.sku,
      dbVariant.size,
      dbVariant.color,
      dbVariant.stockQuantity,
      parseFloat(dbVariant.priceAdjustment ?? "0"),
      dbVariant.isAvailable,
      new Date(dbVariant.createdAt),
      new Date(dbVariant.updatedAt)
    );
  }
}
