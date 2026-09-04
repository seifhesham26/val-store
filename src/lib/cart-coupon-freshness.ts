/**
 * When an applied coupon is due a re-check.
 *
 * A coupon on a cart reserves nothing — it is remembered, not held — so this
 * interval is a freshness check rather than a deadline. A coupon that is still
 * valid renews and the customer keeps it; one that has since expired, been
 * deactivated, or hit its limit is dropped with a reason. Nothing about it is
 * shown to the customer as a countdown, because there is nothing to race.
 *
 * Kept free of React and of the database so the decision can be tested on its
 * own, the same reason `cart-sync-registry.ts` sits out here.
 */

/** How long a validation result is trusted before it is checked again. */
export const COUPON_RECHECK_MS = 15 * 60 * 1000;

/**
 * @param checkedAt when the coupon was last successfully validated, or null
 * @param now       current time in epoch milliseconds
 */
export function needsRecheck(checkedAt: Date | null, now: number): boolean {
  if (!checkedAt) return true;

  const age = now - checkedAt.getTime();

  // A future timestamp means clock skew, not staleness. Treating it as stale
  // would re-validate on every read until the clocks agreed.
  if (age < 0) return false;

  return age >= COUPON_RECHECK_MS;
}
