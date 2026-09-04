/**
 * UpdateCartItemUseCase Tests
 *
 * Covers the stock ceiling check. `maxStock` is always a real number
 * (`DrizzleCartRepository.mapToEntity` — the chosen variant's stock, or a
 * variant-less product's summed stock, defaulted to 0 via `?? 0`), never an
 * "unknown" sentinel, so a maxStock of 0 must reject rather than being read
 * as "no limit."
 *
 * The one exemption is a reduction: the ceiling bounds increases, so a line
 * that is already over it — stock fell after it was added — can still be
 * decremented. Both halves are covered below, since the exemption is exactly
 * the shape that decays into "over-ceiling lines are unchecked."
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
    getAppliedCoupon: vi.fn().mockResolvedValue(null),
    setAppliedCoupon: vi.fn(),
    clearAppliedCoupon: vi.fn(),
    touchCouponCheckedAt: vi.fn(),
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

  it("allows reducing a line that is already over the ceiling", async () => {
    // Stock fell to 1 while 3 sat in the cart. The customer did not cause
    // that and 3 -> 2 moves them towards a cart that can check out, so the
    // ceiling must not block it. Only increases are bounded.
    const repo = createMockRepository(
      createTestCartItem({ quantity: 3, maxStock: 1 })
    );
    const useCase = new UpdateCartItemUseCase(repo);

    await expect(
      useCase.execute({
        cartItemId: "cart-item-123",
        quantity: 2,
        userId: USER_ID,
      })
    ).resolves.toBeDefined();
  });

  it("allows reducing a line whose stock has fallen to 0", async () => {
    // The sold-out case. Without this the only way out of an out-of-stock
    // line is removing it — every "-" click returned "This item is out of
    // stock".
    const repo = createMockRepository(
      createTestCartItem({ quantity: 3, maxStock: 0 })
    );
    const useCase = new UpdateCartItemUseCase(repo);

    await expect(
      useCase.execute({
        cartItemId: "cart-item-123",
        quantity: 1,
        userId: USER_ID,
      })
    ).resolves.toBeDefined();
  });

  it("still rejects an increase on a line that is already over the ceiling", async () => {
    const repo = createMockRepository(
      createTestCartItem({ quantity: 3, maxStock: 1 })
    );
    const useCase = new UpdateCartItemUseCase(repo);

    await expect(
      useCase.execute({
        cartItemId: "cart-item-123",
        quantity: 4,
        userId: USER_ID,
      })
    ).rejects.toThrow(/Maximum available stock is 1/);
  });

  it("still rejects re-submitting the same over-ceiling quantity", async () => {
    // Not a reduction, so the ceiling applies. This is what keeps the
    // exemption from becoming "any write to an over-ceiling line is fine".
    const repo = createMockRepository(
      createTestCartItem({ quantity: 3, maxStock: 1 })
    );
    const useCase = new UpdateCartItemUseCase(repo);

    await expect(
      useCase.execute({
        cartItemId: "cart-item-123",
        quantity: 3,
        userId: USER_ID,
      })
    ).rejects.toThrow(/Maximum available stock is 1/);
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
