/**
 * Order Entity Tests
 *
 * Tests for OrderEntity business logic including status transitions,
 * total validation, and state checks.
 */

import { describe, it, expect } from "vitest";
import {
  OrderEntity,
  OrderItem,
  OrderStatus,
} from "@/domain/orders/entities/order.entity";

const createTestOrder = (
  overrides: Partial<{
    id: string;
    status: string;
    items: OrderItem[];
    subtotal: number;
    tax: number;
    shippingCost: number;
    totalAmount: number;
    paymentMethod: string | null;
    paymentStatus: "pending" | "completed" | "failed" | "refunded" | null;
    paidAt: Date | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    discount: number;
    createdAt: Date;
  }> = {}
) => {
  const defaults = {
    id: "order-123",
    userId: "user-456",
    status: "pending" as const,
    items: [
      {
        id: "item-1",
        productId: "prod-1",
        variantId: "variant-1",
        productName: "Test Product",
        variantDetails: "Black / M",
        quantity: 2,
        price: 50,
      },
    ],
    subtotal: 100,
    tax: 10,
    shippingCost: 5,
    totalAmount: 115,
    shippingAddress: "123 Test St",
    billingAddress: "123 Test St",
    paymentMethod: null as string | null,
    paymentStatus: null,
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    discount: 0,
  };

  const config = { ...defaults, ...overrides };
  return new OrderEntity(
    config.id,
    config.userId,
    config.status as OrderStatus,
    config.items,
    config.subtotal,
    config.tax,
    config.shippingCost,
    config.totalAmount,
    config.shippingAddress,
    config.billingAddress,
    config.paymentMethod,
    config.paymentStatus,
    config.paidAt,
    config.shippedAt,
    config.deliveredAt,
    config.createdAt,
    config.updatedAt,
    config.discount
  );
};

