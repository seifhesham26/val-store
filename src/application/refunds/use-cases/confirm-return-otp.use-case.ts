import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import type { RefundOtpService } from "../refund-otp.service";

export class ConfirmReturnOtpUseCase {
  constructor(
    private readonly returns: ReturnRequestRepositoryInterface,
    private readonly otp: RefundOtpService
  ) {}

  async execute(input: {
    userId: string;
    requestId: string;
    proposalVersion: number;
    challengeId: string;
    code: string;
  }) {
    const request = await this.returns.findForCustomer(
      input.requestId,
      input.userId
    );
    if (!request) throw new Error("Return request not found");
    if (
      request.status !== "awaiting_customer_confirmation" ||
      request.proposalVersion !== input.proposalVersion ||
      !request.acknowledgedAt ||
      !request.proposal ||
      request.proposal.totalRefund <= 0
    ) {
      throw new Error("The current proposal cannot be confirmed");
    }

    await this.otp.verify({
      requestId: request.id,
      proposalVersion: request.proposalVersion,
      challengeId: input.challengeId,
      code: input.code,
    });
    await this.returns.transition(
      request.id,
      "awaiting_customer_confirmation",
      "confirmed"
    );
    return this.returns.finalize({
      requestId: request.id,
      customerId: input.userId,
      proposalVersion: request.proposalVersion,
    });
  }
}
