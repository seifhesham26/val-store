import { describe, it, expect, vi } from "vitest";
import {
  ValidateCouponUseCase,
  isTransientCouponRejection,
  type CouponRejectionReason,
} from "./validate-coupon.use-case";
import type { CouponRepositoryInterface } from "@/domain/coupons/interfaces/repositories/coupon.repository.interface";
import type { Coupon } from "@/db/schema";
import { PAYMENT_WINDOW_MS } from "@/domain/orders/entities/order.entity";

/**
 * A coupon row as the database hands it back: money is decimal *strings*, the
 * nullable columns really are null, and `perUserLimit` is non-null with a
 * default of 1 — so every call carrying a userId walks the per-user branch.
 */
function coupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: "coupon-1",
    code: "PROMO20",
    description: null,
    discountType: "percentage",
    discountValue: "20.00",
    minPurchaseAmount: null,
    maxDiscountAmount: null,
    usageLimit: null,
    usageCount: 0,
    perUserLimit: 1,
    isActive: true,
    startsAt: null,
    expiresAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function couponRepo(
  found: Coupon | null,
  counts: { userUsage?: number; pending?: number } = {}
): CouponRepositoryInterface {
  return {
    findByCode: vi.fn(async () => found),
    getUserUsageCount: vi.fn(async () => counts.userUsage ?? 0),
    countPendingOrders: vi.fn(async () => counts.pending ?? 0),
  } as unknown as CouponRepositoryInterface;
}

const ALL_REASONS: CouponRejectionReason[] = [
  "not_found",
  "inactive",
  "not_yet_valid",
  "expired",
  "usage_limit",
  "global_pending",
  "user_limit",
  "pending_order",
  "below_minimum",
];

