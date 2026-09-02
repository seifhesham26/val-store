import { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import {
  OrderEntity,
  type OrderItem,
  type OrderStatus,
} from "@/domain/orders/entities/order.entity";
import { ValidateCouponUseCase } from "@/application/coupons/use-cases/validate-coupon.use-case";
import { NotificationService } from "@/application/notifications/notification.service";
import { SendOrderConfirmationUseCase } from "@/application/orders/use-cases/send-order-confirmation.use-case";
import { AddressRepositoryInterface } from "@/domain/address/interfaces/repositories/address.repository.interface";

export interface CreateOrderInput {
  userId: string;
  shippingAddressId: string;
  /**
   * Resolved by the caller, not derived here — a checkout that wants "same as
   * shipping" passes `shippingAddressId` again explicitly. The use case never
   * assumes the two are the same, so it cannot silently duplicate the wrong
   * decision for a caller that means to bill elsewhere.
   */
  billingAddressId: string;
  paymentMethod: "stripe" | "cash_on_delivery";
  /** Optional coupon code. Always re-validated here — never trusted from the client. */
  couponCode?: string;
  /**
   * Where to send the confirmation for a cash-on-delivery order.
   *
   * The card path is confirmed by the Stripe webhook instead, which has the
   * customer's email from the session.
   */
  customerEmail?: string;
}

export interface CreateOrderOutput {
  order: OrderEntity;
}

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryInterface,
    private readonly cartRepository: CartRepositoryInterface,
    private readonly validateCouponUseCase: ValidateCouponUseCase,
    private readonly notifications: NotificationService,
    private readonly sendOrderConfirmation: SendOrderConfirmationUseCase,
    private readonly addressRepository: AddressRepositoryInterface
  ) {}

  /**
   * Both address ids belong to the customer placing the order.
   *
   * They arrive from the client and were written straight onto the order —
   * nothing checked them. Any signed-in customer could therefore quote another
   * customer's address id and have their order created against it, and because
   * the order detail page resolves and renders the address, they would then be
   * shown that person's name, street and phone number.
   *
   * Bounded by having to guess a UUID, like the notification ids, but it is a
   * missing authorisation check on a write path either way — and the billing
   * address doubled the number of ids the client gets to choose.
   */
  private async assertAddressesOwnedBy(
    userId: string,
    addressIds: string[]
  ): Promise<void> {
    for (const addressId of [...new Set(addressIds)]) {
      const address = await this.addressRepository.findById(addressId);

      // One message for missing and for not-yours: distinguishing them would
      // confirm that an id exists, which is the thing worth not leaking.
      if (!address || address.userId !== userId) {
        throw new Error("Selected address is not available");
      }
    }
  }

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    // Before anything is read or written: the ids came from the browser.
    await this.assertAddressesOwnedBy(input.userId, [
      input.shippingAddressId,
      input.billingAddressId,
    ]);

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
      input.billingAddressId,
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

      // COD used to receive no confirmation at all, while the success page
      // promised one on both payment methods. The use case absorbs its own
      // failures, so this cannot fail an order that is already committed.
      if (input.customerEmail) {
        await this.sendOrderConfirmation.execute({
          orderId: created.id,
          email: input.customerEmail,
        });
      }
    }

    // After the order has committed, and never in a way that can fail it: the
    // service absorbs its own errors.
    await this.notifications.orderPlaced({
      orderId: created.id,
      orderNumber: created.orderNumber,
      userId: input.userId,
      total: created.totalAmount,
      itemCount: created.getTotalItems(),
    });

    // Stock was decremented inside the order transaction, so the low-stock
    // check happens out here where a notifier exists.
    await this.notifications.stockSold(
      items
        .filter((item) => item.variantId)
        .map((item) => ({
          variantId: item.variantId as string,
          quantity: item.quantity,
        }))
    );

    return { order: created };
  }
}
