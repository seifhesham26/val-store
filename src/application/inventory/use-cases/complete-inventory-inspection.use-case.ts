import type {
  InventoryRequestsRepositoryInterface,
  InventoryWorkResult,
} from "@/domain/inventory/interfaces/repositories/inventory-requests.repository.interface";
import type { InventoryInspectionRecord } from "@/domain/inventory/inventory-operations";
import type { InventoryWorkActor } from "./submit-adjustment-request.use-case";

export class CompleteInventoryInspectionUseCase {
  constructor(
    private readonly repository: InventoryRequestsRepositoryInterface
  ) {}

  async execute(input: {
    inspectionId: string;
    actor: InventoryWorkActor;
  }): Promise<InventoryWorkResult<{ inspection: InventoryInspectionRecord }>> {
    if (input.actor.role !== "worker")
      return { success: false, error: "forbidden" };
    return this.repository.completeAllFine({
      inspectionId: input.inspectionId,
      worker: { id: input.actor.id, name: input.actor.name },
    });
  }
}
