/**
 * Drizzle Inventory Repository
 */

import { db } from "@/db";
import {
  inventoryLogs,
  productVariants,
  products,
  user,
  InventoryLog,
  NewInventoryLog,
} from "@/db/schema";
import { eq, desc, lte } from "drizzle-orm";
import {
  InventoryRepositoryInterface,
  InventoryLogWithDetails,
  VariantWithStock,
} from "@/domain/inventory/interfaces/repositories/inventory.repository.interface";

export class DrizzleInventoryRepository implements InventoryRepositoryInterface {
  async createLog(log: NewInventoryLog): Promise<InventoryLog> {
    const [result] = await db.insert(inventoryLogs).values(log).returning();
    return result;
  }

  async getLogsByVariant(
    variantId: string,
    limit = 50
  ): Promise<InventoryLogWithDetails[]> {
    const results = await db
      .select({
        id: inventoryLogs.id,
        variantId: inventoryLogs.variantId,
        changeType: inventoryLogs.changeType,
        quantityChange: inventoryLogs.quantityChange,
        previousQuantity: inventoryLogs.previousQuantity,
        newQuantity: inventoryLogs.newQuantity,
        reason: inventoryLogs.reason,
        createdBy: inventoryLogs.createdBy,
        createdAt: inventoryLogs.createdAt,
        variantSku: productVariants.sku,
        variantSize: productVariants.size,
        variantColor: productVariants.color,
        productName: products.name,
        createdByName: user.name,
      })
      .from(inventoryLogs)
      .leftJoin(
        productVariants,
        eq(inventoryLogs.variantId, productVariants.id)
      )
      .leftJoin(products, eq(productVariants.productId, products.id))
      .leftJoin(user, eq(inventoryLogs.createdBy, user.id))
      .where(eq(inventoryLogs.variantId, variantId))
      .orderBy(desc(inventoryLogs.createdAt))
      .limit(limit);

    return results;
  }

  async getLogsByProduct(
    productId: string,
    limit = 50
  ): Promise<InventoryLogWithDetails[]> {
    const results = await db
      .select({
        id: inventoryLogs.id,
        variantId: inventoryLogs.variantId,
        changeType: inventoryLogs.changeType,
        quantityChange: inventoryLogs.quantityChange,
        previousQuantity: inventoryLogs.previousQuantity,
        newQuantity: inventoryLogs.newQuantity,
        reason: inventoryLogs.reason,
        createdBy: inventoryLogs.createdBy,
        createdAt: inventoryLogs.createdAt,
        variantSku: productVariants.sku,
        variantSize: productVariants.size,
        variantColor: productVariants.color,
        productName: products.name,
        createdByName: user.name,
      })
      .from(inventoryLogs)
      .leftJoin(
        productVariants,
        eq(inventoryLogs.variantId, productVariants.id)
      )
      .leftJoin(products, eq(productVariants.productId, products.id))
      .leftJoin(user, eq(inventoryLogs.createdBy, user.id))
      .where(eq(productVariants.productId, productId))
      .orderBy(desc(inventoryLogs.createdAt))
      .limit(limit);

    return results;
  }

  async getAllLogs(
    limit = 100,
    offset = 0
  ): Promise<InventoryLogWithDetails[]> {
    const results = await db
      .select({
        id: inventoryLogs.id,
        variantId: inventoryLogs.variantId,
        changeType: inventoryLogs.changeType,
        quantityChange: inventoryLogs.quantityChange,
        previousQuantity: inventoryLogs.previousQuantity,
        newQuantity: inventoryLogs.newQuantity,
        reason: inventoryLogs.reason,
        createdBy: inventoryLogs.createdBy,
        createdAt: inventoryLogs.createdAt,
        variantSku: productVariants.sku,
        variantSize: productVariants.size,
        variantColor: productVariants.color,
        productName: products.name,
        createdByName: user.name,
      })
      .from(inventoryLogs)
      .leftJoin(
        productVariants,
        eq(inventoryLogs.variantId, productVariants.id)
      )
      .leftJoin(products, eq(productVariants.productId, products.id))
      .leftJoin(user, eq(inventoryLogs.createdBy, user.id))
      .orderBy(desc(inventoryLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  }

  async getLowStockVariants(threshold = 10): Promise<VariantWithStock[]> {
    const results = await db
      .select({
        variantId: productVariants.id,
        sku: productVariants.sku,
        size: productVariants.size,
        color: productVariants.color,
        stockQuantity: productVariants.stockQuantity,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
      })
      .from(productVariants)
      .leftJoin(products, eq(productVariants.productId, products.id))
      .where(lte(productVariants.stockQuantity, threshold))
      .orderBy(productVariants.stockQuantity);

    return results.map((r) => ({
      ...r,
      productId: r.productId!,
      productName: r.productName!,
      productSlug: r.productSlug!,
    }));
  }

  async getAllVariantsWithStock(): Promise<VariantWithStock[]> {
    const results = await db
      .select({
        variantId: productVariants.id,
        sku: productVariants.sku,
        size: productVariants.size,
        color: productVariants.color,
        stockQuantity: productVariants.stockQuantity,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
      })
      .from(productVariants)
      .leftJoin(products, eq(productVariants.productId, products.id))
      .orderBy(products.name, productVariants.sku);

    return results.map((r) => ({
      ...r,
      productId: r.productId!,
      productName: r.productName!,
      productSlug: r.productSlug!,
    }));
  }

  async updateVariantStock(variantId: string, newStock: number): Promise<void> {
    await db
      .update(productVariants)
      .set({
        stockQuantity: newStock,
        isAvailable: newStock > 0,
        updatedAt: new Date(),
      })
      .where(eq(productVariants.id, variantId));
  }

  async getVariantStock(variantId: string): Promise<number | null> {
    const result = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, variantId),
      columns: { stockQuantity: true },
    });
    return result?.stockQuantity ?? null;
  }
}
