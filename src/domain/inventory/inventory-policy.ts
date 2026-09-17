export const INSPECTION_TRIGGER_STOCK = 20;
export const INSPECTION_PROTECTED_STOCK = 10;

export type InventoryAvailabilityState =
  | "available"
  | "out_of_stock"
  | "manually_unavailable"
  | "inspection_pending"
  | "quarantined";

export function resolveInventoryAvailability(input: {
  stockQuantity: number;
  isAvailable: boolean;
  hasPendingInspection: boolean;
  hasPendingFlaw: boolean;
}): { sellableStock: number; state: InventoryAvailabilityState } {
  if (input.hasPendingFlaw) return { sellableStock: 0, state: "quarantined" };
  if (!input.isAvailable) {
    return { sellableStock: 0, state: "manually_unavailable" };
  }
  if (input.stockQuantity <= 0) {
    return { sellableStock: 0, state: "out_of_stock" };
  }
  if (input.hasPendingInspection) {
    return {
      sellableStock: Math.max(
        0,
        input.stockQuantity - INSPECTION_PROTECTED_STOCK
      ),
      state: "inspection_pending",
    };
  }
  return { sellableStock: input.stockQuantity, state: "available" };
}

export function shouldOpenInspection(input: {
  previousStock: number;
  stockQuantity: number;
  hasOpenCycle: boolean;
}): boolean {
  return (
    !input.hasOpenCycle &&
    input.stockQuantity > 0 &&
    input.stockQuantity <= INSPECTION_TRIGGER_STOCK &&
    (input.previousStock <= 0 || input.previousStock > INSPECTION_TRIGGER_STOCK)
  );
}

export function shouldCloseInspectionCycle(stockQuantity: number): boolean {
  return stockQuantity <= 0 || stockQuantity > INSPECTION_TRIGGER_STOCK;
}