describe("ValidateCouponUseCase rejection reasons", () => {
  // Each of these is the tag GetCartUseCase reads to decide whether to delete
  // a customer's applied coupon. A reason pasted onto the wrong branch is
  // silent in both directions: a dead coupon that never goes away, or a good
  // one deleted the moment the cart dips below its minimum.

  it("tags an unknown code not_found", async () => {
    const repo = couponRepo(null);

    const result = await new ValidateCouponUseCase(repo).execute("NOPE", 500);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("not_found");
  });

  it("tags a deactivated coupon inactive", async () => {
    const repo = couponRepo(coupon({ isActive: false }));

    const result = await new ValidateCouponUseCase(repo).execute(
      "PROMO20",
      500
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("inactive");
  });

  it("tags a coupon that has not started not_yet_valid", async () => {
    const repo = couponRepo(
      coupon({ startsAt: new Date(Date.now() + 60 * 60 * 1000) })
    );

    const result = await new ValidateCouponUseCase(repo).execute(
      "PROMO20",
      500
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("not_yet_valid");
  });

  it("tags a past expiry expired", async () => {
    const repo = couponRepo(
      coupon({ expiresAt: new Date(Date.now() - 60 * 60 * 1000) })
    );

    const result = await new ValidateCouponUseCase(repo).execute(
      "PROMO20",
      500
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("tags an exhausted global limit usage_limit", async () => {
    const repo = couponRepo(coupon({ usageLimit: 10, usageCount: 10 }));

    const result = await new ValidateCouponUseCase(repo).execute(
      "PROMO20",
      500
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("usage_limit");
  });

  it("tags the last slots being held by unpaid checkouts global_pending", async () => {
    // The last redemption is spoken for by an order nobody has paid for yet.
    // That order expires on its own and the slot comes back, so this is a fact
    // about the store right now, not about the coupon — tagged apart from
    // usage_limit so a cart holding the code keeps it.
    const repo = couponRepo(coupon({ usageLimit: 10, usageCount: 9 }), {
      pending: 1,
    });

    const result = await new ValidateCouponUseCase(repo).execute(
      "PROMO20",
      500
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("global_pending");
  });

  it("still tags a spent coupon usage_limit when checkouts are also in flight", async () => {
    // Redemptions alone have reached the limit, so the pending count cannot
    // change the answer — and the query for it is never issued.
    const repo = couponRepo(coupon({ usageLimit: 10, usageCount: 10 }), {
      pending: 3,
    });

    const result = await new ValidateCouponUseCase(repo).execute(
      "PROMO20",
      500
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("usage_limit");
    expect(repo.countPendingOrders).not.toHaveBeenCalled();
  });

  it("only counts unpaid checkouts inside the payment window", async () => {
    const repo = couponRepo(coupon({ usageLimit: 10, usageCount: 0 }));
    const before = Date.now();

    await new ValidateCouponUseCase(repo).execute("PROMO20", 500);

    expect(repo.countPendingOrders).toHaveBeenCalledTimes(1);
    const [couponId, since] = vi.mocked(repo.countPendingOrders).mock
      .calls[0] as [string, Date];
    expect(couponId).toBe("coupon-1");
    expect(since.getTime()).toBeGreaterThanOrEqual(before - PAYMENT_WINDOW_MS);
    expect(since.getTime()).toBeLessThanOrEqual(Date.now() - PAYMENT_WINDOW_MS);
  });

  it("tags a spent per-user allowance user_limit", async () => {
    const repo = couponRepo(coupon({ perUserLimit: 1 }), { userUsage: 1 });

    const result = await new ValidateCouponUseCase(repo).execute(
      "PROMO20",
      500,
      "user-1"
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("user_limit");
  });

  it("tags the customer's own unpaid order pending_order", async () => {
    // Nothing redeemed yet, but this customer is already carrying the code
    // through a checkout they have not paid for.
    const repo = couponRepo(coupon({ perUserLimit: 1 }), {
      userUsage: 0,
      pending: 1,
    });

    const result = await new ValidateCouponUseCase(repo).execute(
      "PROMO20",
      500,
      "user-1"
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("pending_order");
  });

  it("tags a subtotal under the minimum below_minimum", async () => {
    const repo = couponRepo(coupon({ minPurchaseAmount: "50.00" }));

    const result = await new ValidateCouponUseCase(repo).execute(
      "PROMO20",
      20,
      "user-1"
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("below_minimum");
    expect(result.error).toMatch(/minimum purchase/i);
  });

  it("accepts a subtotal exactly on the minimum", async () => {
    const repo = couponRepo(coupon({ minPurchaseAmount: "50.00" }));

    const result = await new ValidateCouponUseCase(repo).execute(
      "PROMO20",
      50,
      "user-1"
    );

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("never returns a reason on the valid path", async () => {
    const repo = couponRepo(coupon());

    const result = await new ValidateCouponUseCase(repo).execute(
      "PROMO20",
      500,
      "user-1"
    );

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.error).toBeUndefined();
  });
});

describe("ValidateCouponUseCase discount amounts", () => {
  it("takes a percentage of the subtotal", async () => {
    const repo = couponRepo(
      coupon({ discountType: "percentage", discountValue: "20.00" })
    );

    const result = await new ValidateCouponUseCase(repo).execute(
      "PROMO20",
      500
    );

    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(100);
    expect(result.coupon?.id).toBe("coupon-1");
  });

  it("takes a fixed amount whatever the subtotal", async () => {
    const repo = couponRepo(
      coupon({ discountType: "fixed", discountValue: "20.00" })
    );

    const result = await new ValidateCouponUseCase(repo).execute("FLAT20", 500);

    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(20);
  });

  it("caps a percentage at maxDiscountAmount", async () => {
    const repo = couponRepo(
      coupon({
        discountType: "percentage",
        discountValue: "50.00",
        maxDiscountAmount: "100.00",
      })
    );

    const result = await new ValidateCouponUseCase(repo).execute("HALF", 1000);

    expect(result.discountAmount).toBe(100);
  });

  it("never discounts more than the subtotal", async () => {
    const repo = couponRepo(
      coupon({ discountType: "fixed", discountValue: "200.00" })
    );

    const result = await new ValidateCouponUseCase(repo).execute("FLAT200", 80);

    expect(result.discountAmount).toBe(80);
  });

  it("rounds to two decimals", async () => {
    const repo = couponRepo(
      coupon({ discountType: "percentage", discountValue: "33.33" })
    );

    const result = await new ValidateCouponUseCase(repo).execute(
      "THIRD",
      99.99
    );

    expect(result.discountAmount).toBe(33.33);
  });
});

describe("isTransientCouponRejection", () => {
  // The drop rule in GetCartUseCase reads exactly this. A reason it calls
  // transient keeps the customer's code; anything else deletes it.
  const transient: CouponRejectionReason[] = [
    "below_minimum",
    "pending_order",
    "global_pending",
  ];

  for (const reason of ALL_REASONS) {
    const expected = transient.includes(reason);
    it(`returns ${expected} for ${reason}`, () => {
      expect(isTransientCouponRejection(reason)).toBe(expected);
    });
  }

  it("treats an untagged rejection as a dead coupon", () => {
    // Safe only because every branch above is tagged — that is what the
    // reason tests in this file exist to hold.
    expect(isTransientCouponRejection(undefined)).toBe(false);
  });
});
