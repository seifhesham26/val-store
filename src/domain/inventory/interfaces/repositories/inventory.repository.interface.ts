/**
 * Inventory Repository Interface
 */

import { InventoryLog, NewInventoryLog } from "@/db/schema";

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
  createLog(log: NewInventoryLog): Promise<InventoryLog>;
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
   * Unlocked, unconditional absolute write — no row lock, no audit log.
   * Nothing in the codebase calls this today. Do not use it for a
   * read-then-write stock change (read the level, decide a new one, write
   * it): that shape is exactly the race `adjustStockWithLog` exists to
   * close. Kept only as a low-level primitive.
   */
  updateVariantStock(variantId: string, newStock: number): Promise<void>;
  /** Unlocked read. See the warning on `updateVariantStock`. */
  getVariantStock(variantId: string): Promise<number | null>;
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
   * row is created.
   */
  adjustStockWithLog(
    variantId: string,
    newQuantity: number,
    log: Pick<NewInventoryLog, "changeType" | "reason" | "createdBy">
  ): Promise<{ previousQuantity: number; newQuantity: number } | null>;
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
