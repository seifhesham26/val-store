import { describe, expect, it, vi } from "vitest";

import { OPayRefundService } from "./opay-refund.service";

describe("OPayRefundService", () => {
  it("does not trust a success-shaped response until its authenticity is verified", async () => {
    const transport = {
      createRefund: vi.fn().mockResolvedValue({
        body: { status: "SUCCESS", reference: "provider-1" },
        signature: "invalid",
      }),
      getRefund: vi.fn(),
    };
    const service = new OPayRefundService(transport, {
      verify: vi.fn().mockReturnValue(false),
    });

    await expect(
      service.refundOriginalPayment({
        originalPaymentReference: "payment-1",
        amount: 125,
        idempotencyKey: "stable-key",
      })
    ).resolves.toEqual({
      status: "unknown",
      verified: false,
      providerReference: "provider-1",
    });
  });

  it("sends only the stored original reference, stored amount, and stable key", async () => {
    const response = {
      body: { status: "SUCCESS", reference: "provider-1" },
      signature: "valid",
    };
    const transport = {
      createRefund: vi.fn().mockResolvedValue(response),
      getRefund: vi.fn(),
    };
    const service = new OPayRefundService(transport, {
      verify: vi.fn().mockReturnValue(true),
    });

    await service.refundOriginalPayment({
      originalPaymentReference: "payment-1",
      amount: 125,
      idempotencyKey: "stable-key",
    });

    expect(transport.createRefund).toHaveBeenCalledWith({
      originalPaymentReference: "payment-1",
      amount: 125,
      currency: "EGP",
      idempotencyKey: "stable-key",
    });
  });
});
