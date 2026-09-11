/**
 * What the checkout success page should say.
 *
 * Extracted from the page because it is the part that was wrong, and the part
 * a component test cannot reach — there is no DOM testing library here, so the
 * convention (see `variant-stock-registry.ts`) is to lift the decision out of
 * React and test it directly.
 *
 * Simplified once Stripe (and with it, the card-checkout confirmation flow
 * this used to arbitrate between "confirming"/"unpaid"/"unconfirmed") was
 * removed — cash on delivery is the only path, and the order is already
 * committed server-side by the time this page is reached.
 */
export type CheckoutOutcome =
  /** A cash-on-delivery order was placed. */
  | "placed"
  /** Reached with no order at all — a stale bookmark or a stray link. */
  | "nothing";

export interface CheckoutOutcomeInput {
  /** `order_id` from the URL, present on a real checkout redirect. */
  orderId: string | null;
}

/** `searchParams.get` returns `""` for `?order_id=`, which is not an order. */
export function resolveCheckoutOutcome({
  orderId,
}: CheckoutOutcomeInput): CheckoutOutcome {
  return orderId ? "placed" : "nothing";
}

/**
 * May the local cart be emptied on arrival?
 *
 * The server has already cleared it — this only mirrors that locally. Gated
 * on `orderId` rather than unconditional: merely opening
 * `/checkout/success` — a stale bookmark, a shared link, a back-navigation
 * that dropped the query string — must not wipe the cart of somebody who has
 * not ordered anything.
 */
export function shouldClearCartOnArrival(input: CheckoutOutcomeInput): boolean {
  return Boolean(input.orderId);
}
