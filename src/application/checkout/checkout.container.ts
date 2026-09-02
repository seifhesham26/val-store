/**
 * Checkout Domain Container
 *
 * Note: Checkout depends on Cart, Order and Coupon repositories.
 * These are passed in via a factory function to avoid circular deps.
 */

import { DrizzleOrderRepository } from "@/infrastructure/database/repositories/orders/order.repository";
import { DrizzleCartRepository } from "@/infrastructure/database/repositories/cart/cart.repository";
import { ValidateCouponUseCase } from "@/application/coupons/use-cases/validate-coupon.use-case";
import { CreateCheckoutSessionUseCase } from "./use-cases/create-checkout-session.use-case";
import { CreateOrderUseCase } from "./use-cases/create-order.use-case";
import { NotificationService } from "@/application/notifications/notification.service";
import { SendOrderConfirmationUseCase } from "@/application/orders/use-cases/send-order-confirmation.use-case";
import { AddressRepositoryInterface } from "@/domain/address/interfaces/repositories/address.repository.interface";

export function createCheckoutModule(deps: {
  getOrderRepository: () => DrizzleOrderRepository;
  getCartRepository: () => DrizzleCartRepository;
  getValidateCouponUseCase: () => ValidateCouponUseCase;
  getNotificationService: () => NotificationService;
  getSendOrderConfirmationUseCase: () => SendOrderConfirmationUseCase;
  getAddressRepository: () => AddressRepositoryInterface;
}) {
  let createCheckoutSession: CreateCheckoutSessionUseCase | undefined;
  let createOrder: CreateOrderUseCase | undefined;

  const getCreateOrderUseCase = () =>
    (createOrder ??= new CreateOrderUseCase(
      deps.getOrderRepository(),
      deps.getCartRepository(),
      deps.getValidateCouponUseCase(),
      deps.getNotificationService(),
      deps.getSendOrderConfirmationUseCase(),
      deps.getAddressRepository()
    ));

  return {
    getCreateCheckoutSessionUseCase: () =>
      (createCheckoutSession ??= new CreateCheckoutSessionUseCase(
        deps.getCartRepository(),
        getCreateOrderUseCase(),
        deps.getOrderRepository()
      )),
    getCreateOrderUseCase,
  };
}

export type CheckoutModule = ReturnType<typeof createCheckoutModule>;
