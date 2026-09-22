import type {
  ReturnPackageEventKind,
  ReturnRequestRepositoryInterface,
} from "@/domain/refunds/interfaces/return-request.repository.interface";
import type { RefundActor } from "../refund-actor";

export class RecordPackageEventUseCase {
  constructor(private readonly returns: ReturnRequestRepositoryInterface) {}
  async execute(input: {
    actor: { id: string; role: "customer" } | RefundActor;
    requestId: string;
    event: {
      kind: ReturnPackageEventKind;
      packageCount: number;
      itemCount?: number;
      sealIntact?: boolean;
      note?: string;
      correctionOfId?: string;
    };
  }) {
    if (input.actor.role === "customer") {
      if (input.event.kind !== "customer_declaration") {
        throw new Error("Customers may record only their package declaration");
      }
      const owned = await this.returns.findForCustomer(
        input.requestId,
        input.actor.id
      );
      if (!owned) throw new Error("Return request not found");
    }
    await this.returns.recordPackageEvent({
      requestId: input.requestId,
      recordedBy: input.actor.id,
      ...input.event,
    });
  }
}
