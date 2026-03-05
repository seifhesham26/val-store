import { OrderEntity } from "@/domain/entities/order.entity";
import { OrderRepositoryInterface } from "@/domain/interfaces/repositories/order.repository.interface";
import { OrderNotFoundException } from "@/domain/exceptions/order-not-found.exception";

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
  items: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }[];
  subtotal: number;
  tax: number;
  shippingCost: number;
  totalAmount: number;
  shippingAddress: string;
  billingAddress: string;
  paymentMethod: string | null;
  isPaid: boolean;
  isShipped: boolean;
  isDelivered: boolean;
  canCancel: boolean;
  canRefund: boolean;
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
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      paymentMethod: order.paymentMethod,
      isPaid: order.isPaid(),
      isShipped: order.isShipped(),
      isDelivered: order.isDelivered(),
      canCancel: order.canCancel(),
      canRefund: order.canRefund(),
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
