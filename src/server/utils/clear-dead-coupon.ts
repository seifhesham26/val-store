/**
 * Dropping a checkout's held coupon, but only when the coupon is dead.
 *
 * A cart owns the applied coupon and checkout reads it from there, so when a
 * checkout use case throws there is a decision to make about the code the cart
 * is still holding. The throw itself says nothing about why: most failures —
 * an item that went out of stock, an address id that is not the caller's, a
 * gateway error — have nothing to do with the coupon at all, and clearing on
 * every failure would quietly cost the customer a discount that was never the
 * problem.
 *
 * This is the checkout half of one rule, the other half being the re-check in
 * `GetCartUseCase`: **drop a held coupon only for reasons that are properties
 * of the coupon** (expired, deactivated, spent, already used by this
 * customer), **never for reasons that are properties of the cart right now**
 * (below the minimum purchase, or the remaining slots held by other people's
 * in-flight checkouts, which expire on their own). Those transient reasons are
 * enumerated once, in `isTransientCouponRejection`.
 *
 * It lives here, as a plain function over injected dependencies, because it
 * was duplicated verbatim in both checkout handlers and no tRPC handler in
 * this repo is reachable from a unit test.
 */

import {
  isTransientCouponRejection,
  type ValidateCouponUseCase,
} from "@/application/coupons/use-cases/validate-coupon.use-case";
import type { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";

/**
 * What happened to the held coupon.
 *
 * `"failed"` is not an error the caller should act on — see the note on the
 * return value below.
 */
export type HeldCouponOutcome = "kept" | "cleared" | "failed";

/**
 * Narrowed to the two methods this needs, so the whole repository does not
 * have to be stood up to exercise the rule.
 */
export interface HeldCouponDeps {
  cartRepository: Pick<
    CartRepositoryInterface,
    "getCartTotal" | "clearAppliedCoupon"
  >;
  validateCoupon: Pick<ValidateCouponUseCase, "execute">;
}

/**
 * Re-validate the coupon the cart is holding and clear it only if it is dead.
 *
 * Returns:
 *   - `"kept"` — the coupon still validates, or is rejected for a transient
 *     reason. Nothing was written.
 *   - `"cleared"` — the coupon is dead and was removed from the cart.
 *   - `"failed"` — something threw and was swallowed. Nothing is guaranteed
 *     about the cart's state.
 *
 * **Never throws.** Every call site is inside a `catch` that is about to
 * rethrow the error which actually explains the failure, and a cleanup error
 * must never take that error's place — the customer would be told the coupon
 * could not be checked instead of that their card was declined.
 */
export async function clearHeldCouponIfDead(
  deps: HeldCouponDeps,
  userId: string,
  code: string
): Promise<HeldCouponOutcome> {
  try {
    // Re-read the total rather than trusting whatever the failed checkout
    // computed: the minimum-purchase test is only meaningful against the cart
    // as it stands now.
    const subtotal = await deps.cartRepository.getCartTotal(userId);
    const verdict = await deps.validateCoupon.execute(code, subtotal, userId);

    if (verdict.valid || isTransientCouponRejection(verdict.reason)) {
      return "kept";
    }

    await deps.cartRepository.clearAppliedCoupon(userId);
    return "cleared";
  } catch (error) {
    console.error(
      "[Checkout] classifying the applied coupon failed:",
      error instanceof Error ? error.message : String(error)
    );
    return "failed";
  }
}
