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
import { eq, desc, lte, inArray } from "drizzle-orm";
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

  async getAllVariantsWithStock(limit = 500): Promise<VariantWithStock[]> {
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

  // Unlocked primitive — see the interface doc. `AdjustStockUseCase` used to
  // pair this with `getVariantStock` as a read-then-write with nothing
  // between them, which is exactly the lost-update race `adjustStockWithLog`
  // below now closes. Nothing calls this method any more; kept as a
  // low-level building block, not a safe default.
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

  async adjustStockWithLog(
    variantId: string,
    newQuantity: number,
    log: Pick<NewInventoryLog, "changeType" | "reason" | "createdBy">
  ): Promise<{ previousQuantity: number; newQuantity: number } | null> {
    return db.transaction(async (tx) => {
      // Lock the row before reading it. The read's result is what makes
      // `previousQuantity` (and the logged row) truthful — without the lock,
      // this is the same unguarded read-then-write `AdjustStockUseCase` used
      // to do, just moved one layer down. Locking also serialises this
      // absolute set against the checkout's own `FOR UPDATE` stock
      // reservation (`order.repository.ts`) instead of racing it.
      const [variant] = await tx
        .select({ stockQuantity: productVariants.stockQuantity })
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .for("update")
        .limit(1);

      if (!variant) return null;

      const previousQuantity = variant.stockQuantity;

      await tx
        .update(productVariants)
        .set({
          stockQuantity: newQuantity,
          isAvailable: newQuantity > 0,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, variantId));

      // Same transaction as the stock write, so a failure between "set the
      // number" and "log the movement" cannot happen — the whole point of
      // an audit trail is that it cannot silently fall out of step with the
      // thing it is auditing.
      await tx.insert(inventoryLogs).values({
        variantId,
        changeType: log.changeType,
        quantityChange: newQuantity - previousQuantity,
        previousQuantity,
        newQuantity,
        reason: log.reason,
        createdBy: log.createdBy,
      });

      return { previousQuantity, newQuantity };
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
