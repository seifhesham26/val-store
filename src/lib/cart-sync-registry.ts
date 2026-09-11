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
 * `ProductDetail`, `QuickAddBar` — several of them co-mounted on any
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

import { cartAddKey } from "./cart-add-registry";

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
  /**
   * Fire every armed timer now and resolve once every triggered write, and any
   * write already in flight, has settled. Awaited before checkout, so the
   * order is never priced against a cart the server has not caught up to.
   */
  flushAll(): Promise<void>;
}

export function createCartSyncRegistry(
  delayMs: number = CART_UPDATE_DEBOUNCE_MS
): CartSyncRegistry {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  // The write each armed timer is holding, so `flushAll` can fire it early.
  const runs = new Map<string, () => Promise<void>>();
  // Ids with a write scheduled *or* currently awaiting the server. A timer
  // alone isn't the whole story — the gap between the timer firing and the
  // mutation settling is exactly when a `cart.get` refetch could land and
  // overwrite the optimistic value with the pre-edit quantity.
  const pending = new Set<string>();
  // Outstanding write promises, so `flushAll` can await them.
  const inFlight = new Set<Promise<void>>();

  function cancel(cartItemId: string): void {
    const timer = timers.get(cartItemId);
    if (timer) {
      clearTimeout(timer);
      timers.delete(cartItemId);
    }
    runs.delete(cartItemId);
    pending.delete(cartItemId);
  }

  function fire(cartItemId: string): void {
    timers.delete(cartItemId);
    const run = runs.get(cartItemId);
    runs.delete(cartItemId);
    if (!run) return;

    // Stay "pending" until the mutation itself settles, not just until the
    // timer fires — the caller is expected to catch its own rejection (see
    // cart-provider.tsx) so it can toast and reconcile; this only needs to
    // know when the line is safe for the sync effect to overwrite again. The
    // `.catch` here is a backstop so a caller that forgets to handle its own
    // rejection cannot produce an unhandled promise rejection — it does not
    // hide the error from whatever `run` itself does with it.
    const promise = run()
      .catch(() => {})
      .finally(() => {
        pending.delete(cartItemId);
      });

    inFlight.add(promise);
    void promise.finally(() => {
      inFlight.delete(promise);
    });
  }

  return {
    scheduleUpdate(cartItemId, run) {
      // Replaces, rather than adds to, whatever this id already had pending
      // — an absolute quantity is last-call-wins. (`cart-add-registry`
      // accumulates instead, because `cart.add` is additive.)
      cancel(cartItemId);
      pending.add(cartItemId);
      runs.set(cartItemId, run);
      timers.set(
        cartItemId,
        setTimeout(() => fire(cartItemId), delayMs)
      );
    },

    cancel,

    cancelAll() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      runs.clear();
      pending.clear();
    },

    isPending(cartItemId) {
      return pending.has(cartItemId);
    },

    async flushAll() {
      for (const [cartItemId, timer] of [...timers]) {
        clearTimeout(timer);
        fire(cartItemId);
      }
      // allSettled, not all: a rejected write is the caller's problem to
      // report, not a reason to leave checkout hanging.
      await Promise.allSettled([...inFlight]);
    },
  };
}

/**
 * What the client currently believes it owes the server.
 *
 * Two registries answer this, keyed differently: a quantity edit is addressed
 * by cart item id, an add by product+variant (an added line may not have a
 * server row, and therefore no id, yet).
 */
export interface PendingCartWrites {
  /** True while `cartItemId` has a debounced quantity edit outstanding. */
  isPendingItem(cartItemId: string): boolean;
  /** True while `cartAddKey(productId, variantId)` has an add outstanding. */
  isPendingAdd(key: string): boolean;
}

/**
 * Merge a freshly-fetched server cart with what the local store already holds,
 * without letting the fetch clobber a write that has not landed yet.
 *
 * `cart.get` is refetched by *any* cart mutation's `invalidateCart()`, not just
 * the one for the line being edited. Three things have to survive that:
 *
 * 1. A line mid-quantity-edit keeps its local value, or it flips back to the
 *    pre-edit quantity and then forward again when the debounced write lands.
 * 2. A line with an add still queued keeps its local value too — the server
 *    row is genuinely *behind*, by exactly the delta still sitting in the add
 *    registry.
 * 3. A line that exists only locally, because its add has not been sent yet,
 *    has to be carried through. Mapping over server items alone dropped it,
 *    which made a just-added item vanish and reappear a second later.
 *
 * Once nothing is pending for a line, the server wins — including for a
 * local-only line, whose absence from the server then means the add failed or
 * was rolled back.
 */
export function reconcileServerCart<
  T extends { id: string; productId: string; variantId: string | null },
>(serverItems: T[], localItems: T[], pending: PendingCartWrites): T[] {
  const keyOf = (item: T) => cartAddKey(item.productId, item.variantId);

  const merged = serverItems.map((serverItem) => {
    const key = keyOf(serverItem);
    if (!pending.isPendingItem(serverItem.id) && !pending.isPendingAdd(key)) {
      return serverItem;
    }
    // Prefer the same row by id; fall back to the same product+variant, which
    // is how an optimistic `pending-` line matches the server row that has
    // just replaced it. If the local copy is somehow gone, the server's value
    // is better than dropping the line.
    return (
      localItems.find((item) => item.id === serverItem.id) ??
      localItems.find((item) => keyOf(item) === key) ??
      serverItem
    );
  });

  const serverKeys = new Set(serverItems.map(keyOf));
  const unsent = localItems.filter(
    (item) => !serverKeys.has(keyOf(item)) && pending.isPendingAdd(keyOf(item))
  );

  return [...merged, ...unsent];
}
