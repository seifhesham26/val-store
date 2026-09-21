import type {
  RefundPayoutProvider,
  RefundPayoutProviderObservation,
  RefundPayoutStatus,
} from "@/application/refunds/refund-payout.service";

export interface OPayRefundResponse {
  body: {
    status?: string;
    reference?: string;
  };
  signature: string | null;
}

export interface OPayRefundTransport {
  createRefund(input: {
    originalPaymentReference: string;
    amount: number;
    currency: "EGP";
    idempotencyKey: string;
  }): Promise<OPayRefundResponse>;
  getRefund(input: {
    originalPaymentReference: string;
    idempotencyKey: string;
    providerReference: string | null;
  }): Promise<OPayRefundResponse>;
}

export interface OPayResponseVerifier {
  verify(response: OPayRefundResponse): boolean;
}

/**
 * Narrow OPay boundary. HTTP details and signature rules are injected because
 * they must come from the merchant's verified OPay contract, not guessed API
 * documentation. This adapter still enforces the safety-critical translation:
 * an unauthenticated response can never become a successful payout.
 */
export class OPayRefundService implements RefundPayoutProvider {
  constructor(
    private readonly transport: OPayRefundTransport,
    private readonly verifier: OPayResponseVerifier
  ) {}

  async refundOriginalPayment(input: {
    originalPaymentReference: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<RefundPayoutProviderObservation> {
    return this.translate(
      await this.transport.createRefund({ ...input, currency: "EGP" })
    );
  }

  async reconcileRefund(input: {
    originalPaymentReference: string;
    idempotencyKey: string;
    providerReference: string | null;
  }): Promise<RefundPayoutProviderObservation> {
    return this.translate(await this.transport.getRefund(input));
  }

  private translate(
    response: OPayRefundResponse
  ): RefundPayoutProviderObservation {
    const verified = this.verifier.verify(response);
    return {
      status: verified ? this.statusOf(response.body.status) : "unknown",
      verified,
      providerReference: response.body.reference ?? null,
    };
  }

  private statusOf(status: string | undefined): RefundPayoutStatus {
    switch (status?.toUpperCase()) {
      case "SUCCESS":
      case "SUCCEEDED":
        return "succeeded";
      case "FAILED":
      case "FAILURE":
        return "failed";
      case "PENDING":
      case "PROCESSING":
        return "pending";
      default:
        return "unknown";
    }
  }
}
