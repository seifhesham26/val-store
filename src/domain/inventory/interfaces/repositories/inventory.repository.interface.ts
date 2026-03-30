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
  getAllVariantsWithStock(): Promise<VariantWithStock[]>;
  updateVariantStock(variantId: string, newStock: number): Promise<void>;
  getVariantStock(variantId: string): Promise<number | null>;
}
