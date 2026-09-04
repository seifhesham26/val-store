/**
 * Cart sync registry
 *
 * The debounce/pending-write bookkeeping behind `useCart()`'s
 * `updateQuantity`, kept free of React so it can be shared and tested the
 * same way `variant-stock-registry.ts` is.
 *
 * Four cart findings turned out to be one design problem: `updateQuantity`
 * used to keep its debounce timers in a `useRef` *inside* `useCart()`, so
 * every component calling the hook (`CartDrawer`, `CartPopulated`,
 * `ProductDetail`, `QuickAddSliderBar` — several of them co-mounted on any
 * given page) got its own timer map instead of sharing one per cart line.
 * That let two surfaces editing the same line within a second arm two
 * timers that never cleared each other, and it meant `removeItem`/
 * `clearCart` had no way to reach a timer some *other* instance had armed,
 * so a debounced write could still fire against a row that no longer
 * existed.
 *
 * This registry is a module-scope singleton (created once in
 * `cart-provider.tsx`, the same way `useCartStore` itself is a module-scope
 * singleton) so every `useCart()` call shares one timer and one "is this
 * line mid-write" flag per cart item id, regardless of which component
 * asked.
 */

/** Matches the previous inline debounce in `cart-provider.tsx`. */
export const CART_UPDATE_DEBOUNCE_MS = 1000;

export interface CartSyncRegistry {
  /**
   * (Re)arm a debounced write for `cartItemId`. Scheduling again for the
   * same id cancels whatever was previously scheduled or in flight for it —
   * "last call wins," now shared across every `useCart()` instance rather
   * than scoped to one.
   *
   * `cartItemId` counts as pending (see `isPending`) from the moment this is
   * called until `run()` settles — covering both the debounce window and the
   * mutation itself, which is the whole window a server refetch could
   * otherwise clobber the optimistic value with a stale quantity.
   */
  scheduleUpdate(cartItemId: string, run: () => Promise<void>): void;
  /**
   * Cancel any pending write for one item — call before removing it so a
   * debounced update never fires against a row that is about to stop
   * existing.
   */
  cancel(cartItemId: string): void;
  /** Cancel every pending write — call before clearing the whole cart. */
  cancelAll(): void;
  /** True while `cartItemId` has a write scheduled or currently in flight. */
  isPending(cartItemId: string): boolean;
}

export function createCartSyncRegistry(
  delayMs: number = CART_UPDATE_DEBOUNCE_MS
): CartSyncRegistry {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  // Ids with a write scheduled *or* currently awaiting the server. A timer
  // alone isn't the whole story — the gap between the timer firing and the
  // mutation settling is exactly when a `cart.get` refetch could land and
  // overwrite the optimistic value with the pre-edit quantity.
  const pending = new Set<string>();

  function cancel(cartItemId: string): void {
    const timer = timers.get(cartItemId);
    if (timer) {
      clearTimeout(timer);
      timers.delete(cartItemId);
    }
    pending.delete(cartItemId);
  }

  return {
    scheduleUpdate(cartItemId, run) {
      // Replaces, rather than adds to, whatever this id already had pending
      // — matches the previous per-instance behaviour of clearing the prior
      // timer for the same item before arming a new one.
      cancel(cartItemId);
      pending.add(cartItemId);

      const timer = setTimeout(() => {
        timers.delete(cartItemId);
        // Stay "pending" until the mutation itself settles, not just until
        // the timer fires — the caller is expected to catch its own
        // rejection (see cart-provider.tsx) so it can toast and reconcile;
        // this only needs to know when the line is safe for the sync effect
        // to overwrite again. The `.catch` here is a backstop so a caller
        // that forgets to handle its own rejection cannot produce an
        // unhandled promise rejection — it does not hide the error from
        // whatever `run` itself does with it.
        void run()
          .catch(() => {})
          .finally(() => {
            pending.delete(cartItemId);
          });
      }, delayMs);
      timers.set(cartItemId, timer);
    },

    cancel,

    cancelAll() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      pending.clear();
    },

    isPending(cartItemId) {
      return pending.has(cartItemId);
    },
  };
}

/**
 * Merge a freshly-fetched server cart with what the local store already
 * holds, without letting the fetch clobber a line that has a write in
 * flight.
 *
 * `cart.get` is refetched by *any* cart mutation's `invalidateCart()`, not
 * just the one for the line being edited — add an item from the drawer
 * while a different line's debounced quantity edit is still pending, and
 * the refetch would otherwise overwrite that line with its pre-edit
 * quantity before the debounced write ever reaches the server.
 */
export function reconcileServerCart<T extends { id: string }>(
  serverItems: T[],
  localItems: T[],
  registry: Pick<CartSyncRegistry, "isPending">
): T[] {
  return serverItems.map((serverItem) => {
    if (!registry.isPending(serverItem.id)) {
      return serverItem;
    }
    // Keep whatever the customer is mid-edit on. If the local copy is
    // somehow gone (shouldn't happen — a pending id only exists for a line
    // that was just edited, not removed), fall back to the server's value
    // rather than dropping the line.
    return localItems.find((item) => item.id === serverItem.id) ?? serverItem;
  });
}
