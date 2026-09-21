import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import { requireRefundDecisionRole, type RefundActor } from "../refund-actor";

export class ReviewReturnDisputeUseCase {
  constructor(private readonly returns: ReturnRequestRepositoryInterface) {}
  async execute(input: {
    actor: RefundActor;
    requestId: string;
    disputeLevel: number;
  }) {
    requireRefundDecisionRole(input.actor);
    if (input.disputeLevel >= 2 && input.actor.role !== "super_admin") {
      throw new Error("Only a super admin can decide the final escalation");
    }
    return this.returns.reviewDispute({
      requestId: input.requestId,
      reviewerId: input.actor.id,
      expectedLevel: input.disputeLevel,
    });
  }
}
