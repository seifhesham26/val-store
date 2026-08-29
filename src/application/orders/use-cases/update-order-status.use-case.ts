import { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import { OrderStatus } from "@/domain/orders/value-objects/order-status.value-object";

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
  constructor(private readonly orderRepository: OrderRepositoryInterface) {}

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

    return {
      id: updated.id,
      status: updated.status,
      message: `Order status updated to ${newStatus.getValue()}`,
    };
  }
}
