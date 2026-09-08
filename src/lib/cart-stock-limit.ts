/**
 * Cart stock ceilings
 *
 * How many more of a thing the customer may add, given what they are already
 * holding.
 *
 * The server has always enforced this — `assertWithinStock` in the cart
 * repository checks `existing.quantity + requested <= stock` — but the client
 * did not know it, so the product page offered a stepper that ran to the raw
 * variant stock and the customer discovered the real limit by being refused.
 * The point here is not to replace the server check; it is that the interface
 * should be honest before the customer reaches the edge.
 *
 * Kept pure and free of React so the arithmetic is testable on its own, the
 * same way `cart-sync-registry.ts` and `variant-stock-registry.ts` are.
 */

/**
 * Hard bound on a single cart line, mirroring `MAX_LINE_QUANTITY` in
 * `src/server/routers/public/cart.ts`.
 *
 * This is not the stock limit — it is the bound on what the *input* may say at
 * all. A ceiling above it would produce a `cart.add` that Zod rejects before
 * any stock check runs, which reads to the customer as an unexplained failure
 * on a product that is plainly in stock.
 */
export const MAX_LINE_QUANTITY = 100;

/** The part of a cart line this module needs — a subset of `CartItem`. */
export interface CartLineIdentity {
  productId: string;
  variantId: string | null;
  quantity: number;
}

/**
 * How many of one product+variant the local cart is already holding.
 *
 * Summed rather than found, because an optimistic `pending-` line and the
 * server line it is about to be replaced by can coexist for one refetch.
 * Identity is product *and* variant: the same shirt in M and L are two lines.
 */
export function quantityInCart(
  items: readonly CartLineIdentity[],
  productId: string,
  variantId: string | null
): number {
  return items.reduce(
    (sum, item) =>
      item.productId === productId && item.variantId === variantId
        ? sum + item.quantity
        : sum,
    0
  );
}

/**
 * How many more units may be added right now.
 *
 * `liveStock` is null when no figure is available — before the first stock
 * poll lands, or for a product with no variant row to poll. In that case the
 * server stays the sole authority on stock and only the per-line bound
 * applies.
 *
 * Because adds are optimistic, `inCart` already includes presses that have not
 * reached the server yet, so this counts down as the customer presses without
 * needing to know what is in flight.
 */
export function remainingCapacity(
  liveStock: number | null,
  inCart: number
): number {
  const lineRoom = MAX_LINE_QUANTITY - inCart;
  const stockRoom = liveStock === null ? lineRoom : liveStock - inCart;
  return Math.max(0, Math.min(lineRoom, stockRoom));
}
