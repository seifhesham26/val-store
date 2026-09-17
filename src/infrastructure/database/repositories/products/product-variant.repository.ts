/**
 * ProductVariant Repository Implementation
 *
 * Implements ProductVariantRepositoryInterface using Drizzle ORM.
 */

import { db } from "@/db";
import {
  inventoryAdjustmentRequests,
  inventoryInspections,
  productVariants,
} from "@/db/schema";
import { eq, and, sql, gt, inArray, type SQL } from "drizzle-orm";
import {
  ProductVariantRepositoryInterface,
  SellableProductVariant,
  VariantFilter,
} from "@/domain/products/interfaces/repositories/product-variant.repository.interface";
import { ProductVariantEntity } from "@/domain/products/entities/product-variant.entity";
import { resolveInventoryAvailability } from "@/domain/inventory/inventory-policy";
import {
  lockVariantStockState,
  reconcileLowStockCycle,
} from "@/infrastructure/database/repositories/inventory/inventory-stock-state";

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
  async findByIds(variantIds: string[]): Promise<ProductVariantEntity[]> {
    if (variantIds.length === 0) return [];

    const variants = await db.query.productVariants.findMany({
      where: inArray(productVariants.id, variantIds),
    });

    return variants.map((v) => this.mapToEntity(v));
  }

  async findByProducts(
    productIds: string[]
  ): Promise<Map<string, ProductVariantEntity[]>> {
    const result = new Map<string, ProductVariantEntity[]>();
    if (productIds.length === 0) return result;

    const variants = await db.query.productVariants.findMany({
      where: inArray(productVariants.productId, productIds),
    });

    for (const variant of variants) {
      const list = result.get(variant.productId) ?? [];
      list.push(this.mapToEntity(variant));
      result.set(variant.productId, list);
    }

    return result;
  }

  async findSellableByIds(
    variantIds: string[]
  ): Promise<SellableProductVariant[]> {
    if (variantIds.length === 0) return [];
    return this.findSellable(inArray(productVariants.id, variantIds));
  }

  async findSellableByProduct(
    productId: string
  ): Promise<SellableProductVariant[]> {
    return this.findSellable(eq(productVariants.productId, productId));
  }

  async findSellableByProducts(
    productIds: string[]
  ): Promise<Map<string, SellableProductVariant[]>> {
    const result = new Map<string, SellableProductVariant[]>();
    if (productIds.length === 0) return result;

    const variants = await this.findSellable(
      inArray(productVariants.productId, productIds)
    );
    for (const sellable of variants) {
      const list = result.get(sellable.variant.productId) ?? [];
      list.push(sellable);
      result.set(sellable.variant.productId, list);
    }
    return result;
  }

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
    return db.transaction(async (tx) => {
      const [newVariant] = await tx
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

      const locked = await lockVariantStockState(tx, newVariant.id);
      if (!locked)
        throw new Error(`Variant with ID "${newVariant.id}" not found`);
      await reconcileLowStockCycle(tx, {
        variant: locked,
        previousStock: 0,
        stockQuantity: newVariant.stockQuantity,
      });

      return this.mapToEntity(newVariant);
    });
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

  private async findSellable(
    where: SQL<unknown>
  ): Promise<SellableProductVariant[]> {
    const rows = await db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        sku: productVariants.sku,
        size: productVariants.size,
        color: productVariants.color,
        stockQuantity: productVariants.stockQuantity,
        priceAdjustment: productVariants.priceAdjustment,
        isAvailable: productVariants.isAvailable,
        createdAt: productVariants.createdAt,
        updatedAt: productVariants.updatedAt,
        pendingInspection: sql<boolean>`exists (
          select 1 from ${inventoryInspections} as inspection
          where inspection.variant_id = product_variants.id
            and inspection.cycle_ended_at is null
            and inspection.status = 'pending'
        )`,
        pendingFlaw: sql<boolean>`exists (
          select 1 from ${inventoryAdjustmentRequests} as request
          where request.variant_id = product_variants.id
            and request.status = 'pending'
            and request.category in ('damaged', 'missing')
        )`,
      })
      .from(productVariants)
      .where(where);

    return rows.map((row) => {
      const availability = resolveInventoryAvailability({
        stockQuantity: row.stockQuantity,
        isAvailable: row.isAvailable,
        hasPendingInspection: row.pendingInspection,
        hasPendingFlaw: row.pendingFlaw,
      });
      return {
        variant: this.mapToEntity(row),
        sellableStock: availability.sellableStock,
        availabilityState: availability.state,
      };
    });
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
