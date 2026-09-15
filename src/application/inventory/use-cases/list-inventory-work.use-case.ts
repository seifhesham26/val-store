import { isAdminAreaRole } from "@/domain/customers/value-objects/user-role";
import type {
  InventoryRequestsRepositoryInterface,
  InventoryWorkList,
  InventoryWorkResult,
} from "@/domain/inventory/interfaces/repositories/inventory-requests.repository.interface";
import type { InventoryWorkActor } from "./submit-adjustment-request.use-case";

export class ListInventoryWorkUseCase {
  constructor(
    private readonly repository: InventoryRequestsRepositoryInterface
  ) {}

  async execute(input: {
    actor: InventoryWorkActor;
  }): Promise<InventoryWorkResult<{ work: InventoryWorkList }>> {
    if (!isAdminAreaRole(input.actor.role))
      return { success: false, error: "forbidden" };
    return { success: true, work: await this.repository.listWork() };
  }
}
