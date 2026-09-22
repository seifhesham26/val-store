import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";

export const RETURN_PROPOSAL_READ_MS = 10_000;

export class AcknowledgeReturnProposalUseCase {
  constructor(
    private readonly returns: ReturnRequestRepositoryInterface,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(input: {
    userId: string;
    requestId: string;
    proposalVersion: number;
  }) {
    const request = await this.returns.findForCustomer(
      input.requestId,
      input.userId
    );
    if (!request) throw new Error("Return request not found");
    if (
      request.proposalVersion !== input.proposalVersion ||
      !request.proposalOpenedAt
    ) {
      throw new Error("Open the current proposal before acknowledging it");
    }
    const now = this.now();
    if (
      now.getTime() - request.proposalOpenedAt.getTime() <
      RETURN_PROPOSAL_READ_MS
    ) {
      throw new Error("Review the proposal for at least 10 seconds");
    }
    return this.returns.acknowledgeProposal({
      requestId: request.id,
      customerId: input.userId,
      proposalVersion: input.proposalVersion,
      acknowledgedAt: now,
    });
  }
}
