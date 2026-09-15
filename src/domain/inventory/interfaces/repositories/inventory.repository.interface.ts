/**
 * Inventory Repository Interface
 */

import type { VariantSellability } from "@/domain/inventory/inventory-operations";

export type InventoryChangeType =
  | "restock"
  | "sale"
  | "adjustment"
  | "damaged"
  | "return";

export interface InventoryLog {
  id: string;
  variantId: string;
  changeType: InventoryChangeType;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface InventoryLogInput {
  variantId: string;
  changeType: InventoryChangeType;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string | null;
  createdBy?: string | null;
}

export interface StockAdjustmentResult {
  previousQuantity: number;
  newQuantity: number;
  /** Effective sellable quantity or availability state changed. */
  sellabilityChanged: boolean;
  /** Validation failure: quantities are unchanged and nothing was written. */
  error?: "Stock cannot be negative" | "Stock must be a whole number";
}

export interface InventoryLogWithDetails extends InventoryLog {
  variantSku: string | null;
  variantSize: string | null;
  variantColor: string | null;
  productName: string | null;
  createdByName: string | null;
}

export interface VariantWithStock {
  variantId: string;
  sku: string;
  size: string | null;
  color: string | null;
  stockQuantity: number;
  productId: string;
  productName: string;
  productSlug: string;
}

export interface InventoryRepositoryInterface {
  getVariantSellability(variantIds: string[]): Promise<VariantSellability[]>;
  createLog(log: InventoryLogInput): Promise<InventoryLog>;
  getLogsByVariant(
    variantId: string,
    limit?: number
  ): Promise<InventoryLogWithDetails[]>;
  getLogsByProduct(
    productId: string,
    limit?: number
  ): Promise<InventoryLogWithDetails[]>;
  getAllLogs(
    limit?: number,
    offset?: number
  ): Promise<InventoryLogWithDetails[]>;
  getLowStockVariants(threshold?: number): Promise<VariantWithStock[]>;
  /**
   * Every variant with its current stock, for the admin's unpaginated
   * inventory table. `limit` defaults to a bounded ceiling rather than
   * returning every row — the table has no pagination or virtualisation, so
   * an unbounded result grows with the catalogue forever.
   */
  getAllVariantsWithStock(limit?: number): Promise<VariantWithStock[]>;
  /**
   * How many variants exist in total.
   *
   * Pairs with `getAllVariantsWithStock` so a caller can tell the admin that
   * the table is showing the first N of M. Without it the cap truncates
   * silently, which on this screen means stock that simply is not there to
   * see or edit — a worse failure than a slow page.
   */
  countAllVariants(): Promise<number>;
  /**
   * Atomically sets a variant's stock to an absolute quantity and writes
   * the matching `inventory_logs` row in one transaction, with the variant
   * row locked `FOR UPDATE` before either write.
   *
   * The lock is what makes `previousQuantity` on the result (and on the
   * logged row) truthful: it is the value this call actually overwrote, not
   * a value read moments earlier that a concurrent checkout or another
   * adjustment already changed underneath an unlocked read. Locking first
   * also serialises this write against the checkout's own `FOR UPDATE`
   * stock reservation instead of racing it.
   *
   * Returns null if the variant does not exist — nothing is written, no log
   * row is created. Invalid quantities return the locked current quantity
   * and an error. Successful writes preserve manual availability and
   * reconcile the low-stock inspection cycle in the same transaction.
   */
  adjustStockWithLog(
    variantId: string,
    newQuantity: number,
    log: Pick<InventoryLogInput, "changeType" | "reason" | "createdBy">
  ): Promise<StockAdjustmentResult | null>;
  /**
   * Stock and SKU for several variants at once.
   *
   * Used by the low-stock notifier, which needs a human-readable SKU to say
   * what ran low and would otherwise query per variant.
   */
  getVariantsStock(
    variantIds: string[]
  ): Promise<{ id: string; sku: string; stockQuantity: number }[]>;
}
