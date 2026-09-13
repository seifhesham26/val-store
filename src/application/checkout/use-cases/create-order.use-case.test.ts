import { describe, expect, it, vi } from "vitest";
import { CartItemEntity } from "@/domain/cart/entities/cart-item.entity";
import type { AddressRepositoryInterface } from "@/domain/address/interfaces/repositories/address.repository.interface";
import type { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import type { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import type { ShippingRateRepositoryInterface } from "@/domain/shipping/interfaces/repositories/shipping-rate.repository.interface";
import type { TaskSchedulerInterface } from "@/application/interfaces/task-scheduler.interface";
import type { ValidateCouponUseCase } from "@/application/coupons/use-cases/validate-coupon.use-case";
import type { NotificationService } from "@/application/notifications/notification.service";
import type { SendOrderConfirmationUseCase } from "@/application/orders/use-cases/send-order-confirmation.use-case";
import { CreateOrderUseCase } from "./create-order.use-case";

describe("CreateOrderUseCase shipping", () => {
  it("evaluates the free-shipping threshold after coupon discounts", async () => {
    const now = new Date("2026-09-13T00:00:00.000Z");
    const cartItem = new CartItemEntity(
      "cart-item-1",
      "user-1",
      "product-1",
      "Jacket",
      2_100,
      null,
      1,
      10,
      now,
      now,
      "variant-1",
      "L",
      "Black"
    );

    const orderRepository = {
      create: vi.fn(async (order) => order),
    } as unknown as OrderRepositoryInterface;
    const cartRepository = {
      findByUserId: vi.fn(async () => [cartItem]),
    } as unknown as CartRepositoryInterface;
    const validateCouponUseCase = {
      execute: vi.fn(async () => ({
        valid: true,
        discountAmount: 300,
        coupon: { id: "coupon-1" },
      })),
    } as unknown as ValidateCouponUseCase;
    const addressRepository = {
      findById: vi.fn(async (id: string) => ({
        id,
        userId: "user-1",
        addressType: "shipping" as const,
        isDefault: true,
        fullName: "Customer",
        addressLine1: "Street 1",
        addressLine2: null,
        city: "Cairo",
        state: "Cairo",
        postalCode: "11511",
        country: "Egypt",
        phone: "+201000000000",
        createdAt: now,
        updatedAt: now,
      })),
    } as AddressRepositoryInterface;
    const shippingRateRepository = {
      getConfig: vi.fn(async () => ({
        rates: [{ governorate: "cairo", fee: 60, isDeliverable: true }],
        freeShippingThreshold: 2_000,
      })),
    } as ShippingRateRepositoryInterface;
    const scheduler = {
      runAfterResponse: vi.fn(),
    } as TaskSchedulerInterface;

    const useCase = new CreateOrderUseCase(
      orderRepository,
      cartRepository,
      validateCouponUseCase,
      {} as NotificationService,
      {} as SendOrderConfirmationUseCase,
      addressRepository,
      shippingRateRepository,
      scheduler
    );

    const { order } = await useCase.execute({
      userId: "user-1",
      shippingAddressId: "address-1",
      billingAddressId: "address-1",
      paymentMethod: "stripe",
      couponCode: "SAVE300",
    });

    // EGP 2,100 qualifies before the coupon, but EGP 1,800 does not. The
    // customer therefore pays the configured EGP 60 delivery fee.
    expect(order.discount).toBe(300);
    expect(order.shippingCost).toBe(60);
    expect(order.totalAmount).toBe(1_860);
  });
});
