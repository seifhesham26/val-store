import type {
  CreateAdjustmentRequestCommand,
  InventoryAdjustmentRequestRecord,
  InventoryCommandActor,
  InventoryInspectionRecord,
  ReviewAdjustmentRequestCommand,
} from "../../inventory-operations";

export type InventoryWorkError =
  | "forbidden"
  | "not_found"
  | "variant_deleted"
  | "variant_unavailable"
  | "conflict"
  | "invalid_category"
  | "invalid_quantity"
  | "invalid_explanation"
  | "invalid_decision"
  | "decision_explanation_required"
  | "insufficient_stock";

export type InventoryWorkResult<T> =
  | ({ success: true } & T)
  | { success: false; error: InventoryWorkError };

export type InventoryWorkHistoryItem =
  | { kind: "inspection"; inspection: InventoryInspectionRecord }
  | { kind: "request"; request: InventoryAdjustmentRequestRecord };

export interface InventoryWorkList {
  pendingInspections: InventoryInspectionRecord[];
  pendingRequestGroups: {
    variantId: string | null;
    sku: string;
    productName: string;
    requests: InventoryAdjustmentRequestRecord[];
  }[];
  history: InventoryWorkHistoryItem[];
}

/** Commands serialize on the variant before reading or updating work rows.
 * Expected conflicts return a result; persistence failures throw and roll back.
 */
export interface InventoryRequestsRepositoryInterface {
  submit(
    command: CreateAdjustmentRequestCommand
  ): Promise<
    InventoryWorkResult<{ request: InventoryAdjustmentRequestRecord }>
  >;
  completeAllFine(command: {
    inspectionId: string;
    worker: InventoryCommandActor;
  }): Promise<InventoryWorkResult<{ inspection: InventoryInspectionRecord }>>;
  /** Omitted approval quantity means the immutable requested quantity. A
   * correction requires a reason, checked against the locked original.
   */
  review(
    command: ReviewAdjustmentRequestCommand
  ): Promise<
    InventoryWorkResult<{ request: InventoryAdjustmentRequestRecord }>
  >;
  listWork(): Promise<InventoryWorkList>;
  /** Work items, not distinct variants; ended inspection cycles are excluded. */
  countPending(): Promise<number>;
}
