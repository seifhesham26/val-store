import { describe, it, expect, vi } from "vitest";
import { GetCartUseCase } from "./get-cart.use-case";
import { COUPON_RECHECK_MS } from "@/lib/cart-coupon-freshness";
import type { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import type { ValidateCouponUseCase } from "@/application/coupons/use-cases/validate-coupon.use-case";

const NOW = Date.now();

function repo(applied: { checkedAt: Date } | null): CartRepositoryInterface {
  return {
    findByUserId: vi.fn(async () => []),
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

describe("GetCartUseCase coupon freshness", () => {
  it("does not re-validate a coupon checked recently", async () => {
    const repository = repo({ checkedAt: new Date(NOW - 1000) });
    const validate = validator({ valid: true });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(validate.execute).not.toHaveBeenCalled();
    expect(result.appliedCoupon).toEqual({ code: "PROMO20" });
    expect(result.couponRemoved).toBeNull();
  });

  it("renews a stale coupon that is still valid", async () => {
    const repository = repo({
      checkedAt: new Date(NOW - COUPON_RECHECK_MS - 1000),
    });
    const validate = validator({
      valid: true,
      coupon: { id: "coupon-1", code: "PROMO20" },
    });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(validate.execute).toHaveBeenCalled();
    expect(repository.touchCouponCheckedAt).toHaveBeenCalledWith("user-1");
    expect(repository.clearAppliedCoupon).not.toHaveBeenCalled();
    expect(result.appliedCoupon).toEqual({ code: "PROMO20" });
  });

  it("drops a stale coupon that is no longer valid and says why", async () => {
    const repository = repo({
      checkedAt: new Date(NOW - COUPON_RECHECK_MS - 1000),
    });
    const validate = validator({
      valid: false,
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
});
