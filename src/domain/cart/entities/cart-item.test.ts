/**
 * CartItem Entity Tests
 *
 * Tests for CartItemEntity business logic including subtotal calculation
 * and quantity validation.
 */

import { describe, it, expect } from "vitest";
import { CartItemEntity } from "@/domain/cart/entities/cart-item.entity";

const createTestCartItem = (
  overrides: Partial<{
    quantity: number;
    maxStock: number;
    productPrice: number;
  }> = {}
) => {
  const defaults = {
    id: "cart-item-123",
    userId: "user-456",
    productId: "prod-789",
    productName: "Test Product",
    productPrice: 29.99,
    productImage: null,
    quantity: 2,
    maxStock: 10,
    addedAt: new Date(),
    updatedAt: new Date(),
  };

  const config = { ...defaults, ...overrides };
  return new CartItemEntity(
    config.id,
    config.userId,
    config.productId,
    config.productName,
    config.productPrice,
    config.productImage,
    config.quantity,
    config.maxStock,
    config.addedAt,
    config.updatedAt
  );
};

describe("CartItemEntity", () => {
  describe("calculateSubtotal", () => {
    it("calculates subtotal correctly", () => {
      const item = createTestCartItem({ productPrice: 10, quantity: 3 });
      expect(item.calculateSubtotal()).toBe(30);
    });

    it("handles decimal prices", () => {
      const item = createTestCartItem({ productPrice: 9.99, quantity: 2 });
      expect(item.calculateSubtotal()).toBeCloseTo(19.98);
    });
  });

  describe("canIncrease", () => {
    it("returns true when below max stock", () => {
      const item = createTestCartItem({ quantity: 5, maxStock: 10 });
      expect(item.canIncrease(1)).toBe(true);
    });

    it("returns false when at max stock", () => {
      const item = createTestCartItem({ quantity: 10, maxStock: 10 });
      expect(item.canIncrease(1)).toBe(false);
    });

    it("returns false when increase would exceed max stock", () => {
      const item = createTestCartItem({ quantity: 8, maxStock: 10 });
      expect(item.canIncrease(5)).toBe(false);
    });
  });

  describe("canDecrease", () => {
    it("returns true when quantity allows decrease", () => {
      const item = createTestCartItem({ quantity: 3 });
      expect(item.canDecrease(1)).toBe(true);
    });

    it("returns false when decrease would result in zero", () => {
      const item = createTestCartItem({ quantity: 1 });
      expect(item.canDecrease(1)).toBe(false);
    });

    it("returns false when decrease would go negative", () => {
      const item = createTestCartItem({ quantity: 2 });
      expect(item.canDecrease(3)).toBe(false);
    });
  });

  describe("isAtMaxStock", () => {
    it("returns true when at max stock", () => {
      const item = createTestCartItem({ quantity: 10, maxStock: 10 });
      expect(item.isAtMaxStock()).toBe(true);
    });

    it("returns false when below max stock", () => {
      const item = createTestCartItem({ quantity: 5, maxStock: 10 });
      expect(item.isAtMaxStock()).toBe(false);
    });

    it("returns true when over max stock", () => {
      // Edge case: quantity somehow exceeds max
      const item = createTestCartItem({ quantity: 15, maxStock: 10 });
      expect(item.isAtMaxStock()).toBe(true);
    });
  });

  describe("getIncreasedQuantity", () => {
    it("returns increased quantity", () => {
      const item = createTestCartItem({ quantity: 5, maxStock: 10 });
      expect(item.getIncreasedQuantity(2)).toBe(7);
    });

    it("caps at max stock", () => {
      const item = createTestCartItem({ quantity: 8, maxStock: 10 });
      expect(item.getIncreasedQuantity(5)).toBe(10);
    });
  });

  describe("getDecreasedQuantity", () => {
    it("returns decreased quantity", () => {
      const item = createTestCartItem({ quantity: 5 });
      expect(item.getDecreasedQuantity(2)).toBe(3);
    });

    it("floors at zero", () => {
      const item = createTestCartItem({ quantity: 2 });
      expect(item.getDecreasedQuantity(5)).toBe(0);
    });
  });
});
