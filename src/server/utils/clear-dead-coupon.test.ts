import { describe, it, expect, vi } from "vitest";
import {
  clearHeldCouponIfDead,
  type HeldCouponDeps,
} from "./clear-dead-coupon";
import type {
  CouponRejectionReason,
  ValidateCouponResult,
} from "@/application/coupons/use-cases/validate-coupon.use-case";

const USER = "user-1";
const CODE = "PROMO20";
const SUBTOTAL = 250;

/** A dependency set whose cart is worth `SUBTOTAL` and whose validator says
 *  whatever the test needs it to. */
function deps(verdict: ValidateCouponResult, subtotal = SUBTOTAL) {
  const cartRepository = {
    getCartTotal: vi.fn(async () => subtotal),
    clearAppliedCoupon: vi.fn(async () => {}),
  };
  const validateCoupon = { execute: vi.fn(async () => verdict) };

  return { cartRepository, validateCoupon } satisfies HeldCouponDeps;
}

/** A rejection with no discount, as the use case returns one. */
function rejected(reason: CouponRejectionReason): ValidateCouponResult {
  return { valid: false, reason, error: `rejected: ${reason}` };
}

describe("a coupon that is dead is dropped", () => {
  it("clears an expired coupon", async () => {
    const d = deps(rejected("expired"));

    expect(await clearHeldCouponIfDead(d, USER, CODE)).toBe("cleared");
    expect(d.cartRepository.clearAppliedCoupon).toHaveBeenCalledWith(USER);
  });

  it("clears every rejection that is a property of the coupon", async () => {
    // The complement of `isTransientCouponRejection`. Listed out rather than
    // derived, so adding a reason to the union forces a decision here.
    const dead: CouponRejectionReason[] = [
      "not_found",
      "inactive",
      "not_yet_valid",
      "expired",
      "usage_limit",
      "user_limit",
    ];

    for (const reason of dead) {
      const d = deps(rejected(reason));

      expect(await clearHeldCouponIfDead(d, USER, CODE)).toBe("cleared");
      expect(d.cartRepository.clearAppliedCoupon).toHaveBeenCalledTimes(1);
    }
  });

  it("clears a rejection carrying no reason at all", async () => {
    // `reason` is optional, so an older or hand-built result can arrive
    // without one. Unrecognised means "not known to be transient".
    const d = deps({ valid: false, error: "Invalid coupon code" });

    expect(await clearHeldCouponIfDead(d, USER, CODE)).toBe("cleared");
    expect(d.cartRepository.clearAppliedCoupon).toHaveBeenCalledWith(USER);
  });
});

describe("a coupon that is merely ineligible right now is kept", () => {
  it("keeps a cart that is below the minimum purchase", async () => {
    // A property of the cart, not the coupon: adding an item revives it.
    const d = deps(rejected("below_minimum"));

    expect(await clearHeldCouponIfDead(d, USER, CODE)).toBe("kept");
    expect(d.cartRepository.clearAppliedCoupon).not.toHaveBeenCalled();
  });

  it("keeps a coupon whose slots are held by unpaid checkouts", async () => {
    // Those checkouts expire on their own and the slots come back.
    const d = deps(rejected("global_pending"));

    expect(await clearHeldCouponIfDead(d, USER, CODE)).toBe("kept");
    expect(d.cartRepository.clearAppliedCoupon).not.toHaveBeenCalled();
  });

  it("keeps a coupon this customer is holding on an unpaid order", async () => {
    const d = deps(rejected("pending_order"));

    expect(await clearHeldCouponIfDead(d, USER, CODE)).toBe("kept");
    expect(d.cartRepository.clearAppliedCoupon).not.toHaveBeenCalled();
  });

  it("keeps a coupon that still validates", async () => {
    // The common case: checkout failed for a reason that was never about the
    // coupon — no stock, a bad address id — and the discount must survive it.
    const d = deps({ valid: true, discountAmount: 50 });

    expect(await clearHeldCouponIfDead(d, USER, CODE)).toBe("kept");
    expect(d.cartRepository.clearAppliedCoupon).not.toHaveBeenCalled();
  });
});

describe("the coupon is re-priced against the cart as it stands", () => {
  it("validates the held code against the live subtotal for this user", async () => {
    const d = deps({ valid: true }, 99.5);

    await clearHeldCouponIfDead(d, USER, CODE);

    expect(d.cartRepository.getCartTotal).toHaveBeenCalledWith(USER);
    expect(d.validateCoupon.execute).toHaveBeenCalledWith(CODE, 99.5, USER);
  });
});

describe("cleanup never replaces the error that explains the failure", () => {
  it("swallows a validator that throws", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps({ valid: true });
    d.validateCoupon.execute.mockRejectedValueOnce(
      new Error("coupon lookup exploded")
    );

    expect(await clearHeldCouponIfDead(d, USER, CODE)).toBe("failed");
    expect(d.cartRepository.clearAppliedCoupon).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });

  it("swallows a clear that throws", async () => {
    // The verdict was dead, so the write was attempted and lost. The cart
    // keeps a coupon it should not have; that is strictly better than losing
    // the real error.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps(rejected("expired"));
    d.cartRepository.clearAppliedCoupon.mockRejectedValueOnce(
      new Error("write failed")
    );

    expect(await clearHeldCouponIfDead(d, USER, CODE)).toBe("failed");
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });

  it("swallows a cart-total read that throws", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps({ valid: true });
    d.cartRepository.getCartTotal.mockRejectedValueOnce(
      new Error("cart total exploded")
    );

    expect(await clearHeldCouponIfDead(d, USER, CODE)).toBe("failed");
    expect(d.validateCoupon.execute).not.toHaveBeenCalled();
    expect(d.cartRepository.clearAppliedCoupon).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });

  it("logs a thrown non-Error without stringifying it badly", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps({ valid: true });
    d.validateCoupon.execute.mockRejectedValueOnce("just a string");

    expect(await clearHeldCouponIfDead(d, USER, CODE)).toBe("failed");
    expect(logged).toHaveBeenCalledWith(
      "[Checkout] classifying the applied coupon failed:",
      "just a string"
    );

    logged.mockRestore();
  });
});
