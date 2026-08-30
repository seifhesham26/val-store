import { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import {
  OrderEntity,
  type OrderItem,
  type OrderStatus,
} from "@/domain/orders/entities/order.entity";
import { ValidateCouponUseCase } from "@/application/coupons/use-cases/validate-coupon.use-case";

export interface CreateOrderInput {
  userId: string;
  shippingAddressId: string;
  paymentMethod: "stripe" | "cash_on_delivery";
  /** Optional coupon code. Always re-validated here — never trusted from the client. */
  couponCode?: string;
}

export interface CreateOrderOutput {
  order: OrderEntity;
}

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryInterface,
    private readonly cartRepository: CartRepositoryInterface,
    private readonly validateCouponUseCase: ValidateCouponUseCase
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    const cartItems = await this.cartRepository.findByUserId(input.userId);

    if (cartItems.length === 0) {
      throw new Error("Cart is empty");
    }

    const items: OrderItem[] = cartItems.map((item) => ({
      // Assigned by the database on insert; empty until the order is persisted.
      id: "",
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      variantDetails: item.getVariantLabel(),
      quantity: item.quantity,
      price: item.productPrice,
      refundedQuantity: 0,
    }));

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const tax = 0;
    const shippingCost = 0;

    // Re-validate the coupon server-side against the subtotal we just computed.
    // The client only ever sends a code; the discount amount is derived here so
    // a tampered request cannot invent its own discount.
    let discount = 0;
    let couponId: string | null = null;

    if (input.couponCode) {
      const result = await this.validateCouponUseCase.execute(
        input.couponCode,
        subtotal,
        input.userId
      );

      if (!result.valid) {
        // Fail loudly rather than silently dropping the discount — the customer
        // was shown a discounted total and must not be charged more than that.
        throw new Error(result.error ?? "Coupon is no longer valid");
      }

      discount = result.discountAmount ?? 0;
      couponId = result.coupon?.id ?? null;
    }

    const totalAmount = subtotal + tax + shippingCost - discount;

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
      "pending", // paymentStatus — nothing captured until Stripe confirms / COD delivers
      null, // paidAt
      null, // shippedAt
      null, // deliveredAt
      now,
      now,
      discount,
      couponId
    );

    order.validateTotal();

    const created = await this.orderRepository.create(order);

    // Cash on delivery is complete at this point, so empty the cart server-side
    // rather than relying on the browser to do it. The card flow keeps its cart
    // until Stripe confirms payment, so an abandoned checkout does not lose it.
    if (input.paymentMethod === "cash_on_delivery") {
      try {
        await this.cartRepository.clearCart(input.userId);
      } catch (error) {
        // The order is already committed — never fail the checkout over this.
        // The cart re-syncs from the server on the next read.
        console.error(
          "[CreateOrder] Failed to clear cart after COD order",
          error
        );
      }
    }

    return { order: created };
  }
}
