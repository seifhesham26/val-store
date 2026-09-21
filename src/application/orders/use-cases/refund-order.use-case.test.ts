import { describe, expect, it, vi } from "vitest";

import type { NotificationService } from "@/application/notifications/notification.service";
import type { RefundPayoutService } from "@/application/refunds/refund-payout.service";
import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import type { ReturnRequestRecord } from "@/domain/refunds/return-request";
import { RefundOrderUseCase } from "./refund-order.use-case";

const recorded = {
  id: "return-1",
  orderId: "order-1",
  customerId: "customer-1",
  status: "recorded",
  physicalStatus: "mixed",
  payoutStatus: "pending",
  proposalVersion: 2,
  items: [
    { requestedQuantity: 2, receivedQuantity: 2, returnedQuantity: 2 },
    { requestedQuantity: 0, receivedQuantity: 0, returnedQuantity: 0 },
  ],
  proposal: { totalRefund: 250 },
} as ReturnRequestRecord;

describe("RefundOrderUseCase", () => {
  it("finalizes from stored request facts and reports payout as pending", async () => {
    const returns = {
      finalize: vi.fn().mockResolvedValue(recorded),
    } as unknown as ReturnRequestRepositoryInterface;
    const payouts = {
      execute: vi.fn().mockResolvedValue({ status: "pending" }),
    } as unknown as RefundPayoutService;
    const notifications = {
      returnRecorded: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationService;

    const result = await new RefundOrderUseCase(
      returns,
      payouts,
      notifications
    ).execute({
      requestId: "return-1",
      customerId: "customer-1",
      proposalVersion: 2,
    });

    expect(returns.finalize).toHaveBeenCalledWith({
      requestId: "return-1",
      customerId: "customer-1",
      proposalVersion: 2,
    });
    expect(payouts.execute).toHaveBeenCalledWith("return-1");
    expect(notifications.returnRecorded).toHaveBeenCalledWith({
      userId: "customer-1",
      requestId: "return-1",
      receivedQuantity: 2,
      missingQuantity: 0,
      payoutStatus: "pending",
    });
    expect(result).toBe(recorded);
  });
});
