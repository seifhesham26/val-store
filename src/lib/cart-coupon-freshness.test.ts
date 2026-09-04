import { describe, it, expect } from "vitest";
import { COUPON_RECHECK_MS, needsRecheck } from "./cart-coupon-freshness";

const NOW = new Date("2026-09-03T12:00:00.000Z").getTime();

describe("needsRecheck", () => {
  it("rechecks a coupon that has never been checked", () => {
    // A coupon is validated when applied, so this should not happen — but a
    // null here means we cannot show it is fresh, and the safe answer to
    // "is this stale?" is yes.
    expect(needsRecheck(null, NOW)).toBe(true);
  });

  it("leaves a coupon checked a moment ago alone", () => {
    expect(needsRecheck(new Date(NOW - 1000), NOW)).toBe(false);
  });

  it("leaves a coupon checked just inside the window alone", () => {
    expect(needsRecheck(new Date(NOW - (COUPON_RECHECK_MS - 1)), NOW)).toBe(
      false
    );
  });

  it("rechecks exactly on the boundary", () => {
    expect(needsRecheck(new Date(NOW - COUPON_RECHECK_MS), NOW)).toBe(true);
  });

  it("rechecks a coupon checked long ago", () => {
    expect(needsRecheck(new Date(NOW - COUPON_RECHECK_MS * 100), NOW)).toBe(
      true
    );
  });

  it("does not recheck a timestamp from the future", () => {
    // Clock skew between the app and the database should not cause a storm
    // of re-validation.
    expect(needsRecheck(new Date(NOW + 60_000), NOW)).toBe(false);
  });

  it("is fifteen minutes", () => {
    expect(COUPON_RECHECK_MS).toBe(15 * 60 * 1000);
  });
});
