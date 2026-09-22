import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import { requireRefundDecisionRole, type RefundActor } from "../refund-actor";

export class OpenCarrierClaimUseCase {
  constructor(private readonly returns: ReturnRequestRepositoryInterface) {}
  async execute(input: {
    actor: RefundActor;
    requestId: string;
    missingQuantity: number;
  }) {
    requireRefundDecisionRole(input.actor);
    if (
      !Number.isInteger(input.missingQuantity) ||
      input.missingQuantity <= 0
    ) {
      throw new Error("Missing quantity must be a positive whole number");
    }
    await this.returns.openCarrierClaim({
      requestId: input.requestId,
      actorId: input.actor.id,
      missingQuantity: input.missingQuantity,
    });
  }
}
