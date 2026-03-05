import { CartRepositoryInterface } from "@/domain/interfaces/repositories/cart.repository.interface";
import { OrderRepositoryInterface } from "@/domain/interfaces/repositories/order.repository.interface";
import {
  OrderEntity,
  type OrderItem,
  type OrderStatus,
} from "@/domain/entities/order.entity";

export interface CreateOrderInput {
  userId: string;
  shippingAddressId: string;
  paymentMethod: "stripe" | "cash_on_delivery";
}

export interface CreateOrderOutput {
  order: OrderEntity;
}

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryInterface,
    private readonly cartRepository: CartRepositoryInterface
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    const cartItems = await this.cartRepository.findByUserId(input.userId);

    if (cartItems.length === 0) {
      throw new Error("Cart is empty");
    }

    const items: OrderItem[] = cartItems.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      price: item.productPrice,
    }));

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const tax = 0;
    const shippingCost = 0;
    const totalAmount = subtotal + tax + shippingCost;

    const status: OrderStatus = "pending";

    const now = new Date();

    const order = new OrderEntity(
      crypto.randomUUID(),
      input.userId,
      status,
      items,
      subtotal,
      tax,
      shippingCost,
      totalAmount,
      input.shippingAddressId,
      input.shippingAddressId,
      input.paymentMethod,
      null,
      null,
      null,
      now,
      now
    );

    order.validateTotal();

    const created = await this.orderRepository.create(order);

    return { order: created };
  }
}
