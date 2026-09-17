import { isAdminRole } from "@/domain/customers/value-objects/user-role";
import type {
  InventoryAdjustmentRequestRecord,
  ReviewAdjustmentRequestCommand,
} from "@/domain/inventory/inventory-operations";
import type {
  InventoryRequestsRepositoryInterface,
  InventoryWorkResult,
} from "@/domain/inventory/interfaces/repositories/inventory-requests.repository.interface";
import type { InventoryWorkActor } from "./submit-adjustment-request.use-case";

export type ReviewAdjustmentRequestInput = Omit<
  ReviewAdjustmentRequestCommand,
  "reviewer"
> & { actor: InventoryWorkActor };

export class ReviewAdjustmentRequestUseCase {
  constructor(
    private readonly repository: InventoryRequestsRepositoryInterface
  ) {}

  async execute(
    input: ReviewAdjustmentRequestInput
  ): Promise<
    InventoryWorkResult<{ request: InventoryAdjustmentRequestRecord }>
  > {
    if (!isAdminRole(input.actor.role))
      return { success: false, error: "forbidden" };
    if (!["approved", "rejected"].includes(input.decision))
      return { success: false, error: "invalid_decision" };
    if (
      input.approvedQuantity != null &&
      (!Number.isSafeInteger(input.approvedQuantity) ||
        input.approvedQuantity <= 0)
    )
      return { success: false, error: "invalid_quantity" };
    const decisionExplanation = input.decisionExplanation?.trim() || null;
    if (decisionExplanation && decisionExplanation.length > 500)
      return { success: false, error: "invalid_explanation" };
    if (input.decision === "rejected" && !decisionExplanation)
      return { success: false, error: "decision_explanation_required" };
    const { actor, ...command } = input;
    // Correction validation depends on the original quantity. The repository
    // compares it under lock, in the same transaction as the decision.
    return this.repository.review({
      ...command,
      decisionExplanation,
      reviewer: { id: actor.id, name: actor.name },
    });
  }
}
