/**
 * Checkout Domain Container
 *
 * Note: Checkout depends on Cart and Order repositories.
 * These are passed in via a factory function to avoid circular deps.
 */

import { DrizzleOrderRepository } from "@/infrastructure/database/repositories/orders/order.repository";
import { DrizzleCartRepository } from "@/infrastructure/database/repositories/cart/cart.repository";
import { CreateCheckoutSessionUseCase } from "./use-cases/create-checkout-session.use-case";
import { CreateOrderUseCase } from "./use-cases/create-order.use-case";

export function createCheckoutModule(deps: {
  getOrderRepository: () => DrizzleOrderRepository;
  getCartRepository: () => DrizzleCartRepository;
}) {
  let createCheckoutSession: CreateCheckoutSessionUseCase | undefined;
  let createOrder: CreateOrderUseCase | undefined;

  const getCreateOrderUseCase = () =>
    (createOrder ??= new CreateOrderUseCase(
      deps.getOrderRepository(),
      deps.getCartRepository()
    ));

  return {
    getCreateCheckoutSessionUseCase: () =>
      (createCheckoutSession ??= new CreateCheckoutSessionUseCase(
        deps.getCartRepository(),
        getCreateOrderUseCase()
      )),
    getCreateOrderUseCase,
  };
}

export type CheckoutModule = ReturnType<typeof createCheckoutModule>;
