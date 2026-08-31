import { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import { OrderStatus } from "@/domain/orders/value-objects/order-status.value-object";
import { NotificationService } from "@/application/notifications/notification.service";

/**
 * Update Order Status Use Case
 */

export interface UpdateOrderStatusInput {
  id: string;
  status: string;
  /** Why the order is being cancelled or refunded. */
  reason?: string;
  /** Lines to return to stock. Omit to restock the whole order. */
  restock?: { orderItemId: string; quantity: number }[];
}

export interface UpdateOrderStatusOutput {
  id: string;
  status: string;
  message: string;
}

export class UpdateOrderStatusUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryInterface,
    private readonly notifications: NotificationService
  ) {}

  async execute(
    input: UpdateOrderStatusInput
  ): Promise<UpdateOrderStatusOutput> {
    // Validate status
    const newStatus = OrderStatus.create(input.status);

    // Update via repository (includes transition validation)
    // Pass the string value, not the value object
    const updated = await this.orderRepository.updateStatus(
      input.id,
      newStatus.getValue(),
      { reason: input.reason, restock: input.restock }
    );

    // After the transition has been accepted, never before: a rejected
    // transition must not tell the customer their order shipped. The service
    // absorbs its own failures, so this cannot undo the status change.
    await this.notifications.orderStatusChanged({
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      userId: updated.userId,
      status: updated.status,
    });

    return {
      id: updated.id,
      status: updated.status,
      message: `Order status updated to ${newStatus.getValue()}`,
    };
  }
}
