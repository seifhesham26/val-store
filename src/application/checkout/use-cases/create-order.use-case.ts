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
import type { Address } from "@/db/schema";
import { quoteShipping } from "@/domain/shipping/shipping-rate";
import type { ShippingRateRepositoryInterface } from "@/domain/shipping/interfaces/repositories/shipping-rate.repository.interface";
import { TaskSchedulerInterface } from "@/application/interfaces/task-scheduler.interface";

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
  /**
   * Cash on delivery is the only method — Stripe was removed and no
   * replacement gateway (OPay) is wired in yet.
   */
  paymentMethod: "cash_on_delivery";
  /** Optional coupon code. Always re-validated here — never trusted from the client. */
  couponCode?: string;
  /** Where to send the order confirmation. */
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
    private readonly addressRepository: AddressRepositoryInterface,
    private readonly shippingRateRepository: ShippingRateRepositoryInterface,
    private readonly scheduler: TaskSchedulerInterface
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
  ): Promise<Map<string, Address>> {
    // Bounded at two ids (shipping, billing), so this is never more than one
    // round trip: postgres.js pipelines queries issued together down a single
    // connection. Awaiting them one at a time in a loop paid for two round
    // trips in series instead, on the critical path before anything else in
    // checkout runs.
    const addresses = await Promise.all(
      [...new Set(addressIds)].map((addressId) =>
        this.addressRepository.findById(addressId)
      )
    );

    // One message for missing and for not-yours: distinguishing them would
    // confirm that an id exists, which is the thing worth not leaking.
    if (addresses.some((address) => !address || address.userId !== userId)) {
      throw new Error("Selected address is not available");
    }

    // Returned rather than discarded so pricing can read the destination
    // governorate without paying for a second lookup of a row we already have.
    return new Map(
      addresses.filter((a): a is Address => Boolean(a)).map((a) => [a.id, a])
    );
  }

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    // Before anything is read or written: the ids came from the browser.
    const addressesById = await this.assertAddressesOwnedBy(input.userId, [
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

    // Priced from the destination governorate, server-side, against the
    // subtotal computed above — never from anything the client sent. The rates
    // are whatever the admin has configured; an unconfigured store ships free.
    const shippingConfig = await this.shippingRateRepository.getConfig();
    const quote = quoteShipping({
      subtotal,
      governorate: addressesById.get(input.shippingAddressId)?.state,
      rates: shippingConfig.rates,
      freeShippingThreshold: shippingConfig.freeShippingThreshold,
    });

    // Refusing here rather than at the door: a governorate switched off in the
    // admin must not be able to reach a paid order in the first place.
    if (!quote.isDeliverable) {
      throw new Error(
        "We do not currently deliver to that governorate. Please choose another address."
      );
    }

    const shippingCost = quote.fee;

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
      "pending", // paymentStatus — nothing captured until the courier delivers
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

    // Cash on delivery is complete at this point, so empty the cart
    // server-side rather than relying on the browser to do it.
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

    // Deferred through the scheduler rather than awaited or a bare `void`: a
    // confirmation email is one-shot, with no retry anywhere, so a serverless
    // instance frozen at response time would simply lose it, and awaiting it
    // would put a live Resend round trip on the checkout response for an
    // order that had already committed.
    if (input.customerEmail) {
      const email = input.customerEmail;

      this.scheduler.runAfterResponse("order confirmation email", () =>
        this.sendOrderConfirmation.execute({
          orderId: created.id,
          email,
        })
      );
    }

    // After the order has committed, and never in a way that can fail it: the
    // service absorbs its own errors.
    //
    // Deferred for the same reason as the email above, and with more to gain.
    // These were awaited on the checkout response while the customer watched a
    // spinner, and they are not cheap: `orderPlaced` costs three round trips
    // (find the admin ids, insert their notifications, insert the customer's),
    // and `stockSold` costs one to read the variants plus two more for every
    // variant that crossed the low-stock threshold. At ~58ms each against
    // Neon that is ~230ms minimum added to checkout — for rows only an admin
    // will ever read.
    const soldVariants = items
      .filter((item) => item.variantId)
      .map((item) => ({
        variantId: item.variantId as string,
        quantity: item.quantity,
      }));

    this.scheduler.runAfterResponse("order notifications", async () => {
      await this.notifications.orderPlaced({
        orderId: created.id,
        orderNumber: created.orderNumber,
        userId: input.userId,
        total: created.totalAmount,
        itemCount: created.getTotalItems(),
      });

      // Stock was decremented inside the order transaction, so the low-stock
      // check happens out here where a notifier exists.
      await this.notifications.stockSold(soldVariants);
    });

    return { order: created };
  }
}
