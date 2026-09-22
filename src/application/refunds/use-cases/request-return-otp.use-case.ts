import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import type { RefundOtpService } from "../refund-otp.service";

/** Resolves a phone from account records; callers never supply a destination. */
export interface VerifiedAccountPhoneSource {
  findVerifiedPhone(userId: string): Promise<string | null>;
}

export class RequestReturnOtpUseCase {
  constructor(
    private readonly returns: ReturnRequestRepositoryInterface,
    private readonly otp: RefundOtpService,
    private readonly verifiedPhones: VerifiedAccountPhoneSource
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
      request.status !== "awaiting_customer_confirmation" ||
      request.proposalVersion !== input.proposalVersion ||
      !request.acknowledgedAt
    ) {
      throw new Error(
        "Acknowledge the current proposal before requesting an OTP"
      );
    }
    if (!request.proposal || request.proposal.totalRefund <= 0) {
      throw new Error("This return outcome does not require an OTP");
    }
    const phone = await this.verifiedPhones.findVerifiedPhone(input.userId);
    if (!phone) throw new Error("A verified phone number is required");
    return this.otp.request({
      requestId: request.id,
      proposalVersion: request.proposalVersion,
      phone,
    });
  }
}