describe("OrderEntity", () => {
  describe("isPaid", () => {
    it("returns false for pending order without paidAt", () => {
      const order = createTestOrder({ status: "pending", paidAt: null });
      expect(order.isPaid()).toBe(false);
    });

    it("returns true when paidAt is set", () => {
      const order = createTestOrder({ paidAt: new Date() });
      expect(order.isPaid()).toBe(true);
    });

    it("returns true for paid status", () => {
      const order = createTestOrder({ status: "paid" });
      expect(order.isPaid()).toBe(true);
    });

    it("returns true for shipped status", () => {
      const order = createTestOrder({ status: "shipped" });
      expect(order.isPaid()).toBe(true);
    });
  });

  describe("canCancel", () => {
    it("returns true for pending orders", () => {
      const order = createTestOrder({ status: "pending" });
      expect(order.canCancel()).toBe(true);
    });

    it("returns true for processing orders", () => {
      const order = createTestOrder({ status: "processing" });
      expect(order.canCancel()).toBe(true);
    });

    it("returns false for shipped orders", () => {
      const order = createTestOrder({ status: "shipped" });
      expect(order.canCancel()).toBe(false);
    });

    it("returns false for delivered orders", () => {
      const order = createTestOrder({ status: "delivered" });
      expect(order.canCancel()).toBe(false);
    });
  });

  describe("validateTotal", () => {
    it("does not throw when total matches", () => {
      const order = createTestOrder({
        subtotal: 100,
        tax: 10,
        shippingCost: 5,
        totalAmount: 115,
      });
      expect(() => order.validateTotal()).not.toThrow();
    });

    it("throws when total does not match", () => {
      const order = createTestOrder({
        subtotal: 100,
        tax: 10,
        shippingCost: 5,
        totalAmount: 200, // Wrong!
      });
      expect(() => order.validateTotal()).toThrow("Order total mismatch");
    });
  });

  describe("validateTotal with a discount", () => {
    it("subtracts the discount from the expected total", () => {
      const order = createTestOrder({
        subtotal: 100,
        tax: 10,
        shippingCost: 5,
        discount: 20,
        totalAmount: 95,
      });
      expect(() => order.validateTotal()).not.toThrow();
    });

    it("throws when the total ignores the discount", () => {
      const order = createTestOrder({
        subtotal: 100,
        tax: 10,
        shippingCost: 5,
        discount: 20,
        totalAmount: 115,
      });
      expect(() => order.validateTotal()).toThrow(/Order total mismatch/);
    });

    it("defaults the discount to zero when not supplied", () => {
      const order = createTestOrder();
      expect(order.discount).toBe(0);
      expect(() => order.validateTotal()).not.toThrow();
    });
  });

  describe("getTotalItems", () => {
    it("returns sum of all item quantities", () => {
      const order = createTestOrder({
        items: [
          {
            id: "item-p1",
            productId: "p1",
            variantId: null,
            productName: "A",
            variantDetails: null,
            quantity: 2,
            price: 10,
          },
          {
            id: "item-p2",
            productId: "p2",
            variantId: null,
            productName: "B",
            variantDetails: null,
            quantity: 3,
            price: 20,
          },
        ],
      });
      expect(order.getTotalItems()).toBe(5);
    });
  });

  describe("isFinalState", () => {
    it("returns true for delivered orders", () => {
      const order = createTestOrder({ status: "delivered" });
      expect(order.isFinalState()).toBe(true);
    });

    it("returns true for cancelled orders", () => {
      const order = createTestOrder({ status: "cancelled" });
      expect(order.isFinalState()).toBe(true);
    });

    it("returns false for pending orders", () => {
      const order = createTestOrder({ status: "pending" });
      expect(order.isFinalState()).toBe(false);
    });
  });

  // An unpaid card order holds reserved stock, so it is kept for a fixed window
  // and then released. While that window is open it must not be cancelled by
  // hand — the customer may be mid-payment on Stripe.
  describe("payment window", () => {
    const minutesAgo = (minutes: number) =>
      new Date(Date.now() - minutes * 60 * 1000);

    it("holds a freshly created card order", () => {
      const order = createTestOrder({
        status: "pending",
        paymentMethod: "stripe",
        paymentStatus: "pending",
        createdAt: minutesAgo(1),
      });
      expect(order.isAwaitingPayment()).toBe(true);
      expect(order.canCancel()).toBe(false);
    });

    it("releases a card order once the window has elapsed", () => {
      const order = createTestOrder({
        status: "pending",
        paymentMethod: "stripe",
        paymentStatus: "pending",
        createdAt: minutesAgo(31),
      });
      expect(order.isAwaitingPayment()).toBe(false);
      expect(order.canCancel()).toBe(true);
    });

    it("never holds a cash-on-delivery order", () => {
      // There is no payment in flight to protect — the courier collects later.
      const order = createTestOrder({
        status: "pending",
        paymentMethod: "cash_on_delivery",
        createdAt: minutesAgo(1),
      });
      expect(order.paymentDeadline()).toBeNull();
      expect(order.canCancel()).toBe(true);
    });

    it("stops holding a card order the moment it is paid", () => {
      const order = createTestOrder({
        status: "pending",
        paymentMethod: "stripe",
        paymentStatus: "completed",
        createdAt: minutesAgo(1),
      });
      expect(order.isAwaitingPayment()).toBe(false);
    });

    it("reports a deadline one window after creation", () => {
      const createdAt = minutesAgo(5);
      const order = createTestOrder({
        status: "pending",
        paymentMethod: "stripe",
        paymentStatus: "pending",
        createdAt,
      });
      expect(order.paymentDeadline()?.getTime()).toBe(
        createdAt.getTime() + 30 * 60 * 1000
      );
    });
  });

  // Refundability follows the money, not the order status: what matters is
  // whether payment was actually captured.
  describe("canRefund", () => {
    it("returns true once the card payment is captured", () => {
      const order = createTestOrder({
        status: "paid",
        paymentStatus: "completed",
      });
      expect(order.canRefund()).toBe(true);
    });

    it("returns true for a cancelled order that was already paid", () => {
      // The case that matters: cancelling does not un-charge the customer, so
      // the refund route has to stay open.
      const order = createTestOrder({
        status: "cancelled",
        paymentStatus: "completed",
      });
      expect(order.canRefund()).toBe(true);
    });

    it("returns false for a cancelled order that was never paid", () => {
      const order = createTestOrder({
        status: "cancelled",
        paymentStatus: "pending",
      });
      expect(order.canRefund()).toBe(false);
    });

    it("returns false for a paid status with no captured payment", () => {
      // Status alone is not evidence that money changed hands.
      const order = createTestOrder({
        status: "paid",
        paymentStatus: "pending",
      });
      expect(order.canRefund()).toBe(false);
    });

    it("returns true for a delivered cash-on-delivery order", () => {
      const order = createTestOrder({
        status: "delivered",
        paymentMethod: "cash_on_delivery",
        paymentStatus: "pending",
        deliveredAt: new Date(),
      });
      expect(order.canRefund()).toBe(true);
    });

    it("returns false for an undelivered cash-on-delivery order", () => {
      const order = createTestOrder({
        status: "shipped",
        paymentMethod: "cash_on_delivery",
        paymentStatus: "pending",
      });
      expect(order.canRefund()).toBe(false);
    });

    it("returns false once already refunded", () => {
      const order = createTestOrder({
        status: "refunded",
        paymentStatus: "completed",
      });
      expect(order.canRefund()).toBe(false);
    });

    it("returns false for pending orders", () => {
      const order = createTestOrder({ status: "pending" });
      expect(order.canRefund()).toBe(false);
    });
  });
});
