/**
 * Cancel Expired Checkouts Use Case
 *
 * Resolves card orders whose payment window elapsed without a confirmation.
 *
 * The important part is that "no confirmation" is not the same as "no
 * payment". The webhook may not be running at all — it never is in local
 * development — and the success page only confirms if the customer actually
 * lands on it. A customer who paid and closed the tab would otherwise have
 * their order cancelled and their stock returned while their card had been
 * charged.
 *
 * So every expired order is checked against Stripe before anything is done:
 *
 * - paid    → recover it. Mark it paid, exactly as the webhook would have.
 * - unpaid  → cancel it, returning stock and releasing any coupon.
 * - unknown → leave it alone and look again next time. Never destroy an order
 *             on the strength of a failed lookup.
 *
 * There is no scheduler here, so this runs lazily from read paths that are
 * already happening, throttled per process so they do not each pay for it.
 */

import { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import { PAYMENT_WINDOW_MS } from "@/domain/orders/entities/order.entity";
import { stripeService } from "@/infrastructure/services/stripe.service";

/** How often the sweep is allowed to run, per server process. */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * A minute past the deadline, so Stripe's own `checkout.session.expired` event
 * — which fires at the same instant — gets first go where it is being
 * delivered.
 */
const GRACE_MS = 60_000;

let lastSweep = 0;

export interface CancelExpiredCheckoutsResult {
  cancelled: number;
  /** Orders found to have been paid after all, and rescued. */
  recovered: number;
  /** Orders left alone because their status could not be established. */
  skipped: number;
}

export class CancelExpiredCheckoutsUseCase {
  constructor(private readonly orderRepository: OrderRepositoryInterface) {}

  async execute(): Promise<CancelExpiredCheckoutsResult> {
    const idle: CancelExpiredCheckoutsResult = {
      cancelled: 0,
      recovered: 0,
      skipped: 0,
    };

    const now = Date.now();
    if (now - lastSweep < SWEEP_INTERVAL_MS) return idle;
    lastSweep = now;

    try {
      const cutoff = new Date(now - PAYMENT_WINDOW_MS - GRACE_MS);
      const stale = await this.orderRepository.findExpiredCheckouts(cutoff);

      const result = { ...idle };

      for (const { orderId, sessionId } of stale) {
        try {
          const paid = await this.wasPaid(sessionId);

          if (paid === null) {
            // Could not tell. Leaving the order alone is always recoverable;
            // cancelling a paid order is not.
            result.skipped += 1;
            continue;
          }

          if (paid) {
            const recovered = await this.orderRepository.markAsPaid(orderId);

            // The third caller of `markAsPaid`, and the one nobody is
            // watching. The admin note is written inside the repository
            // transaction either way, but without this line an overrun
            // recovered by the sweep leaves no trace in the request log —
            // unlike the webhook and the success page, which both record it.
            if (recovered.couponLimitExceeded) {
              console.error(
                JSON.stringify({
                  error: "Coupon redeemed past its limit",
                  orderId,
                  source: "expiry-sweep",
                })
              );
            }

            result.recovered += 1;
            continue;
          }

          await this.orderRepository.updateStatus(orderId, "cancelled", {
            reason: "Payment window expired",
          });
          await this.orderRepository.markPaymentFailed(orderId);
          result.cancelled += 1;
        } catch (error) {
          // One bad order must not stop the rest being resolved.
          console.error(
            `[Orders] Failed to resolve expired checkout ${orderId}`,
            error instanceof Error ? error.message : error
          );
        }
      }

      return result;
    } catch (error) {
      // Housekeeping must never break the read that triggered it.
      console.error(
        "[Orders] Expiry sweep failed",
        error instanceof Error ? error.message : error
      );
      return idle;
    }
  }

  /**
   * Did this checkout actually get paid?
   *
   * Returns null when the answer cannot be established — no session recorded,
   * Stripe unreachable, credentials missing. The caller treats that as "do
   * nothing".
   */
  private async wasPaid(sessionId: string | null): Promise<boolean | null> {
    if (!sessionId) {
      // No session was ever created, so the customer was never given a chance
      // to pay. Safe to cancel.
      return false;
    }

    try {
      const session = await stripeService.getCheckoutSession(sessionId);
      return session.payment_status === "paid";
    } catch (error) {
      console.error(
        `[Orders] Could not read Stripe session ${sessionId}`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }
}
