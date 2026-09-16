import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartItemEntity } from "@/domain/cart/entities/cart-item.entity";
import type { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import { ProductVariantEntity } from "@/domain/products/entities/product-variant.entity";
import type { ProductVariantRepositoryInterface } from "@/domain/products/interfaces/repositories/product-variant.repository.interface";
import { CheckCartStockUseCase } from "./check-cart-stock.use-case";

const now = new Date("2026-09-16T00:00:00.000Z");

function cartItem(quantity: number): CartItemEntity {
  return new CartItemEntity(
    "cart-item-1",
    "user-1",
    "product-1",
    "Field Jacket",
    2500,
    null,
    quantity,
    11,
    now,
    now,
    "variant-1",
    "L",
    "Black"
  );
}

function variant(
  id: string,
  stockQuantity: number,
  size: string,
  color: string
): ProductVariantEntity {
  return new ProductVariantEntity(
    id,
    "product-1",
    id.toUpperCase(),
    size,
    color,
    stockQuantity,
    0,
    true,
    now,
    now
  );
}

function cartRepository(items: CartItemEntity[]): CartRepositoryInterface {
  return {
    findById: vi.fn(),
    findByUserId: vi.fn().mockResolvedValue(items),
    findByUserAndProduct: vi.fn(),
    addItem: vi.fn(),
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
    getCartTotal: vi.fn().mockResolvedValue(0),
    getCartItemCount: vi.fn().mockResolvedValue(0),
    isProductInCart: vi.fn().mockResolvedValue(false),
    getAppliedCoupon: vi.fn().mockResolvedValue(null),
    setAppliedCoupon: vi.fn(),
    clearAppliedCoupon: vi.fn(),
    touchCouponCheckedAt: vi.fn(),
  };
}

function variantRepository(): ProductVariantRepositoryInterface {
  return {
    findById: vi.fn(),
    findBySku: vi.fn(),
    findByProduct: vi.fn(),
    findByIds: vi
      .fn()
      .mockResolvedValue([variant("variant-1", 11, "L", "Black")]),
    findByProducts: vi.fn().mockResolvedValue(new Map()),
    findSellableByIds: vi.fn().mockResolvedValue([
      {
        variant: variant("variant-1", 11, "L", "Black"),
        sellableStock: 1,
        availabilityState: "inspection_pending",
      },
    ]),
    findSellableByProduct: vi.fn(),
    findSellableByProducts: vi.fn().mockResolvedValue(new Map()),
    findMany: vi.fn(),
    findAvailableByProduct: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteByProduct: vi.fn(),
    existsBySku: vi.fn(),
    getTotalStockByProduct: vi.fn(),
  };
}

describe("CheckCartStockUseCase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the sellable ceiling instead of recorded stock", async () => {
    const variants = variantRepository();
    const result = await new CheckCartStockUseCase(
      cartRepository([cartItem(2)]),
      variants
    ).execute("user-1");

    expect(variants.findSellableByIds).toHaveBeenCalledWith(["variant-1"]);
    expect(result.lines[0]).toMatchObject({
      requested: 2,
      available: 1,
      status: "reduced",
    });
  });

  it("only offers sibling variants with sellable stock", async () => {
    const variants = variantRepository();
    vi.mocked(variants.findSellableByProducts).mockResolvedValue(
      new Map([
        [
          "product-1",
          [
            {
              variant: variant("variant-2", 12, "L", "Navy"),
              sellableStock: 0,
              availabilityState: "quarantined",
            },
            {
              variant: variant("variant-3", 3, "M", "Black"),
              sellableStock: 3,
              availabilityState: "available",
            },
          ],
        ],
      ])
    );

    const result = await new CheckCartStockUseCase(
      cartRepository([cartItem(2)]),
      variants
    ).execute("user-1");

    expect(variants.findSellableByProducts).toHaveBeenCalledWith(["product-1"]);
    expect(result.lines[0]?.alternatives).toEqual([
      {
        variantId: "variant-3",
        label: "Black / M",
        size: "M",
        color: "Black",
        available: 3,
        sameSize: false,
        sameColor: true,
      },
    ]);
  });
});
