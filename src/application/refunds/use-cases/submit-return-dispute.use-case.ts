import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";

export class SubmitReturnDisputeUseCase {
  constructor(private readonly returns: ReturnRequestRepositoryInterface) {}
  execute(input: {
    userId: string;
    requestId: string;
    proposalVersion: number;
    reason: string;
  }) {
    return this.returns.submitDispute({
      requestId: input.requestId,
      customerId: input.userId,
      proposalVersion: input.proposalVersion,
      reason: input.reason,
    });
  }
}
