import { describe, it, expect, vi } from "vitest";
import { ApplyCouponUseCase } from "./apply-coupon.use-case";
import type { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import type { ValidateCouponUseCase } from "@/application/coupons/use-cases/validate-coupon.use-case";

function cartRepo(subtotal: number): CartRepositoryInterface {
  return {
    getCartTotal: vi.fn(async () => subtotal),
    setAppliedCoupon: vi.fn(async () => undefined),
    clearAppliedCoupon: vi.fn(async () => undefined),
  } as unknown as CartRepositoryInterface;
}

function validator(result: unknown): ValidateCouponUseCase {
  return {
    execute: vi.fn(async () => result),
  } as unknown as ValidateCouponUseCase;
}

describe("ApplyCouponUseCase", () => {
  it("refuses an empty cart without consulting the validator", async () => {
    const repo = cartRepo(0);
    const validate = validator({ valid: true });

    const result = await new ApplyCouponUseCase(repo, validate).execute({
      userId: "user-1",
      code: "PROMO20",
    });

    expect(result.applied).toBe(false);
    expect(result.error).toMatch(/add something to your cart/i);
    expect(validate.execute).not.toHaveBeenCalled();
    expect(repo.setAppliedCoupon).not.toHaveBeenCalled();
  });

  it("stores a valid coupon", async () => {
    const repo = cartRepo(500);
    const validate = validator({
      valid: true,
      coupon: { id: "coupon-1", code: "PROMO20" },
      discountAmount: 100,
    });

    const result = await new ApplyCouponUseCase(repo, validate).execute({
      userId: "user-1",
      code: "promo20",
    });

    expect(result).toEqual({ applied: true, code: "PROMO20" });
    expect(repo.setAppliedCoupon).toHaveBeenCalledWith("user-1", "coupon-1");
  });

  it("validates against the cart's own subtotal", async () => {
    const repo = cartRepo(750);
    const validate = validator({
      valid: true,
      coupon: { id: "coupon-1", code: "PROMO20" },
    });

    await new ApplyCouponUseCase(repo, validate).execute({
      userId: "user-1",
      code: "PROMO20",
    });

    expect(validate.execute).toHaveBeenCalledWith("PROMO20", 750, "user-1");
  });

  it("passes the validator's own message through on refusal", async () => {
    const repo = cartRepo(500);
    const validate = validator({
      valid: false,
      error: "This coupon has expired",
    });

    const result = await new ApplyCouponUseCase(repo, validate).execute({
      userId: "user-1",
      code: "OLD",
    });

    expect(result).toEqual({
      applied: false,
      error: "This coupon has expired",
    });
    expect(repo.setAppliedCoupon).not.toHaveBeenCalled();
  });

  it("does not store a coupon the validator accepted without an id", async () => {
    // Defensive: `valid: true` with no coupon would otherwise write undefined.
    const repo = cartRepo(500);
    const validate = validator({ valid: true });

    const result = await new ApplyCouponUseCase(repo, validate).execute({
      userId: "user-1",
      code: "PROMO20",
    });

    expect(result.applied).toBe(false);
    expect(repo.setAppliedCoupon).not.toHaveBeenCalled();
  });
});
