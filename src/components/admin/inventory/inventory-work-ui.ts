import type {
  InventoryAdjustmentCategory,
  InventoryAdjustmentRequestRecord,
  InventoryAdjustmentStatus,
  InventoryInspectionRecord,
  InventoryInspectionStatus,
} from "@/domain/inventory/inventory-operations";
import type { InventoryWorkList } from "@/domain/inventory/interfaces/repositories/inventory-requests.repository.interface";

export type InventoryInspectionView = Omit<
  InventoryInspectionRecord,
  "createdAt" | "completedAt" | "cycleEndedAt"
> & {
  createdAt: Date | string;
  completedAt: Date | string | null;
  cycleEndedAt: Date | string | null;
};

export type InventoryAdjustmentRequestView = Omit<
  InventoryAdjustmentRequestRecord,
  "createdAt" | "reviewedAt"
> & {
  createdAt: Date | string;
  reviewedAt: Date | string | null;
};

export type InventoryWorkHistoryView =
  | { kind: "inspection"; inspection: InventoryInspectionView }
  | { kind: "request"; request: InventoryAdjustmentRequestView };

export type InventoryWorkListView = Omit<
  InventoryWorkList,
  "pendingInspections" | "pendingRequestGroups" | "history"
> & {
  pendingInspections: InventoryInspectionView[];
  pendingRequestGroups: {
    variantId: string | null;
    sku: string;
    productName: string;
    requests: InventoryAdjustmentRequestView[];
  }[];
  history: InventoryWorkHistoryView[];
};

export function getInventoryCategoryLabel(
  category: InventoryAdjustmentCategory
): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function getInventoryInspectionLabel(
  status: InventoryInspectionStatus
): string {
  switch (status) {
    case "pending":
      return "Inspection pending";
    case "all_fine":
      return "Checked - all fine";
    case "flaw_reported":
      return "Flaw reported";
  }
}

export function requiresDecisionExplanation(input: {
  decision: Exclude<InventoryAdjustmentStatus, "pending">;
  requestedQuantity: number;
  approvedQuantity: number | null;
}): boolean {
  return (
    input.decision === "rejected" ||
    input.approvedQuantity !== input.requestedQuantity
  );
}
