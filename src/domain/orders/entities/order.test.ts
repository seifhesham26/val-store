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
    paidAt: Date | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
  }> = {}
) => {
  const defaults = {
    id: "order-123",
    userId: "user-456",
    status: "pending" as const,
    items: [
      {
        productId: "prod-1",
        productName: "Test Product",
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
    paymentMethod: null,
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    config.paidAt,
    config.shippedAt,
    config.deliveredAt,
    config.createdAt,
    config.updatedAt
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

  describe("getTotalItems", () => {
    it("returns sum of all item quantities", () => {
      const order = createTestOrder({
        items: [
          { productId: "p1", productName: "A", quantity: 2, price: 10 },
          { productId: "p2", productName: "B", quantity: 3, price: 20 },
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

  describe("canRefund", () => {
    it("returns true for paid orders", () => {
      const order = createTestOrder({ status: "paid" });
      expect(order.canRefund()).toBe(true);
    });

    it("returns true for delivered orders", () => {
      const order = createTestOrder({ status: "delivered" });
      expect(order.canRefund()).toBe(true);
    });

    it("returns false for cancelled orders", () => {
      const order = createTestOrder({ status: "cancelled" });
      expect(order.canRefund()).toBe(false);
    });

    it("returns false for pending orders", () => {
      const order = createTestOrder({ status: "pending" });
      expect(order.canRefund()).toBe(false);
    });
  });
});
