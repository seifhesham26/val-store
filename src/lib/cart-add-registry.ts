/**
 * Cart add registry
 *
 * The debounce and delta bookkeeping behind an optimistic add-to-cart, kept
 * free of React so it can be shared and tested the same way
 * `cart-sync-registry.ts` and `variant-stock-registry.ts` are.
 *
 * **`cart.add` is additive.** `cart.repository.ts` computes
 * `existing.quantity + cartItem.quantity`, which is exactly why a naive
 * debounce is wrong here: collapsing thirty presses into one `quantity: 30`
 * call is right, but only because 30 is the *delta*. Sending the line's new
 * total would double-count whatever the line already held.
 *
 * **This registry accumulates; `cart-sync-registry` replaces.** There, a second
 * `updateQuantity` for the same line supersedes the first, because an absolute
 * quantity is last-call-wins. Here a second press must add to what is pending.
 * Reversing the two is the mistake this comment exists to prevent.
 *
 * **Queued and in-flight units are counted separately.** Presses that land
 * while a call is on the wire arm a *second* additive call rather than growing
 * the first, so a failure rolls back exactly what it sent and a success clears
 * exactly what was confirmed.
 *
 * A module-scope singleton, created once in `cart-provider.tsx` — several cart
 * surfaces are co-mounted on any page, and a registry scoped inside `useCart()`
 * would give each of them its own timers.
 */

/**
 * Adds share the quantity-edit debounce window — one feel, one number.
 *
 * Kept in step with `CART_UPDATE_DEBOUNCE_MS` rather than imported from it:
 * `cart-sync-registry.ts` imports `cartAddKey` from this module, and a cycle
 * whose head is a const read during module evaluation can resolve to
 * `undefined` depending on load order. Same reasoning as `STOCK_STALE_MS` and
 * `GRID_REFRESH_MS`.
 */
export const CART_ADD_DEBOUNCE_MS = 1000;

/**
 * Identity of a cart line before it has a server row.
 *
 * The same shirt in M and L are two lines, so the key is product *and*
 * variant. A variant-less product gets a placeholder rather than an empty
 * segment, so `p1:` and `p1` can never collide.
 */
export function cartAddKey(
  productId: string,
  variantId: string | null
): string {
  return `${productId}:${variantId ?? "-"}`;
}

/** Issues one additive `cart.add` for the accumulated delta. */
export type CartAddRun = (totalDelta: number) => Promise<void>;

export interface CartAddRegistry {
  /**
   * Add `delta` units to what is pending for `key` and re-arm the debounce.
   * Accumulates — it does not replace what was already queued.
   */
  queueAdd(key: string, delta: number, run: CartAddRun): void;
  /** Units the server has not confirmed: queued plus in flight. */
  pendingDelta(key: string): number;
  /** True while anything is queued or in flight for `key`. */
  isPending(key: string): boolean;
  /**
   * Drop the queued units for one key. A call already on the wire is left to
   * settle — the request is out, and pretending otherwise would leave the
   * local cart disagreeing with a write the server is about to commit.
   */
  cancel(key: string): void;
  /** Drop every queued delta — the clearCart case. */
  cancelAll(): void;
  /**
   * Fire every armed timer now and resolve once every triggered call, and any
   * call already in flight, has settled. Awaited before checkout.
   */
  flushAll(): Promise<void>;
  /** Notified whenever a pending delta changes. Drives the "Added N" counter. */
  subscribe(listener: () => void): () => void;
}

interface Entry {
  /** Units pressed but not yet sent. */
  queued: number;
  /** Units handed to the server and not yet settled. */
  inFlight: number;
  run: CartAddRun;
  timer: ReturnType<typeof setTimeout> | null;
}

export function createCartAddRegistry(
  delayMs: number = CART_ADD_DEBOUNCE_MS
): CartAddRegistry {
  const entries = new Map<string, Entry>();
  const inFlight = new Set<Promise<void>>();
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  function prune(key: string, entry: Entry): void {
    if (entry.queued === 0 && entry.inFlight === 0 && entry.timer === null) {
      entries.delete(key);
    }
  }

  function fire(key: string): void {
    const entry = entries.get(key);
    if (!entry) return;

    entry.timer = null;
    const amount = entry.queued;
    if (amount === 0) {
      prune(key, entry);
      return;
    }

    entry.queued = 0;
    entry.inFlight += amount;
    notify();

    const promise = (async () => {
      try {
        await entry.run(amount);
      } catch {
        // The caller owns its own failure handling — it has to take the units
        // back out of the local store and offer a retry, which needs the
        // error. This catch only stops an unhandled rejection escaping the
        // registry.
      } finally {
        entry.inFlight -= amount;
        prune(key, entry);
        notify();
      }
    })();

    inFlight.add(promise);
    void promise.finally(() => {
      inFlight.delete(promise);
    });
  }

  function pendingDelta(key: string): number {
    const entry = entries.get(key);
    return entry ? entry.queued + entry.inFlight : 0;
  }

  function cancel(key: string): void {
    const entry = entries.get(key);
    if (!entry) return;

    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    entry.queued = 0;
    prune(key, entry);
    notify();
  }

  return {
    queueAdd(key, delta, run) {
      const entry: Entry = entries.get(key) ?? {
        queued: 0,
        inFlight: 0,
        run,
        timer: null,
      };

      entry.queued += delta;
      // The latest closure wins: it carries the freshest product details for
      // the retry toast, and the delta it will be handed is the accumulated
      // total either way.
      entry.run = run;

      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => fire(key), delayMs);

      entries.set(key, entry);
      notify();
    },

    pendingDelta,

    isPending(key) {
      return pendingDelta(key) > 0;
    },

    cancel,

    cancelAll() {
      for (const key of [...entries.keys()]) cancel(key);
    },

    async flushAll() {
      for (const [key, entry] of [...entries]) {
        if (!entry.timer) continue;
        clearTimeout(entry.timer);
        entry.timer = null;
        fire(key);
      }
      // allSettled, not all: a rejected add is the caller's problem to report,
      // not a reason to leave checkout hanging.
      await Promise.allSettled([...inFlight]);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
