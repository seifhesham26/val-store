/**
 * Boundary for the customer-confirmation challenge. The delivery/provider and
 * hashed challenge persistence stay behind this interface, so workflow use
 * cases never receive or log a one-time code.
 */
export interface RefundOtpService {
  request(input: {
    requestId: string;
    proposalVersion: number;
    phone: string;
  }): Promise<{ id: string }>;
  verify(input: {
    requestId: string;
    proposalVersion: number;
    challengeId: string;
    code: string;
  }): Promise<{ id: string }>;
}

/**
 * Until the WhatsApp delivery provider is configured and verified, the
 * application intentionally cannot mint a customer authorization challenge.
 */
export class UnavailableRefundOtpService implements RefundOtpService {
  async request(
    _input: Parameters<RefundOtpService["request"]>[0]
  ): Promise<{ id: string }> {
    void _input;
    throw new Error("Refund OTP provider unavailable");
  }

  async verify(
    _input: Parameters<RefundOtpService["verify"]>[0]
  ): Promise<{ id: string }> {
    void _input;
    throw new Error("Refund OTP provider unavailable");
  }
}
