import type { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import { DrizzleReturnRequestRepository } from "@/infrastructure/database/repositories/refunds/return-request.repository";
import { DrizzleRefundOtpChallengeRepository } from "@/infrastructure/database/repositories/refunds/refund-otp-challenge.repository";
import { DrizzleVerifiedAccountPhoneRepository } from "@/infrastructure/database/repositories/refunds/verified-account-phone.repository";
import { AcknowledgeReturnProposalUseCase } from "./use-cases/acknowledge-return-proposal.use-case";
import { AuthorizeReturnPickupUseCase } from "./use-cases/authorize-return-pickup.use-case";
import { CreateReturnRequestUseCase } from "./use-cases/create-return-request.use-case";
import { OpenCarrierClaimUseCase } from "./use-cases/open-carrier-claim.use-case";
import { RecordPackageEventUseCase } from "./use-cases/record-package-event.use-case";
import { RecordReturnInspectionUseCase } from "./use-cases/record-return-inspection.use-case";
import { RejectReturnUseCase } from "./use-cases/reject-return.use-case";
import { ReviewReturnDisputeUseCase } from "./use-cases/review-return-dispute.use-case";
import { SubmitReturnDisputeUseCase } from "./use-cases/submit-return-dispute.use-case";
import { ConfirmReturnOtpUseCase } from "./use-cases/confirm-return-otp.use-case";
import { RequestReturnOtpUseCase } from "./use-cases/request-return-otp.use-case";
import {
  HashedRefundOtpService,
  type RefundOtpService,
} from "./refund-otp.service";

export function createRefundModule(deps: {
  getOrderRepository: () => OrderRepositoryInterface;
}) {
  let repository: DrizzleReturnRequestRepository | undefined;
  const getReturnRequestRepository = () =>
    (repository ??= new DrizzleReturnRequestRepository());
  let otpChallenges: DrizzleRefundOtpChallengeRepository | undefined;
  const getRefundOtpChallengeRepository = () =>
    (otpChallenges ??= new DrizzleRefundOtpChallengeRepository());
  let verifiedPhones: DrizzleVerifiedAccountPhoneRepository | undefined;
  const getVerifiedAccountPhoneRepository = () =>
    (verifiedPhones ??= new DrizzleVerifiedAccountPhoneRepository());
  let otp: RefundOtpService | undefined;
  const getRefundOtpService = () =>
    (otp ??= new HashedRefundOtpService({
      store: getRefundOtpChallengeRepository(),
      // WhatsApp is intentionally unavailable until a verified launch adapter
      // is configured. The service invalidates any attempted challenge and
      // surfaces PROVIDER_UNAVAILABLE rather than approving a return.
      provider: {
        send: async () => {
          throw new Error("WhatsApp OTP is not configured");
        },
      },
      secret: process.env.REFUND_OTP_SECRET ?? "",
    }));

  return {
    getReturnRequestRepository,
    getCreateReturnRequestUseCase: () =>
      new CreateReturnRequestUseCase(
        deps.getOrderRepository(),
        getReturnRequestRepository()
      ),
    getAuthorizeReturnPickupUseCase: () =>
      new AuthorizeReturnPickupUseCase(getReturnRequestRepository()),
    getRecordReturnInspectionUseCase: () =>
      new RecordReturnInspectionUseCase(getReturnRequestRepository()),
    getAcknowledgeReturnProposalUseCase: () =>
      new AcknowledgeReturnProposalUseCase(getReturnRequestRepository()),
    getRequestReturnOtpUseCase: () =>
      new RequestReturnOtpUseCase(
        getReturnRequestRepository(),
        getRefundOtpService(),
        getVerifiedAccountPhoneRepository()
      ),
    getConfirmReturnOtpUseCase: () =>
      new ConfirmReturnOtpUseCase(
        getReturnRequestRepository(),
        getRefundOtpService()
      ),
    getRejectReturnUseCase: () =>
      new RejectReturnUseCase(getReturnRequestRepository()),
    getSubmitReturnDisputeUseCase: () =>
      new SubmitReturnDisputeUseCase(getReturnRequestRepository()),
    getReviewReturnDisputeUseCase: () =>
      new ReviewReturnDisputeUseCase(getReturnRequestRepository()),
    getRecordPackageEventUseCase: () =>
      new RecordPackageEventUseCase(getReturnRequestRepository()),
    getOpenCarrierClaimUseCase: () =>
      new OpenCarrierClaimUseCase(getReturnRequestRepository()),
  };
}

export type RefundModule = ReturnType<typeof createRefundModule>;
