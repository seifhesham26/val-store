import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import { requireRefundDecisionRole, type RefundActor } from "../refund-actor";

export class RejectReturnUseCase {
  constructor(private readonly returns: ReturnRequestRepositoryInterface) {}

  async execute(input: {
    actor: RefundActor;
    requestId: string;
    reason: string;
  }) {
    requireRefundDecisionRole(input.actor);
    if (!input.reason.trim()) throw new Error("A rejection reason is required");
    return this.returns.reject({
      requestId: input.requestId,
      reviewerId: input.actor.id,
      reason: input.reason.trim(),
    });
  }
}
