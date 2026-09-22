/**
 * Refund Order Use Case
 *
 * Records a return against an order: money back for the units the customer
 * sent, stock back for the ones fit to sell again.
 *
 * A return is not a status change, which is why this is separate from
 * `UpdateOrderStatusUseCase`. Returning one of three shirts does not make the
 * order "refunded" — it makes it partly refunded, and the other two must stay
 * returnable.
 */

import type { RefundPayoutService } from "@/application/refunds/refund-payout.service";
import { NotificationService } from "@/application/notifications/notification.service";
import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import type { ReturnRequestRecord } from "@/domain/refunds/return-request";

export interface RefundOrderInput {
  requestId: string;
  customerId: string;
  proposalVersion: number;
}

export class RefundOrderUseCase {
  constructor(
    private readonly returns: ReturnRequestRepositoryInterface,
    private readonly payouts: RefundPayoutService,
    private readonly notifications: NotificationService
  ) {}

  async execute(input: RefundOrderInput): Promise<ReturnRequestRecord> {
    const recorded = await this.returns.finalize({
      requestId: input.requestId,
      customerId: input.customerId,
      proposalVersion: input.proposalVersion,
    });

    const payout = await this.payouts.execute(recorded.id);
    const receivedQuantity = recorded.items.reduce(
      (sum, line) => sum + line.returnedQuantity,
      0
    );
    const missingQuantity = recorded.items.reduce(
      (sum, line) =>
        sum + Math.max(0, line.requestedQuantity - line.returnedQuantity),
      0
    );

    await this.notifications.returnRecorded({
      userId: recorded.customerId,
      requestId: recorded.id,
      receivedQuantity,
      missingQuantity,
      payoutStatus: payout?.status ?? recorded.payoutStatus ?? "pending",
    });
    return recorded;
  }
}
