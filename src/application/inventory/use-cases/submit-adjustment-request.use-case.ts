import type { UserRole } from "@/domain/customers/value-objects/user-role";
import type { CreateAdjustmentRequestCommand } from "@/domain/inventory/inventory-operations";
import type {
  InventoryRequestsRepositoryInterface,
  InventoryWorkResult,
} from "@/domain/inventory/interfaces/repositories/inventory-requests.repository.interface";
import type { InventoryAdjustmentRequestRecord } from "@/domain/inventory/inventory-operations";
import type { NotificationService } from "@/application/notifications/notification.service";

export interface InventoryWorkActor {
  id: string;
  name: string;
  role: UserRole;
}
export type SubmitAdjustmentRequestInput = Omit<
  CreateAdjustmentRequestCommand,
  "requester"
> & { actor: InventoryWorkActor };

export class SubmitAdjustmentRequestUseCase {
  constructor(
    private readonly repository: InventoryRequestsRepositoryInterface,
    private readonly notifications: Pick<
      NotificationService,
      "inventoryAdjustmentRequested"
    >
  ) {}

  async execute(
    input: SubmitAdjustmentRequestInput
  ): Promise<
    InventoryWorkResult<{ request: InventoryAdjustmentRequestRecord }>
  > {
    if (input.actor.role !== "worker")
      return { success: false, error: "forbidden" };
    const explanation = input.explanation.trim();
    if (!explanation || explanation.length > 500)
      return { success: false, error: "invalid_explanation" };
    if (
      !Number.isSafeInteger(input.requestedQuantity) ||
      input.requestedQuantity <= 0
    )
      return { success: false, error: "invalid_quantity" };
    if (!["damaged", "missing", "extra"].includes(input.category))
      return { success: false, error: "invalid_category" };
    const { actor, ...command } = input;
    const result = await this.repository.submit({
      ...command,
      explanation,
      requester: { id: actor.id, name: actor.name },
    });
    if (result.success) {
      const request = result.request;
      try {
        await this.notifications.inventoryAdjustmentRequested({
          requestId: request.id,
          sku: request.sku,
          category: request.category,
          quantity: request.requestedQuantity,
        });
      } catch (error) {
        // Keep the saved command successful even with a replacement notifier
        // that does not implement NotificationService's non-fatal contract.
        console.error(
          "[Notifications] inventoryAdjustmentRequested failed:",
          error
        );
      }
    }
    return result;
  }
}
