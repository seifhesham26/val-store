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
} from "@/db/schema";
import { eq, desc, lte, inArray, sql } from "drizzle-orm";
import {
  InventoryRepositoryInterface,
  InventoryLogWithDetails,
  VariantWithStock,
  InventoryLogInput,
  StockAdjustmentResult,
} from "@/domain/inventory/interfaces/repositories/inventory.repository.interface";

import {
  lockVariantStockState,
  readVariantSellability,
  reconcileLowStockCycle,
} from "./inventory-stock-state";

/**
 * Ceiling on the admin inventory table, which has no pagination or
 * virtualisation. Exported so the router can report it alongside the true
 * total — a cap the screen cannot see is a cap that hides stock.
 */
export const DEFAULT_ADMIN_VARIANT_LIMIT = 500;

export class DrizzleInventoryRepository implements InventoryRepositoryInterface {
  async createLog(log: InventoryLogInput): Promise<InventoryLog> {
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
      // Every row an order's checkout writes for a multi-item order shares
      // one `createdAt` (see `getAllLogs`), so `id` breaks ties for a
      // deterministic "latest N" even though this call takes no offset.
      .orderBy(desc(inventoryLogs.createdAt), desc(inventoryLogs.id))
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
      .orderBy(desc(inventoryLogs.createdAt), desc(inventoryLogs.id))
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
      // `createdAt` alone is not a total order: the order transaction
      // writes one log row per item, all sharing the same timestamp, so a
      // multi-item order produces a block of tied rows. Without the `id`
      // tiebreaker, `offset`-based paging over that block can show the same
      // row twice on two pages while silently skipping another — matching
      // the fix already applied to orders (`order.repository.ts`).
      .orderBy(desc(inventoryLogs.createdAt), desc(inventoryLogs.id))
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
        isAvailable: productVariants.isAvailable,
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

  async getAllVariantsWithStock(
    limit = DEFAULT_ADMIN_VARIANT_LIMIT
  ): Promise<VariantWithStock[]> {
    // The admin inventory table renders this with no pagination or
    // virtualisation, so an unbounded `findAll`-style query grows with the
    // catalogue forever. 500 comfortably covers the current ~36-product
    // catalogue's variant count with headroom; a caller that genuinely needs
    // more can still pass a larger limit explicitly.
    const results = await db
      .select({
        variantId: productVariants.id,
        sku: productVariants.sku,
        size: productVariants.size,
        color: productVariants.color,
        stockQuantity: productVariants.stockQuantity,
        isAvailable: productVariants.isAvailable,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
      })
      .from(productVariants)
      .leftJoin(products, eq(productVariants.productId, products.id))
      .orderBy(products.name, productVariants.sku)
      .limit(limit);

    return results.map((r) => ({
      ...r,
      productId: r.productId!,
      productName: r.productName!,
      productSlug: r.productSlug!,
    }));
  }

  async countAllVariants(): Promise<number> {
    // `count(*)::int` rather than `sql<number>count(*)`: postgres.js decodes a
    // Postgres bigint as a string, so the unadorned form is a compile-time
    // assertion the runtime does not honour. See CLAUDE.md.
    const [row] = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(productVariants);

    return row?.total ?? 0;
  }

  async getVariantSellability(variantIds: string[]) {
    return readVariantSellability(db, variantIds);
  }

  async adjustStockWithLog(
    variantId: string,
    newQuantity: number,
    log: Pick<InventoryLogInput, "changeType" | "reason" | "createdBy">
  ): Promise<StockAdjustmentResult | null> {
    return db.transaction(async (tx) => {
      const variant = await lockVariantStockState(tx, variantId);
      if (!variant) return null;
      const previousQuantity = variant.stockQuantity;
      if (newQuantity < 0 || !Number.isInteger(newQuantity)) {
        return {
          previousQuantity,
          newQuantity: previousQuantity,
          sellabilityChanged: false,
          error:
            newQuantity < 0
              ? "Stock cannot be negative"
              : "Stock must be a whole number",
        };
      }

      await tx
        .update(productVariants)
        .set({
          stockQuantity: newQuantity,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, variantId));

      await tx.insert(inventoryLogs).values({
        variantId,
        changeType: log.changeType,
        quantityChange: newQuantity - previousQuantity,
        previousQuantity,
        newQuantity,
        reason: log.reason,
        createdBy: log.createdBy,
      });
      await reconcileLowStockCycle(tx, {
        variant,
        previousStock: previousQuantity,
        stockQuantity: newQuantity,
      });
      const [after] = await readVariantSellability(tx, [variantId]);
      return {
        previousQuantity,
        newQuantity,
        sellabilityChanged:
          variant.sellableStock !== after.sellableStock ||
          variant.availabilityState !== after.availabilityState,
      };
    });
  }

  async getVariantsStock(
    variantIds: string[]
  ): Promise<{ id: string; sku: string; stockQuantity: number }[]> {
    const ids = [...new Set(variantIds)];
    if (ids.length === 0) return [];

    return db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        stockQuantity: productVariants.stockQuantity,
      })
      .from(productVariants)
      .where(inArray(productVariants.id, ids));
  }
}
