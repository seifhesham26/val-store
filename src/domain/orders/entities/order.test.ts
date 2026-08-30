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
        refundedQuantity: 0,
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
            refundedQuantity: 0,
          },
          {
            id: "item-p2",
            productId: "p2",
            variantId: null,
            productName: "B",
            variantDetails: null,
            quantity: 3,
            price: 20,
            refundedQuantity: 0,
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

  // A customer can send back part of an order. Money and stock are separate
  // numbers: a damaged return is refunded but not resold.
  describe("partial returns", () => {
    const twoLineOrder = (
      refunded: [number, number] = [0, 0],
      extra: { discount?: number; status?: string; subtotal?: number } = {}
    ) =>
      createTestOrder({
        ...extra,
        items: [
          {
            id: "item-a",
            productId: "p1",
            variantId: "v1",
            productName: "Tee",
            variantDetails: "Black / M",
            quantity: 3,
            price: 20,
            refundedQuantity: refunded[0],
          },
          {
            id: "item-b",
            productId: "p2",
            variantId: "v2",
            productName: "Cap",
            variantDetails: null,
            quantity: 1,
            price: 15,
            refundedQuantity: refunded[1],
          },
        ],
      });

    it("prices a return from the returned units only", () => {
      const order = twoLineOrder();
      expect(
        order.refundValue([
          { orderItemId: "item-a", returned: 1, restocked: 1 },
          { orderItemId: "item-b", returned: 0, restocked: 0 },
        ])
      ).toBe(20);
    });

    it("is not fully refunded while units remain", () => {
      const order = twoLineOrder([1, 0]);
      expect(order.isFullyRefunded()).toBe(false);
      expect(order.isPartiallyRefunded()).toBe(true);
      expect(order.refundedAmount()).toBe(20);
    });

    it("is fully refunded once every unit is back", () => {
      const order = twoLineOrder([3, 1]);
      expect(order.isFullyRefunded()).toBe(true);
      expect(order.isPartiallyRefunded()).toBe(false);
      expect(order.refundedAmount()).toBe(75);
    });

    it("counts returned units across every line", () => {
      expect(twoLineOrder().getRefundedItems()).toBe(0);
      expect(twoLineOrder([1, 0]).getRefundedItems()).toBe(1);
      expect(twoLineOrder([3, 1]).getRefundedItems()).toBe(
        twoLineOrder().getTotalItems()
      );
    });

    it("counts down what is left to return", () => {
      const order = twoLineOrder([1, 0]);
      expect(order.refundableQuantity("item-a")).toBe(2);
      expect(order.refundableQuantity("item-b")).toBe(1);
    });

    it("rejects returning more than is left", () => {
      // Two already came back, so a third return of two is one too many.
      const order = twoLineOrder([2, 0]);
      expect(() =>
        order.validateRefund([
          { orderItemId: "item-a", returned: 2, restocked: 0 },
        ])
      ).toThrow(/only 1 is left to return/);
    });

    it("rejects restocking more than was returned", () => {
      const order = twoLineOrder();
      expect(() =>
        order.validateRefund([
          { orderItemId: "item-a", returned: 1, restocked: 2 },
        ])
      ).toThrow(/back on sale when only 1 is being returned/);
    });

    it("allows a return that is refunded but not resold", () => {
      // The damaged-goods case: money back, stock not recovered.
      const order = twoLineOrder();
      expect(() =>
        order.validateRefund([
          { orderItemId: "item-a", returned: 2, restocked: 0 },
        ])
      ).not.toThrow();
    });

    // A coupon means the customer paid less than list price, so a return must
    // hand back less than list price too — otherwise the discount is refunded
    // as well as the goods.
    it("refunds at what was paid, not at list price", () => {
      // 3x20 + 1x15 = 75 list, 20% off => paid 60. Returning one 20 tee is
      // worth 16, not 20.
      const order = twoLineOrder([0, 0], { subtotal: 75, discount: 15 });
      expect(
        order.refundValue([
          { orderItemId: "item-a", returned: 1, restocked: 1 },
        ])
      ).toBe(16);
    });

    it("never refunds more than the order charged", () => {
      const order = twoLineOrder([0, 0], { subtotal: 75, discount: 15 });
      const everything = order.refundValue([
        { orderItemId: "item-a", returned: 3, restocked: 3 },
        { orderItemId: "item-b", returned: 1, restocked: 1 },
      ]);
      expect(everything).toBe(60);
    });

    it("reports money already returned at what was paid", () => {
      const order = twoLineOrder([1, 0], { subtotal: 75, discount: 15 });
      expect(order.refundedAmount()).toBe(16);
    });

    it("refunds at list price when there is no discount", () => {
      const order = twoLineOrder();
      expect(
        order.refundValue([
          { orderItemId: "item-a", returned: 1, restocked: 1 },
        ])
      ).toBe(20);
    });

    // Cancelling already handed every unit back to inventory, so a refund
    // recorded afterwards must not add them a second time.
    it("refuses to restock a cancelled order", () => {
      const order = twoLineOrder([0, 0], { status: "cancelled" });
      expect(() =>
        order.validateRefund([
          { orderItemId: "item-a", returned: 1, restocked: 1 },
        ])
      ).toThrow(/already gone back/);
    });

    it("still allows refunding a cancelled order without restocking", () => {
      const order = twoLineOrder([0, 0], { status: "cancelled" });
      expect(() =>
        order.validateRefund([
          { orderItemId: "item-a", returned: 1, restocked: 0 },
        ])
      ).not.toThrow();
    });

    it("rejects a return of nothing at all", () => {
      const order = twoLineOrder();
      expect(() =>
        order.validateRefund([
          { orderItemId: "item-a", returned: 0, restocked: 0 },
        ])
      ).toThrow(/at least one item/);
    });
  });

  // Returning more units than were ordered would create stock out of nothing,
  // so the order itself polices what a restock request may ask for.
  describe("validateRestock", () => {
    const order = createTestOrder({
      items: [
        {
          id: "item-a",
          productId: "p1",
          variantId: "v1",
          productName: "Tee",
          variantDetails: "Black / M",
          quantity: 2,
          price: 10,
          refundedQuantity: 0,
        },
      ],
    });

    it("accepts returning everything that was ordered", () => {
      expect(() =>
        order.validateRestock([{ orderItemId: "item-a", quantity: 2 }])
      ).not.toThrow();
    });

    it("accepts returning part of a line", () => {
      expect(() =>
        order.validateRestock([{ orderItemId: "item-a", quantity: 1 }])
      ).not.toThrow();
    });

    it("accepts returning nothing", () => {
      expect(() =>
        order.validateRestock([{ orderItemId: "item-a", quantity: 0 }])
      ).not.toThrow();
    });

    it("rejects more than was ordered", () => {
      expect(() =>
        order.validateRestock([{ orderItemId: "item-a", quantity: 3 }])
      ).toThrow(/only 2 were ordered/);
    });

    it("rejects a line from another order", () => {
      expect(() =>
        order.validateRestock([{ orderItemId: "item-z", quantity: 1 }])
      ).toThrow(/not part of this order/);
    });

    it("rejects the same line listed twice", () => {
      expect(() =>
        order.validateRestock([
          { orderItemId: "item-a", quantity: 1 },
          { orderItemId: "item-a", quantity: 1 },
        ])
      ).toThrow(/listed twice/);
    });

    it("rejects negative and fractional quantities", () => {
      expect(() =>
        order.validateRestock([{ orderItemId: "item-a", quantity: -1 }])
      ).toThrow(/whole number/);
      expect(() =>
        order.validateRestock([{ orderItemId: "item-a", quantity: 1.5 }])
      ).toThrow(/whole number/);
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
