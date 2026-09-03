/**
 * What the checkout success page should say.
 *
 * Extracted from the page because it is the part that was wrong, and the part
 * a component test cannot reach — there is no DOM testing library here, so the
 * convention (see `variant-stock-registry.ts`) is to lift the decision out of
 * React and test it directly.
 *
 * The page previously rendered "Thank you for your order!" unconditionally. It
 * read `confirmSession`'s result only to decide whether to clear the local
 * cart, and the mutation had no `onError` at all. `confirmSession` returns
 * `{ paid: false, … }` as an ordinary result when Stripe reports the session
 * unpaid — so both an unpaid checkout and a confirmation that failed outright
 * thanked the customer for an order nobody had paid for.
 */
export type CheckoutOutcome =
  /** A card checkout still being confirmed with the server. */
  | "confirming"
  /** Paid card order, or a placed cash-on-delivery order. */
  | "placed"
  /** Stripe says this session was not paid. Nothing was charged. */
  | "unpaid"
  /** The confirmation call failed. Genuinely unknown from the browser. */
  | "unconfirmed"
  /** Reached with no order at all — a stale bookmark or a stray link. */
  | "nothing";

export interface CheckoutOutcomeInput {
  /** `session_id` from the URL — present only when returning from Stripe. */
  sessionId: string | null;
  /** `order_id` from the URL — present only on the cash-on-delivery redirect. */
  orderId: string | null;
  /** Did the confirm mutation itself fail (network, auth, server)? */
  confirmFailed: boolean;
  /** The confirm mutation's result, once it has one. */
  confirmResult: { paid: boolean } | undefined;
}

/**
 * Resolve the one thing that is true.
 *
 * `sessionId` wins over `orderId`: a card return is the case that has to be
 * confirmed with the server before anything is claimed, and claiming success
 * because some other parameter happens to be present is exactly the bug.
 *
 * `unconfirmed` is deliberately not phrased as failure anywhere downstream. The
 * Stripe webhook may mark the order paid a moment later, so from the browser
 * this state is unknown rather than bad — telling the customer their payment
 * failed would be its own kind of lie, and would invite a second payment.
 */
export function resolveCheckoutOutcome({
  sessionId,
  orderId,
  confirmFailed,
  confirmResult,
}: CheckoutOutcomeInput): CheckoutOutcome {
  if (sessionId) {
    if (confirmFailed) return "unconfirmed";
    if (!confirmResult) return "confirming";
    return confirmResult.paid ? "placed" : "unpaid";
  }

  // Cash on delivery: the order was committed server-side before the redirect,
  // so its presence in the URL is the confirmation.
  if (orderId) return "placed";

  return "nothing";
}

/**
 * May the local cart be emptied on arrival?
 *
 * Only for a cash-on-delivery order, which the server has already cleared. A
 * card return must wait for `confirmSession` to report `paid`, because an
 * abandoned checkout has to keep the customer's cart.
 *
 * The guard on `orderId` is the fix for a smaller bug alongside the main one:
 * the effect cleared the cart whenever `session_id` was absent, so merely
 * opening `/checkout/success` — a stale bookmark, a shared link, a
 * back-navigation that dropped the query string — wiped the cart of somebody
 * who had not ordered anything.
 */
export function shouldClearCartOnArrival(
  input: Pick<CheckoutOutcomeInput, "sessionId" | "orderId">
): boolean {
  return !input.sessionId && Boolean(input.orderId);
}
