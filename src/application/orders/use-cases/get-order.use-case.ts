import {
  OrderEntity,
  type OrderAddress,
  type OrderItem,
} from "@/domain/orders/entities/order.entity";
import { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import { OrderNotFoundException } from "@/domain/orders/exceptions/order-not-found.exception";

/**
 * Get Order Use Case
 */

export interface GetOrderInput {
  id: string;
}

export interface GetOrderOutput {
  id: string;
  userId: string;
  status: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shippingCost: number;
  totalAmount: number;
  discount: number;
  shippingAddressId: string;
  billingAddressId: string;
  shippingAddress: OrderAddress | null;
  billingAddress: OrderAddress | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  hasCapturedPayment: boolean;
  isPaid: boolean;
  isShipped: boolean;
  isDelivered: boolean;
  canCancel: boolean;
  canRefund: boolean;
  /** Still inside the card-payment window, so held rather than cancellable. */
  awaitingPayment: boolean;
  /** Money already returned to the customer across all returns. */
  refundedAmount: number;
  /** Some units returned, but not all. */
  partiallyRefunded: boolean;
  fullyRefunded: boolean;
  /** When that window closes and the order releases itself. */
  paymentDeadline: Date | null;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class GetOrderUseCase {
  constructor(private readonly orderRepository: OrderRepositoryInterface) {}

  async execute(input: GetOrderInput): Promise<GetOrderOutput> {
    const order = await this.orderRepository.findById(input.id);

    if (!order) {
      throw new OrderNotFoundException(input.id);
    }

    return this.mapToDTO(order);
  }

  private mapToDTO(order: OrderEntity): GetOrderOutput {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      items: order.items,
      subtotal: order.subtotal,
      tax: order.tax,
      shippingCost: order.shippingCost,
      totalAmount: order.totalAmount,
      discount: order.discount,
      shippingAddressId: order.shippingAddressId,
      billingAddressId: order.billingAddressId,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      hasCapturedPayment: order.hasCapturedPayment(),
      isPaid: order.isPaid(),
      isShipped: order.isShipped(),
      isDelivered: order.isDelivered(),
      canCancel: order.canCancel(),
      canRefund: order.canRefund(),
      awaitingPayment: order.isAwaitingPayment(),
      refundedAmount: order.refundedAmount(),
      partiallyRefunded: order.isPartiallyRefunded(),
      fullyRefunded: order.isFullyRefunded(),
      paymentDeadline: order.paymentDeadline(),
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
