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

import { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import type { RefundLine } from "@/domain/orders/entities/order.entity";
import { NotificationService } from "@/application/notifications/notification.service";

export interface RefundOrderInput {
  id: string;
  lines: RefundLine[];
  reason?: string;
}

export interface RefundOrderOutput {
  id: string;
  status: string;
  /** Money returned by this return alone. */
  amount: number;
  /** Money returned across every return on this order. */
  refundedTotal: number;
  fullyRefunded: boolean;
  message: string;
}

export class RefundOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryInterface,
    private readonly notifications: NotificationService
  ) {}

  async execute(input: RefundOrderInput): Promise<RefundOrderOutput> {
    const before = await this.orderRepository.findById(input.id);
    const amountBefore = before?.refundedAmount() ?? 0;

    const order = await this.orderRepository.refund(input.id, {
      lines: input.lines,
      reason: input.reason,
    });

    const refundedTotal = order.refundedAmount();
    const fullyRefunded = order.isFullyRefunded();
    const amount = refundedTotal - amountBefore;

    // After the refund is durable, never before: the service swallows its own
    // failures, so a notification problem cannot undo money already returned.
    await this.notifications.orderRefunded({
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      amount,
      fullyRefunded,
    });

    return {
      id: order.id,
      status: order.status,
      amount,
      refundedTotal,
      fullyRefunded,
      message: fullyRefunded
        ? "Order fully refunded"
        : "Partial return recorded",
    };
  }
}
