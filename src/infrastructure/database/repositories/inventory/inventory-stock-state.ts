import type { db } from "@/db";
import {
  inventoryInspections,
  inventoryAdjustmentRequests,
  productVariants,
  products,
} from "@/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  resolveInventoryAvailability,
  shouldOpenInspection,
  shouldCloseInspectionCycle,
  type InventoryAvailabilityState,
} from "@/domain/inventory/inventory-policy";
import type { VariantSellability } from "@/domain/inventory/inventory-operations";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Pick<typeof db, "select">;

export interface LockedVariantStockState {
  id: string;
  productId: string;
  sku: string;
  size: string | null;
  color: string | null;
  productName: string;
  stockQuantity: number;
  isAvailable: boolean;
  openInspectionId: string | null;
  pendingInspection: boolean;
  pendingFlaw: boolean;
  sellableStock: number;
  availabilityState: InventoryAvailabilityState;
}

// Explicit aliases keep SELECT projections correlated: Drizzle's single-table
// selection can strip qualifiers from embedded column objects inside SQL.
// Keep these predicates shared by locked commands and batched storefront reads.
function pendingPredicates() {
  return {
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
  };
}

function availability(row: {
  stockQuantity: number;
  isAvailable: boolean;
  pendingInspection: boolean;
  pendingFlaw: boolean;
}) {
  const result = resolveInventoryAvailability({
    stockQuantity: row.stockQuantity,
    isAvailable: row.isAvailable,
    hasPendingInspection: row.pendingInspection,
    hasPendingFlaw: row.pendingFlaw,
  });
  return {
    sellableStock: result.sellableStock,
    availabilityState: result.state,
  };
}

export async function readVariantSellability(
  executor: Executor,
  variantIds: string[]
): Promise<VariantSellability[]> {
  const ids = [...new Set(variantIds)];
  if (!ids.length) return [];
  const rows = await executor
    .select({
      variantId: productVariants.id,
      stockQuantity: productVariants.stockQuantity,
      isAvailable: productVariants.isAvailable,
      ...pendingPredicates(),
    })
    .from(productVariants)
    .where(inArray(productVariants.id, ids));
  return rows.map((row) => ({
    variantId: row.variantId,
    stockQuantity: row.stockQuantity,
    isAvailable: row.isAvailable,
    ...availability(row),
  }));
}

/** All inventory writers must acquire the variant lock before related reads. */
export async function lockVariantStockState(
  tx: Transaction,
  variantId: string
): Promise<LockedVariantStockState | null> {
  const [variant] = await tx
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      stockQuantity: productVariants.stockQuantity,
      isAvailable: productVariants.isAvailable,
    })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .for("update");
  if (!variant) return null;

  // A separate statement after acquiring the lock sees a previous writer's
  // committed inspection/request changes even if this transaction had to wait.
  const [state] = await tx
    .select({
      productName: products.name,
      openInspectionId: inventoryInspections.id,
      ...pendingPredicates(),
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(
      inventoryInspections,
      and(
        eq(inventoryInspections.variantId, productVariants.id),
        isNull(inventoryInspections.cycleEndedAt)
      )
    )
    .where(eq(productVariants.id, variantId));
  const snapshot = { ...variant, ...state };
  return { ...snapshot, ...availability(snapshot) };
}

export async function reconcileLowStockCycle(
  tx: Transaction,
  input: {
    variant: LockedVariantStockState;
    previousStock: number;
    stockQuantity: number;
  }
): Promise<void> {
  const { variant, previousStock, stockQuantity } = input;
  if (variant.openInspectionId && shouldCloseInspectionCycle(stockQuantity)) {
    await tx
      .update(inventoryInspections)
      .set({ cycleEndedAt: new Date() })
      .where(eq(inventoryInspections.id, variant.openInspectionId));
  } else if (
    shouldOpenInspection({
      previousStock,
      stockQuantity,
      hasOpenCycle: variant.openInspectionId !== null,
    })
  ) {
    await tx.insert(inventoryInspections).values({
      variantId: variant.id,
      productName: variant.productName,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      triggerStock: stockQuantity,
    });
  }
}
