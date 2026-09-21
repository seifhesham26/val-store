import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import { requireRefundDecisionRole, type RefundActor } from "../refund-actor";

export class AuthorizeReturnPickupUseCase {
  constructor(private readonly returns: ReturnRequestRepositoryInterface) {}

  async execute(input: { actor: RefundActor; requestId: string }) {
    requireRefundDecisionRole(input.actor);
    const request = await this.returns.findForStaff(input.requestId);
    if (!request) throw new Error("Return request not found");
    if (
      request.status !== "requested" &&
      request.status !== "awaiting_customer_evidence"
    ) {
      throw new Error("Return request is not ready for pickup authorization");
    }
    return this.returns.transition(
      request.id,
      request.status,
      "pickup_authorized"
    );
  }
}
