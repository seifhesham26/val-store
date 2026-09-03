/**
 * UpdateCartItemUseCase Tests
 *
 * Covers the stock ceiling check. `maxStock` is always a real number
 * (`DrizzleCartRepository.mapToEntity` — the chosen variant's stock, or a
 * variant-less product's summed stock, defaulted to 0 via `?? 0`), never an
 * "unknown" sentinel, so a maxStock of 0 must reject every quantity rather
 * than being read as "no limit."
 */

import { describe, it, expect, vi } from "vitest";
import { UpdateCartItemUseCase } from "./update-cart-item.use-case";
import { CartItemEntity } from "@/domain/cart/entities/cart-item.entity";
import type { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";

const USER_ID = "user-456";

const createTestCartItem = (
  overrides: Partial<{
    id: string;
    quantity: number;
    maxStock: number;
    userId: string;
  }> = {}
): CartItemEntity => {
  const defaults = {
    id: "cart-item-123",
    userId: USER_ID,
    quantity: 2,
    maxStock: 10,
  };
  const config = { ...defaults, ...overrides };

  return new CartItemEntity(
    config.id,
    config.userId,
    "prod-789",
    "Test Product",
    29.99,
    null,
    config.quantity,
    config.maxStock,
    new Date(),
    new Date()
  );
};

function createMockRepository(
  existingItem: CartItemEntity | null
): CartRepositoryInterface {
  return {
    findById: vi.fn().mockResolvedValue(existingItem),
    findByUserId: vi.fn(),
    findByUserAndProduct: vi.fn(),
    addItem: vi.fn(),
    updateQuantity: vi
      .fn()
      .mockImplementation((id: string, quantity: number) =>
        Promise.resolve(
          createTestCartItem({ id, quantity, maxStock: existingItem?.maxStock })
        )
      ),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
    getCartTotal: vi.fn().mockResolvedValue(0),
    getCartItemCount: vi.fn().mockResolvedValue(0),
    isProductInCart: vi.fn(),
  };
}

describe("UpdateCartItemUseCase", () => {
  it("rejects a quantity above maxStock", async () => {
    const repo = createMockRepository(
      createTestCartItem({ quantity: 2, maxStock: 5 })
    );
    const useCase = new UpdateCartItemUseCase(repo);

    await expect(
      useCase.execute({
        cartItemId: "cart-item-123",
        quantity: 6,
        userId: USER_ID,
      })
    ).rejects.toThrow(/Maximum available stock is 5/);
  });

  it("allows a quantity at exactly maxStock", async () => {
    const repo = createMockRepository(
      createTestCartItem({ quantity: 2, maxStock: 5 })
    );
    const useCase = new UpdateCartItemUseCase(repo);

    await expect(
      useCase.execute({
        cartItemId: "cart-item-123",
        quantity: 5,
        userId: USER_ID,
      })
    ).resolves.toBeDefined();
  });

  it("rejects any positive quantity when maxStock is 0 — the out-of-stock case", async () => {
    // Previously `quantity > maxStock && maxStock > 0` disabled the ceiling
    // exactly when stock was 0, so an out-of-stock line accepted any
    // quantity. maxStock is never a sentinel for "unknown" — it's a real,
    // always-populated figure — so 0 must reject rather than bypass.
    const repo = createMockRepository(
      createTestCartItem({ quantity: 1, maxStock: 0 })
    );
    const useCase = new UpdateCartItemUseCase(repo);

    await expect(
      useCase.execute({
        cartItemId: "cart-item-123",
        quantity: 1,
        userId: USER_ID,
      })
    ).rejects.toThrow(/out of stock/);
  });

  it("still rejects quantities below 1 before checking stock", async () => {
    const repo = createMockRepository(
      createTestCartItem({ quantity: 1, maxStock: 5 })
    );
    const useCase = new UpdateCartItemUseCase(repo);

    await expect(
      useCase.execute({
        cartItemId: "cart-item-123",
        quantity: 0,
        userId: USER_ID,
      })
    ).rejects.toThrow(/at least 1/);
  });

  it("rejects updating an item that belongs to a different user", async () => {
    const repo = createMockRepository(
      createTestCartItem({ quantity: 1, maxStock: 5, userId: "someone-else" })
    );
    const useCase = new UpdateCartItemUseCase(repo);

    await expect(
      useCase.execute({
        cartItemId: "cart-item-123",
        quantity: 2,
        userId: USER_ID,
      })
    ).rejects.toThrow(/Unauthorized/);
  });
});
