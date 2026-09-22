import { describe, expect, it, vi } from "vitest";

import {
  RefundPayoutService,
  type RefundPayoutProvider,
  type RefundPayoutStore,
} from "./refund-payout.service";

const pending = {
  id: "payout-1",
  requestId: "return-1",
  amount: 125,
  originalPaymentReference: "payment-1",
  idempotencyKey: "return:return-1:proposal:1",
  providerReference: null,
  status: "pending" as const,
  attemptCount: 1,
  lastAttemptAt: new Date("2026-09-21T10:00:00.000Z"),
};

describe("RefundPayoutService", () => {
  it("records money as paid only after a verified provider success", async () => {
    const store = {
      prepare: vi
        .fn()
        .mockResolvedValue({ action: "initiate", payout: pending }),
      recordObservation: vi
        .fn()
        .mockResolvedValue({ ...pending, status: "succeeded" }),
    } as unknown as RefundPayoutStore;
    const provider = {
      refundOriginalPayment: vi.fn().mockResolvedValue({
        status: "succeeded",
        verified: true,
        providerReference: "opay-refund-1",
      }),
    } as unknown as RefundPayoutProvider;

    await new RefundPayoutService(store, provider).execute("return-1");

    expect(store.recordObservation).toHaveBeenCalledWith({
      payoutId: "payout-1",
      status: "succeeded",
      providerReference: "opay-refund-1",
    });
  });

  it("keeps an unverified success unknown instead of claiming completion", async () => {
    const store = {
      prepare: vi
        .fn()
        .mockResolvedValue({ action: "initiate", payout: pending }),
      recordObservation: vi
        .fn()
        .mockResolvedValue({ ...pending, status: "unknown" }),
    } as unknown as RefundPayoutStore;
    const provider = {
      refundOriginalPayment: vi.fn().mockResolvedValue({
        status: "succeeded",
        verified: false,
        providerReference: "untrusted-reference",
      }),
    } as unknown as RefundPayoutProvider;

    await new RefundPayoutService(store, provider).execute("return-1");

    expect(store.recordObservation).toHaveBeenCalledWith({
      payoutId: "payout-1",
      status: "unknown",
      providerReference: "untrusted-reference",
    });
  });

  it("reconciles pending or unknown payouts and never starts a fresh payout", async () => {
    const store = {
      prepare: vi
        .fn()
        .mockResolvedValue({ action: "reconcile", payout: pending }),
      recordObservation: vi
        .fn()
        .mockResolvedValue({ ...pending, status: "pending" }),
    } as unknown as RefundPayoutStore;
    const provider = {
      refundOriginalPayment: vi.fn(),
      reconcileRefund: vi.fn().mockResolvedValue({
        status: "pending",
        verified: true,
        providerReference: "opay-refund-1",
      }),
    } as unknown as RefundPayoutProvider;

    await new RefundPayoutService(store, provider).execute("return-1");

    expect(provider.refundOriginalPayment).not.toHaveBeenCalled();
    expect(provider.reconcileRefund).toHaveBeenCalledWith({
      originalPaymentReference: "payment-1",
      idempotencyKey: "return:return-1:proposal:1",
      providerReference: null,
    });
  });

  it("turns a timeout into unknown so a retry can only reconcile it", async () => {
    const store = {
      prepare: vi
        .fn()
        .mockResolvedValue({ action: "initiate", payout: pending }),
      recordObservation: vi
        .fn()
        .mockResolvedValue({ ...pending, status: "unknown" }),
    } as unknown as RefundPayoutStore;
    const provider = {
      refundOriginalPayment: vi.fn().mockRejectedValue(new Error("timeout")),
    } as unknown as RefundPayoutProvider;

    await new RefundPayoutService(store, provider).execute("return-1");

    expect(store.recordObservation).toHaveBeenCalledWith({
      payoutId: "payout-1",
      status: "unknown",
      providerReference: null,
    });
  });
});
