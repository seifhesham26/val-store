import { describe, it, expect, vi } from "vitest";
import { GetCartUseCase } from "./get-cart.use-case";
import { COUPON_RECHECK_MS } from "@/lib/cart-coupon-freshness";
import { CartItemEntity } from "@/domain/cart/entities/cart-item.entity";
import type { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import type { ValidateCouponUseCase } from "@/application/coupons/use-cases/validate-coupon.use-case";

const NOW = Date.now();

/** One line, 2 x 250 — a cart with a realistic subtotal of 500. */
function cartLine(): CartItemEntity {
  return new CartItemEntity(
    "item-1",
    "user-1",
    "product-1",
    "Valkyrie Tee",
    250,
    null,
    2,
    10,
    new Date(NOW),
    new Date(NOW),
    "variant-1",
    "L",
    "Black"
  );
}

/**
 * The re-check tests must run against a cart that has something in it: a
 * coupon with a minimum purchase is rejected by any check made at subtotal 0,
 * so an empty-cart harness silently exercises a different branch.
 */
function repo(
  applied: { checkedAt: Date } | null,
  items: CartItemEntity[] = [cartLine()]
): CartRepositoryInterface {
  return {
    findByUserId: vi.fn(async () => items),
    getAppliedCoupon: vi.fn(async () =>
      applied
        ? {
            couponId: "coupon-1",
            code: "PROMO20",
            appliedAt: applied.checkedAt,
            checkedAt: applied.checkedAt,
          }
        : null
    ),
    getCartTotal: vi.fn(async () => 500),
    touchCouponCheckedAt: vi.fn(async () => undefined),
    clearAppliedCoupon: vi.fn(async () => undefined),
  } as unknown as CartRepositoryInterface;
}

function validator(result: unknown): ValidateCouponUseCase {
  return {
    execute: vi.fn(async () => result),
  } as unknown as ValidateCouponUseCase;
}

const STALE = { checkedAt: new Date(NOW - COUPON_RECHECK_MS - 1000) };

describe("GetCartUseCase coupon freshness", () => {
  it("does not re-validate a coupon checked recently", async () => {
    const repository = repo({ checkedAt: new Date(NOW - 1000) });
    const validate = validator({ valid: true });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(validate.execute).not.toHaveBeenCalled();
    // A read inside the window writes nothing at all.
    expect(repository.touchCouponCheckedAt).not.toHaveBeenCalled();
    expect(repository.clearAppliedCoupon).not.toHaveBeenCalled();
    expect(result.appliedCoupon).toEqual({ code: "PROMO20" });
    expect(result.couponRemoved).toBeNull();
  });

  it("renews a stale coupon that is still valid", async () => {
    const repository = repo(STALE);
    const validate = validator({
      valid: true,
      coupon: { id: "coupon-1", code: "PROMO20" },
    });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(validate.execute).toHaveBeenCalled();
    // The user id is what enables the per-user-limit and pending-order
    // checks; dropping it would disable them silently.
    expect(validate.execute).toHaveBeenCalledWith(
      "PROMO20",
      expect.any(Number),
      "user-1"
    );
    expect(repository.touchCouponCheckedAt).toHaveBeenCalledWith("user-1");
    expect(repository.clearAppliedCoupon).not.toHaveBeenCalled();
    expect(result.appliedCoupon).toEqual({ code: "PROMO20" });
  });

  it("re-validates against the cart's real subtotal", async () => {
    const repository = repo(STALE);
    const validate = validator({ valid: true });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(result.subtotal).toBe(500);
    expect(validate.execute).toHaveBeenCalledWith("PROMO20", 500, "user-1");
  });

  it("drops a stale coupon that is no longer valid and says why", async () => {
    const repository = repo(STALE);
    const validate = validator({
      valid: false,
      reason: "expired",
      error: "This coupon has expired",
    });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(repository.clearAppliedCoupon).toHaveBeenCalledWith("user-1");
    expect(result.appliedCoupon).toBeNull();
    expect(result.couponRemoved).toEqual({
      code: "PROMO20",
      reason: "This coupon has expired",
    });
  });

  it("keeps a stale coupon rejected only for being below the minimum", async () => {
    const repository = repo(STALE);
    const validate = validator({
      valid: false,
      reason: "below_minimum",
      error: "Minimum purchase of EGP 1,000.00 required",
    });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(repository.clearAppliedCoupon).not.toHaveBeenCalled();
    expect(repository.touchCouponCheckedAt).not.toHaveBeenCalled();
    expect(result.appliedCoupon).toEqual({ code: "PROMO20" });
    expect(result.couponRemoved).toBeNull();
  });

  it("keeps a stale coupon held up by the customer's own unpaid order", async () => {
    const repository = repo(STALE);
    const validate = validator({
      valid: false,
      reason: "pending_order",
      error: "You already have an unpaid order using this coupon.",
    });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(repository.clearAppliedCoupon).not.toHaveBeenCalled();
    expect(result.appliedCoupon).toEqual({ code: "PROMO20" });
    expect(result.couponRemoved).toBeNull();
  });

  it("does not judge a held coupon against an empty cart", async () => {
    const repository = repo(STALE, []);
    const validate = validator({
      valid: false,
      reason: "below_minimum",
      error: "Minimum purchase of EGP 1,000.00 required",
    });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(validate.execute).not.toHaveBeenCalled();
    expect(repository.clearAppliedCoupon).not.toHaveBeenCalled();
    expect(repository.touchCouponCheckedAt).not.toHaveBeenCalled();
    expect(result.isEmpty).toBe(true);
    expect(result.appliedCoupon).toEqual({ code: "PROMO20" });
    expect(result.couponRemoved).toBeNull();
  });

  it("keeps the coupon and still renders when the re-check throws", async () => {
    const repository = repo(STALE);
    const validate = {
      execute: vi.fn(async () => {
        throw new Error("coupon lookup exploded");
      }),
    } as unknown as ValidateCouponUseCase;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(repository.clearAppliedCoupon).not.toHaveBeenCalled();
    expect(repository.touchCouponCheckedAt).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.appliedCoupon).toEqual({ code: "PROMO20" });
    expect(result.couponRemoved).toBeNull();
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });

  it("says nothing about coupons when none is applied", async () => {
    const repository = repo(null);
    const validate = validator({ valid: true });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(validate.execute).not.toHaveBeenCalled();
    expect(result.appliedCoupon).toBeNull();
    expect(result.couponRemoved).toBeNull();
  });

  it("never reports a discount amount — checkout prices the coupon", async () => {
    const repository = repo(STALE);
    const validate = validator({
      valid: true,
      coupon: { id: "coupon-1", code: "PROMO20" },
      discountAmount: 100,
    });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(result.appliedCoupon).toEqual({ code: "PROMO20" });
    expect(JSON.stringify(result)).not.toContain("discount");
    expect(result.subtotal).toBe(500);
  });
});
