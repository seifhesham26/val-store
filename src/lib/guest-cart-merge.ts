/**
 * Guest cart merge
 *
 * The bookkeeping behind `cart.mergeGuestItems`, kept free of React (and of
 * Drizzle) so the merge rules can be reasoned about — and tested — on their
 * own. Same shape as `variant-stock-registry.ts`: a plain module the
 * provider and the use case both lean on instead of each re-deriving the
 * logic.
 *
 * A guest cart can sit in localStorage for days. By the time it merges, the
 * quantities are the only thing on it worth trusting — the price the client
 * remembers is display state, and the stock it remembers is a snapshot from
 * whenever the item was added. This module never reads either; the caller
 * resolves current stock from the database and passes it in via `stockFor`.
 */

export interface CartLineIdentity {
  productId: string;
  /** Null only for a product that has no variants at all. */
  variantId: string | null;
}

export interface GuestCartLine extends CartLineIdentity {
  quantity: number;
}

export interface ServerCartLine extends CartLineIdentity {
  /** Existing server-side cart item id. */
  id: string;
  quantity: number;
}

export interface MergedCartLine extends CartLineIdentity {
  /** The server row to update, or null when this line needs to be inserted. */
  existingId: string | null;
  /** Final quantity after summing duplicates and capping at stock. */
  quantity: number;
}

const lineKey = (line: CartLineIdentity): string =>
  `${line.productId}:${line.variantId ?? ""}`;

/**
 * Fold a guest's local cart lines into an authenticated user's server cart.
 *
 * Only lines the guest cart actually mentions are touched — a server line
 * the guest cart says nothing about is left alone. Duplicate
 * `productId + variantId` lines (repeats on the guest side, or a guest line
 * that matches an existing server line) sum into one quantity, then that sum
 * is capped at `stockFor(line)`. A line whose available stock has dropped to
 * zero is dropped from the result entirely — merging it in at quantity zero
 * would just be a different way of losing it.
 */
export function mergeGuestCartItems(
  serverItems: ServerCartLine[],
  guestItems: GuestCartLine[],
  stockFor: (line: CartLineIdentity) => number
): MergedCartLine[] {
  const serverByKey = new Map(serverItems.map((item) => [lineKey(item), item]));
  const sums = new Map<string, { line: CartLineIdentity; quantity: number }>();

  for (const guestLine of guestItems) {
    // A guest cart is unvalidated client state; a zero or negative quantity
    // has no business reaching the sum at all.
    if (guestLine.quantity < 1) continue;

    const key = lineKey(guestLine);
    const running = sums.get(key);
    const base = running?.quantity ?? serverByKey.get(key)?.quantity ?? 0;

    sums.set(key, {
      line: { productId: guestLine.productId, variantId: guestLine.variantId },
      quantity: base + guestLine.quantity,
    });
  }

  const merged: MergedCartLine[] = [];

  for (const [key, { line, quantity }] of sums) {
    const available = Math.max(0, stockFor(line));
    const finalQuantity = Math.min(quantity, available);
    if (finalQuantity < 1) continue;

    merged.push({
      productId: line.productId,
      variantId: line.variantId,
      existingId: serverByKey.get(key)?.id ?? null,
      quantity: finalQuantity,
    });
  }

  return merged;
}
