import type { InventoryAvailabilityState } from "./inventory-policy";

export type InventoryAdjustmentCategory = "damaged" | "missing" | "extra";
export type InventoryAdjustmentStatus = "pending" | "approved" | "rejected";
export type InventoryInspectionStatus =
  | "pending"
  | "all_fine"
  | "flaw_reported";

export interface InventoryActorSnapshot {
  id: string | null;
  name: string;
}

export interface InventoryCommandActor {
  id: string;
  name: string;
}

export interface InventoryInspectionRecord {
  id: string;
  variantId: string | null;
  productName: string;
  sku: string;
  size: string | null;
  color: string | null;
  triggerStock: number;
  status: InventoryInspectionStatus;
  completedBy: InventoryActorSnapshot | null;
  completedAt: Date | null;
  adjustmentRequestId: string | null;
  cycleEndedAt: Date | null;
  createdAt: Date;
}

export interface InventoryAdjustmentRequestRecord {
  id: string;
  variantId: string | null;
  inspectionId: string | null;
  productName: string;
  sku: string;
  size: string | null;
  color: string | null;
  requester: InventoryActorSnapshot | null;
  category: InventoryAdjustmentCategory;
  requestedQuantity: number;
  explanation: string;
  stockAtRequest: number;
  status: InventoryAdjustmentStatus;
  approvedQuantity: number | null;
  reviewer: InventoryActorSnapshot | null;
  decisionExplanation: string | null;
  reviewedAt: Date | null;
  inventoryLogId: string | null;
  createdAt: Date;
}

export interface VariantSellability {
  variantId: string;
  stockQuantity: number;
  isAvailable: boolean;
  sellableStock: number;
  availabilityState: InventoryAvailabilityState;
}

export interface CreateAdjustmentRequestCommand {
  variantId: string;
  inspectionId?: string | null;
  requester: InventoryCommandActor;
  category: InventoryAdjustmentCategory;
  requestedQuantity: number;
  explanation: string;
}

export interface ReviewAdjustmentRequestCommand {
  requestId: string;
  reviewer: InventoryCommandActor;
  decision: Exclude<InventoryAdjustmentStatus, "pending">;
  approvedQuantity?: number | null;
  decisionExplanation?: string | null;
}
