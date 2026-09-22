import type { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import type {
  CreateReturnRequestInput,
  ReturnRequestRepositoryInterface,
} from "@/domain/refunds/interfaces/return-request.repository.interface";
import { REFUND_POLICY } from "@/domain/refunds/refund-policy";

const merchantFaultReasons = new Set([
  "defective",
  "wrong_item",
  "not_as_described",
  "late_delivery",
]);

export class CreateReturnRequestUseCase {
  constructor(
    private readonly orders: OrderRepositoryInterface,
    private readonly returns: ReturnRequestRepositoryInterface,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(
    input: Omit<CreateReturnRequestInput, "customerId"> & { userId: string }
  ) {
    const order = await this.orders.findById(input.orderId);
    if (!order || order.userId !== input.userId) {
      throw new Error("Order not found");
    }
    if (!order.isDelivered() || !order.deliveredAt) {
      throw new Error("Only delivered orders can be returned");
    }
    if (!order.hasCapturedPayment()) {
      throw new Error("This order has no captured payment to return");
    }
    const windowDays = merchantFaultReasons.has(input.reason)
      ? REFUND_POLICY.merchantFaultReturnWindowDays
      : REFUND_POLICY.normalReturnWindowDays;
    const deadline = new Date(order.deliveredAt);
    deadline.setUTCDate(deadline.getUTCDate() + windowDays);
    if (this.now().getTime() > deadline.getTime()) {
      throw new Error(`The ${windowDays}-day return window has closed`);
    }
    order.validateRefund(
      input.lines.map((line) => ({
        orderItemId: line.orderItemId,
        returned: line.quantity,
        restocked: 0,
      }))
    );

    return this.returns.create({
      orderId: input.orderId,
      customerId: input.userId,
      reason: input.reason,
      customerNote: input.customerNote,
      pickupMethod: input.pickupMethod,
      lines: input.lines,
    });
  }
}
