# Optimistic Storefront and Cart Stock Ceilings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every storefront mutation update its UI before the server answers, and make add-to-cart a debounced local write that the client caps at available stock so the press past the ceiling never leaves the browser.

**Architecture:** Three new pure modules carry the logic — a delta-accumulating debounce registry for adds, a stock-ceiling calculator, and a cache-patch/rollback helper — each unit-tested without React. The React layer is a thin wrapper: `cart-provider.tsx` owns two module-scope registry singletons, and the remaining surfaces (wishlist, notifications, addresses, profile) use the patch helper inside the tRPC mutation callbacks they already have.

**Tech Stack:** Next.js 16 (App Router), React 19 with React Compiler, TypeScript strict, tRPC v11 over React Query, Zustand + `persist`, sonner, Vitest + jsdom, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-04-optimistic-storefront-design.md`

## Global Constraints

- **Do not commit.** The user reviews before committing. Every task's "Commit" step is replaced by "stage nothing, report the task complete." Leave the work as uncommitted changes in the working tree.
- **Branch:** work continues on `feat(optimistic)`. Do not rebase, reset, or revert.
- **Admin is out of scope.** Nothing under `src/app/admin/`, `src/components/admin/` or `src/server/routers/admin/` is touched.
- **Checkout, reviews and coupons stay pessimistic.** No optimistic patch on `public.checkout.*`, `public.reviews.*` or `public.coupons.*`.
- **The server remains the authority on stock.** Every client-side ceiling is an interface courtesy. Do not remove or weaken `assertWithinStock` in `src/infrastructure/database/repositories/cart/cart.repository.ts`, and do not change the additive semantics of `cart.add`.
- **`MAX_LINE_QUANTITY` is 100**, declared in `src/server/routers/public/cart.ts:21`. The client ceiling must never let a single `cart.add` call ask for more than 100, or Zod rejects it.
- **Debounce window is 1000ms** — `CART_UPDATE_DEBOUNCE_MS` in `src/lib/cart-sync-registry.ts`. Adds use the same window.
- **Registries are module-scope singletons**, created once in `cart-provider.tsx`. Never inside `useCart()`: several cart surfaces are co-mounted and must share one timer per key.
- **No `this` inside a registry.** Registry methods are passed around as bare function references (`cartAddRegistry.subscribe`, `cartAddRegistry.isPending`), so every method must close over locals rather than reading `this`.
- **Prettier:** double quotes, semicolons, 80 columns, es5 trailing commas, LF.
- **Clear `.next` before trusting type-check:** `rm -rf .next && pnpm type-check`. A stale `.next/dev/types/routes.d.ts` reports errors about routes that no longer exist.
- **Unit tests only.** `pnpm test` runs `src/**/*.test.ts{,x}` with no database and is what CI runs. There is no DOM testing library — do not add one, and do not write component tests. Client logic worth testing gets extracted into a plain module, which is what the three new modules are.
- **Integration tests are read-only by project rule.** This plan adds none.

## File Structure

| File                                                        | Responsibility                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/lib/optimistic-patches.ts`                             | **New.** `cachePatch` / `runOptimistic` — snapshot, patch, rollback, settle. Pure. |
| `src/lib/optimistic-patches.test.ts`                        | **New.** Unit tests for the above.                                                 |
| `src/lib/optimistic-toast.ts`                               | **New.** `showRetryToast(message, onRetry)` over sonner's action API.              |
| `src/lib/optimistic-toast.test.ts`                          | **New.** Asserts the action label and click wiring against a mocked sonner.        |
| `src/lib/cart-stock-limit.ts`                               | **New.** `quantityInCart` + `remainingCapacity`. Pure.                             |
| `src/lib/cart-stock-limit.test.ts`                          | **New.** The ceiling arithmetic, including the thirty-first-press guard.           |
| `src/lib/cart-add-registry.ts`                              | **New.** Delta-accumulating debounce registry + `cartAddKey`. Pure.                |
| `src/lib/cart-add-registry.test.ts`                         | **New.** Accumulation, in-flight separation, `flushAll`, `subscribe`.              |
| `src/lib/cart-sync-registry.ts`                             | Add `flushAll`; generalize `reconcileServerCart` to product+variant keys.          |
| `src/lib/cart-sync-registry.test.ts`                        | Update the five `reconcileServerCart` tests; add the carry-through cases.          |
| `src/lib/stores/cart-store.ts`                              | Add `PENDING_CART_ITEM_ID_PREFIX` + `isLocalOnlyCartItemId`; drop `isSyncing`.     |
| `src/components/providers/cart-provider.tsx`                | Optimistic `addItem`, retry toasts, `flushPendingWrites`, `useCartAddDelta`.       |
| `src/components/products/ProductDetail.tsx`                 | Ceiling from the local cart; no `isAdding`; no stock dialog.                       |
| `src/components/products/product-detail/ProductActions.tsx` | Drop `isAdding`; add the at-ceiling state.                                         |
| `src/components/products/QuickAddSliderBar.tsx`             | Ceiling; "Added N" counter; no auto-open drawer; no stock dialog.                  |
| `src/components/products/quick-add/QuickAddButton.tsx`      | Drop `isAdding`/`justAdded`; add `pendingAdded`/`atCeiling`.                       |
| `src/components/products/StockIssueDialog.tsx`              | **Deleted.** Its only two call sites lose the awaited error.                       |
| `src/components/cart/CartItem.tsx`                          | Drop the `disabled` prop.                                                          |
| `src/components/cart/CartDrawer.tsx`                        | Un-freeze; flush pending writes before navigating to checkout.                     |
| `src/components/cart/CartPopulated.tsx`                     | Un-freeze; flush pending writes before navigating to checkout.                     |
| `src/app/(main)/account/wishlist/page.tsx`                  | Optimistic removal.                                                                |
| `src/components/wishlist/WishlistButton.tsx`                | Re-expressed on the shared helpers.                                                |
| `src/components/UserNotificationsBell.tsx`                  | Optimistic mark-as-read and mark-all-read.                                         |
| `src/app/(main)/account/notifications/page.tsx`             | Optimistic read/mark-all/delete.                                                   |
| `src/app/(main)/account/addresses/page.tsx`                 | Optimistic create/update/delete/set-default.                                       |
| `src/components/account/profile/ProfileForm.tsx`            | Optimistic name change.                                                            |

**Naming that must stay consistent across tasks** (a mismatch here is the most likely bug in this plan):

- `cartAddKey(productId, variantId)` → `` `${productId}:${variantId ?? "-"}` ``
- `remainingCapacity(liveStock, inCart)` → `number`
- `quantityInCart(items, productId, variantId)` → `number`
- `runOptimistic(patches)` → `Promise<{ rollback(): void; settle(): void }>`
- `cachePatch({ cancel, read, write, invalidate, patch })` → `OptimisticPatch`
- `showRetryToast(message, onRetry)` → `void`
- `PENDING_CART_ITEM_ID_PREFIX` → `"pending-"`

**The retry-callback pattern, used in every task from 9 onward.** A mutation's `onError` needs to re-run that same mutation. Writing `removeMutation.mutate(...)` inside `removeMutation`'s own options makes TypeScript infer the mutation's type from options that depend on the mutation's type. Avoid it by hoisting a `function` declaration above the mutation:

```ts
function retryRemove(productId: string) {
  removeMutation.mutate({ productId });
}

const removeMutation = trpc.public.wishlist.removeFromWishlist.useMutation({
  onError: (_err, variables, handle) => {
    handle?.rollback();
    showRetryToast("...", () => retryRemove(variables.productId));
  },
});
```

Function declarations hoist, their parameter types are annotated, and their bodies are checked lazily — so nothing is circular.

## Two deliberate departures from the spec

**§1b is a module, not a hook.** The spec calls for `src/hooks/use-optimistic-mutation.ts`. A hook generic enough to accept any tRPC query util object cannot be typed without `any` at the boundary, and it would put the one part worth testing behind React. The plan ships `src/lib/optimistic-patches.ts` instead — pure, unit-tested, and used directly inside the `onMutate`/`onError`/`onSettled` callbacks each component already has. Same sequence, same guarantees, and it follows the repo's stated convention (`variant-stock-registry.ts` is the pattern: the logic lives outside React and the component is a thin wrapper).

**`StockIssueDialog` is deleted rather than kept.** The spec does not mention it. Its two call sites read a rejected add's error synchronously from a `catch`, and once the add resolves locally there is no rejection to catch — the server's message ("Only 2 left in stock") arrives instead as a retry toast from the provider. A component with no reachable caller is the dead code this repo has already cleared once, so Task 7 removes it. Flagged here because it is the one thing in this plan that deletes a working piece of UI.

---

### Task 1: The shared optimistic helpers

**Files:**

- Create: `src/lib/optimistic-patches.ts`
- Create: `src/lib/optimistic-patches.test.ts`
- Create: `src/lib/optimistic-toast.ts`
- Create: `src/lib/optimistic-toast.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `OptimisticPatch`, `CachePatchSpec<TData>`, `OptimisticHandle`, `cachePatch<TData>(spec): OptimisticPatch`, `runOptimistic(patches): Promise<OptimisticHandle>`, `showRetryToast(message: string, onRetry: () => void): void`, `RETRY_ACTION_LABEL`.

`WishlistButton.tsx:51-107` performs the cancel → snapshot → `setData` → rollback → invalidate sequence by hand, twice, in about 55 lines. That is why no other surface has it. These two modules are that sequence, made reusable and testable without React.

- [ ] **Step 1: Write the failing tests for the patch helpers**

Create `src/lib/optimistic-patches.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { cachePatch, runOptimistic } from "./optimistic-patches";

/** A stand-in for one tRPC query cache entry. */
function fakeCache<T>(initial: T | undefined, log: string[], name: string) {
  let value = initial;
  return {
    get value() {
      return value;
    },
    spec: {
      cancel: async () => {
        log.push(`cancel:${name}`);
      },
      read: () => value,
      write: (next: T | undefined) => {
        log.push(`write:${name}`);
        value = next;
      },
      invalidate: () => {
        log.push(`invalidate:${name}`);
      },
    },
  };
}

describe("cachePatch", () => {
  it("writes the patched value and restores the exact snapshot on rollback", () => {
    const log: string[] = [];
    const cache = fakeCache([1, 2, 3], log, "a");
    const patch = cachePatch({
      ...cache.spec,
      patch: (items) => items?.filter((n) => n !== 2),
    });

    patch.apply();
    expect(cache.value).toEqual([1, 3]);

    patch.rollback();
    expect(cache.value).toEqual([1, 2, 3]);
  });

  it("rollback before apply is a no-op — nothing was snapshotted", () => {
    const log: string[] = [];
    const cache = fakeCache("original", log, "a");
    const patch = cachePatch({ ...cache.spec, patch: () => "patched" });

    patch.rollback();

    expect(cache.value).toBe("original");
    expect(log).not.toContain("write:a");
  });

  it("rolling back twice restores the same snapshot, not the patched value", () => {
    const log: string[] = [];
    const cache = fakeCache(5, log, "a");
    const patch = cachePatch({ ...cache.spec, patch: (n) => (n ?? 0) + 1 });

    patch.apply();
    patch.rollback();
    patch.rollback();

    expect(cache.value).toBe(5);
  });

  it("handles an empty cache — patch sees undefined", () => {
    const log: string[] = [];
    const cache = fakeCache<number[]>(undefined, log, "a");
    const seen: unknown[] = [];
    const patch = cachePatch({
      ...cache.spec,
      patch: (items) => {
        seen.push(items);
        return items;
      },
    });

    patch.apply();
    expect(seen).toEqual([undefined]);
  });
});

describe("runOptimistic", () => {
  it("cancels every patch before applying any of them", async () => {
    // An in-flight refetch that resolves after setData would overwrite the
    // optimistic value, so every cancel must precede every write.
    const log: string[] = [];
    const a = fakeCache(1, log, "a");
    const b = fakeCache(2, log, "b");

    await runOptimistic([
      cachePatch({ ...a.spec, patch: (n) => (n ?? 0) + 10 }),
      cachePatch({ ...b.spec, patch: (n) => (n ?? 0) + 10 }),
    ]);

    expect(log).toEqual(["cancel:a", "cancel:b", "write:a", "write:b"]);
  });

  it("rollback restores every patch, in reverse order", async () => {
    const log: string[] = [];
    const a = fakeCache(1, log, "a");
    const b = fakeCache(2, log, "b");

    const handle = await runOptimistic([
      cachePatch({ ...a.spec, patch: () => 99 }),
      cachePatch({ ...b.spec, patch: () => 99 }),
    ]);
    log.length = 0;
    handle.rollback();

    expect(a.value).toBe(1);
    expect(b.value).toBe(2);
    expect(log).toEqual(["write:b", "write:a"]);
  });

  it("settle invalidates every patch", async () => {
    const log: string[] = [];
    const a = fakeCache(1, log, "a");
    const b = fakeCache(2, log, "b");

    const handle = await runOptimistic([
      cachePatch({ ...a.spec, patch: () => 99 }),
      cachePatch({ ...b.spec, patch: () => 99 }),
    ]);
    log.length = 0;
    handle.settle();

    expect(log).toEqual(["invalidate:a", "invalidate:b"]);
  });

  it("an empty patch list is legal", async () => {
    const handle = await runOptimistic([]);
    expect(() => handle.rollback()).not.toThrow();
    expect(() => handle.settle()).not.toThrow();
  });

  it("awaits asynchronous cancels", async () => {
    const order: string[] = [];
    const slowCancel = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push("cancelled");
    });

    await runOptimistic([
      cachePatch({
        cancel: slowCancel,
        read: () => 1,
        write: () => order.push("written"),
        invalidate: () => {},
        patch: () => 2,
      }),
    ]);

    expect(order).toEqual(["cancelled", "written"]);
  });
});
```

Create `src/lib/optimistic-toast.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { showRetryToast, RETRY_ACTION_LABEL } from "./optimistic-toast";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

describe("showRetryToast", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it("shows the message with a Retry action that runs the callback", () => {
    const onRetry = vi.fn();
    showRetryToast("Couldn't save that.", onRetry);

    expect(toast.error).toHaveBeenCalledTimes(1);
    const [message, options] = vi.mocked(toast.error).mock.calls[0];
    expect(message).toBe("Couldn't save that.");

    const action = (
      options as { action: { label: string; onClick: () => void } }
    ).action;
    expect(action.label).toBe(RETRY_ACTION_LABEL);

    expect(onRetry).not.toHaveBeenCalled();
    action.onClick();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/optimistic-patches.test.ts src/lib/optimistic-toast.test.ts`
Expected: FAIL — `Failed to resolve import "./optimistic-patches"` and `"./optimistic-toast"`.

- [ ] **Step 3: Write `src/lib/optimistic-patches.ts`**

```ts
/**
 * Optimistic cache patches
 *
 * The cancel -> snapshot -> setData -> rollback -> invalidate sequence that
 * React Query optimistic updates require, factored out of the components that
 * would otherwise each spell it out.
 *
 * `WishlistButton` was the only storefront surface that did this correctly,
 * and it cost about 25 lines per mutation — which is precisely why the other
 * ten mutations awaited a round trip and then invalidated instead. Kept free
 * of React and of tRPC so the ordering rules that actually matter (cancel
 * before write; roll back to the snapshot, never to a recomputed value) can be
 * tested directly, the same way `cart-sync-registry.ts` is.
 *
 * Type safety survives the erasure: `cachePatch` is generic and captures its
 * `TData` in a closure, so a heterogeneous array of `OptimisticPatch` needs no
 * `any` at the call site.
 */

/** One cache entry's worth of patch, with its type already erased. */
export interface OptimisticPatch {
  /** Stop any in-flight fetch that could land on top of the patch. */
  cancel: () => Promise<void>;
  /** Snapshot the current value, then write the patched one. */
  apply: () => void;
  /** Put the snapshot back. A no-op if `apply` never ran. */
  rollback: () => void;
  /** Refetch, once the mutation has settled either way. */
  invalidate: () => void;
}

export interface CachePatchSpec<TData> {
  cancel: () => Promise<unknown>;
  read: () => TData | undefined;
  write: (data: TData | undefined) => void;
  invalidate: () => unknown;
  /** Given the current cached value, return what the UI should show now. */
  patch: (current: TData | undefined) => TData | undefined;
}

/**
 * Bind one typed cache entry into an untyped `OptimisticPatch`.
 *
 * The snapshot is taken inside `apply`, not at construction: between building
 * the patch list and applying it there is an `await` on the cancels, and the
 * cache can change across it.
 */
export function cachePatch<TData>(
  spec: CachePatchSpec<TData>
): OptimisticPatch {
  let snapshot: TData | undefined;
  let applied = false;

  return {
    cancel: async () => {
      await spec.cancel();
    },
    apply: () => {
      snapshot = spec.read();
      applied = true;
      spec.write(spec.patch(snapshot));
    },
    rollback: () => {
      // Restoring a snapshot that was never taken would write `undefined` over
      // a perfectly good cache entry.
      if (!applied) return;
      spec.write(snapshot);
    },
    invalidate: () => {
      spec.invalidate();
    },
  };
}

export interface OptimisticHandle {
  /** Undo every patch. Call from the mutation's `onError`. */
  rollback: () => void;
  /** Invalidate every patched query. Call from `onSettled`. */
  settle: () => void;
}

/**
 * Cancel, then apply, a set of patches together.
 *
 * Every cancel completes before any write, because a refetch that resolves
 * after `setData` overwrites the optimistic value with the pre-mutation one —
 * the exact flicker this whole module exists to prevent.
 */
export async function runOptimistic(
  patches: readonly OptimisticPatch[]
): Promise<OptimisticHandle> {
  await Promise.all(patches.map((patch) => patch.cancel()));
  for (const patch of patches) patch.apply();

  return {
    rollback: () => {
      // Reverse order, so patches that read each other's caches unwind in the
      // order they were laid down.
      for (const patch of [...patches].reverse()) patch.rollback();
    },
    settle: () => {
      for (const patch of patches) patch.invalidate();
    },
  };
}
```

- [ ] **Step 4: Write `src/lib/optimistic-toast.ts`**

```ts
/**
 * Retry toast
 *
 * One shape for "that didn't save, and here is the button that tries again",
 * so a failed optimistic write looks the same on every surface. The revert
 * itself is the caller's job — this is only the affordance that follows it.
 */

import { toast } from "sonner";

export const RETRY_ACTION_LABEL = "Retry";

export function showRetryToast(message: string, onRetry: () => void): void {
  toast.error(message, {
    action: { label: RETRY_ACTION_LABEL, onClick: onRetry },
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/optimistic-patches.test.ts src/lib/optimistic-toast.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 6: Report the task complete**

Do not commit. Name the files added and confirm `pnpm vitest run src/lib/optimistic-patches.test.ts src/lib/optimistic-toast.test.ts` is green.

---

### Task 2: The stock ceiling

**Files:**

- Create: `src/lib/cart-stock-limit.ts`
- Create: `src/lib/cart-stock-limit.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `MAX_LINE_QUANTITY: 100`, `CartLineIdentity`, `quantityInCart(items, productId, variantId): number`, `remainingCapacity(liveStock: number | null, inCart: number): number`.

This is the module the whole feature rests on. `ProductDetail.tsx:91` sets the stepper maximum to raw variant stock and ignores what the cart already holds, so with three of a five-stock item in the cart the stepper still offers five and the server rejects the add.

Because adds become optimistic in Task 5, the local cart quantity already includes presses that have not reached the server, so `remainingCapacity` counts down as the customer presses and needs no separate knowledge of what is in flight.

- [ ] **Step 1: Write the failing test**

Create `src/lib/cart-stock-limit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  MAX_LINE_QUANTITY,
  quantityInCart,
  remainingCapacity,
} from "./cart-stock-limit";

const PRODUCT = "product-1";
const OTHER_PRODUCT = "product-2";
const VARIANT_M = "variant-m";
const VARIANT_L = "variant-l";

function line(productId: string, variantId: string | null, quantity: number) {
  return { productId, variantId, quantity };
}

describe("quantityInCart", () => {
  it("returns 0 when the product is not in the cart", () => {
    expect(quantityInCart([], PRODUCT, VARIANT_M)).toBe(0);
  });

  it("finds the quantity for a matching product and variant", () => {
    expect(
      quantityInCart([line(PRODUCT, VARIANT_M, 3)], PRODUCT, VARIANT_M)
    ).toBe(3);
  });

  it("treats two variants of one product as separate lines", () => {
    const items = [line(PRODUCT, VARIANT_M, 3), line(PRODUCT, VARIANT_L, 4)];
    expect(quantityInCart(items, PRODUCT, VARIANT_M)).toBe(3);
    expect(quantityInCart(items, PRODUCT, VARIANT_L)).toBe(4);
  });

  it("ignores other products", () => {
    expect(
      quantityInCart([line(OTHER_PRODUCT, VARIANT_M, 9)], PRODUCT, VARIANT_M)
    ).toBe(0);
  });

  it("matches a variant-less product on a null variantId", () => {
    const items = [line(PRODUCT, null, 2)];
    expect(quantityInCart(items, PRODUCT, null)).toBe(2);
    expect(quantityInCart(items, PRODUCT, VARIANT_M)).toBe(0);
  });

  it("sums duplicate lines rather than picking one", () => {
    // An optimistic `pending-` line can briefly coexist with the server line
    // it is about to be replaced by. Counting one of them would under-report
    // what is held and let the customer over-add.
    const items = [line(PRODUCT, VARIANT_M, 2), line(PRODUCT, VARIANT_M, 1)];
    expect(quantityInCart(items, PRODUCT, VARIANT_M)).toBe(3);
  });
});

describe("remainingCapacity", () => {
  it("leaves two when three of a five-stock item are already in the cart", () => {
    // The case that motivated the whole feature.
    expect(remainingCapacity(5, 3)).toBe(2);
  });

  it("returns the full stock for an empty cart", () => {
    expect(remainingCapacity(5, 0)).toBe(5);
  });

  it("returns zero once the cart holds all the stock", () => {
    expect(remainingCapacity(5, 5)).toBe(0);
  });

  it("clamps to zero rather than going negative when stock moved underneath us", () => {
    expect(remainingCapacity(2, 5)).toBe(0);
  });

  it("returns zero for a sold-out variant", () => {
    expect(remainingCapacity(0, 0)).toBe(0);
  });

  it("falls back to the per-line cap when live stock is unknown", () => {
    // No figure available: the server stays the sole authority on stock, but
    // the request still has to satisfy the router's `MAX_LINE_QUANTITY` bound.
    expect(remainingCapacity(null, 0)).toBe(MAX_LINE_QUANTITY);
    expect(remainingCapacity(null, 40)).toBe(MAX_LINE_QUANTITY - 40);
  });

  it("caps a high-stock product at the per-line limit", () => {
    // `cart.add` rejects a quantity above MAX_LINE_QUANTITY in Zod, so a
    // ceiling of 500 would produce a request the server refuses to parse.
    expect(remainingCapacity(500, 0)).toBe(MAX_LINE_QUANTITY);
    expect(remainingCapacity(500, 95)).toBe(5);
  });

  it("the thirty-first press has nowhere to go", () => {
    // The single assertion that says this feature works: with all 30 units in
    // the cart there is no capacity left, so the call site never fires.
    const inCart = quantityInCart(
      [line(PRODUCT, VARIANT_M, 30)],
      PRODUCT,
      VARIANT_M
    );
    expect(remainingCapacity(30, inCart)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/cart-stock-limit.test.ts`
Expected: FAIL — `Failed to resolve import "./cart-stock-limit"`.

- [ ] **Step 3: Write `src/lib/cart-stock-limit.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/cart-stock-limit.test.ts`
Expected: PASS — 14 tests.

- [ ] **Step 5: Report the task complete**

Do not commit. Name the two assertions that carry the feature: "leaves two when three of a five-stock item are already in the cart" and "the thirty-first press has nowhere to go".

---

### Task 3: The add registry

**Files:**

- Create: `src/lib/cart-add-registry.ts`
- Create: `src/lib/cart-add-registry.test.ts`

**Interfaces:**

- Consumes: nothing. **Deliberately imports nothing from `cart-sync-registry.ts`** — Task 4 makes that module import `cartAddKey` from this one, and a cycle whose head is a `const` read at module-eval time (`CART_ADD_DEBOUNCE_MS = CART_UPDATE_DEBOUNCE_MS`) can evaluate to `undefined` depending on which module loads first. The window is duplicated with a comment instead, the way `STOCK_STALE_MS` is kept in step with `GRID_REFRESH_MS`.
- Produces: `CART_ADD_DEBOUNCE_MS`, `cartAddKey(productId: string, variantId: string | null): string`, `CartAddRun = (totalDelta: number) => Promise<void>`, `CartAddRegistry` with `queueAdd(key, delta, run)`, `pendingDelta(key): number`, `isPending(key): boolean`, `cancel(key)`, `cancelAll()`, `flushAll(): Promise<void>`, `subscribe(listener): () => void`; and `createCartAddRegistry(delayMs?)`.

**The constraint that shapes this module.** `cart.add` is additive on the server:
`requestedQuantity = existing.quantity + cartItem.quantity` in `cart.repository.ts:241`.
Additive writes do not compose with debouncing. Thirty presses must not become
thirty `+1` calls, and they must not become one `quantity: 30` call when the
line already held five. So this registry accumulates a **delta** per
product+variant key and flushes it as one additive call.

**Where it differs from `cart-sync-registry`.** That one replaces — scheduling
again for the same id cancels the previous write, because an absolute quantity
is last-call-wins. This one **accumulates**: a second press adds to the pending
delta rather than replacing it. Getting that backwards drops presses.

**Why `queued` and `inFlight` are separate counters.** Presses that arrive while
a flush is already on the wire must not be folded into the amount that flush is
carrying — a failure would then roll back more than it sent, and a success would
clear presses the server never heard. They accumulate into a fresh `queued`
which arms a second call, which is correct precisely because the server is
additive. `pendingDelta` is the sum of both: it means "units the server has not
confirmed", which is what the UI counter shows.

- [ ] **Step 1: Write the failing test**

Create `src/lib/cart-add-registry.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCartAddRegistry, cartAddKey } from "./cart-add-registry";

const KEY_A = "product-a:variant-1";
const KEY_B = "product-b:-";

describe("cartAddKey", () => {
  it("joins product and variant", () => {
    expect(cartAddKey("p1", "v1")).toBe("p1:v1");
  });

  it("uses a placeholder for a product with no variant", () => {
    expect(cartAddKey("p1", null)).toBe("p1:-");
  });

  it("keeps two variants of one product apart", () => {
    expect(cartAddKey("p1", "v1")).not.toBe(cartAddKey("p1", "v2"));
  });
});

describe("createCartAddRegistry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("collapses a burst of presses into one call carrying the summed delta", async () => {
    // The headline behaviour: thirty presses, one request.
    const registry = createCartAddRegistry(1000);
    const run = vi.fn().mockResolvedValue(undefined);

    for (let i = 0; i < 30; i++) {
      registry.queueAdd(KEY_A, 1, run);
      await vi.advanceTimersByTimeAsync(10);
    }
    await vi.advanceTimersByTimeAsync(1000);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(30);
  });

  it("accumulates rather than replacing — the difference from cart-sync-registry", async () => {
    const registry = createCartAddRegistry(1000);
    const run = vi.fn().mockResolvedValue(undefined);

    registry.queueAdd(KEY_A, 2, run);
    registry.queueAdd(KEY_A, 3, run);
    await vi.advanceTimersByTimeAsync(1000);

    expect(run).toHaveBeenCalledWith(5);
  });

  it("keeps separate keys independent", async () => {
    const registry = createCartAddRegistry(1000);
    const runA = vi.fn().mockResolvedValue(undefined);
    const runB = vi.fn().mockResolvedValue(undefined);

    registry.queueAdd(KEY_A, 1, runA);
    registry.queueAdd(KEY_B, 4, runB);
    await vi.advanceTimersByTimeAsync(1000);

    expect(runA).toHaveBeenCalledWith(1);
    expect(runB).toHaveBeenCalledWith(4);
  });

  it("pendingDelta counts queued units and clears once the call settles", async () => {
    let resolveRun!: () => void;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        })
    );
    const registry = createCartAddRegistry(1000);

    registry.queueAdd(KEY_A, 3, run);
    expect(registry.pendingDelta(KEY_A)).toBe(3);
    expect(registry.isPending(KEY_A)).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);
    // Handed to the server but not confirmed — still pending.
    expect(registry.pendingDelta(KEY_A)).toBe(3);

    resolveRun();
    await vi.advanceTimersByTimeAsync(0);
    expect(registry.pendingDelta(KEY_A)).toBe(0);
    expect(registry.isPending(KEY_A)).toBe(false);
  });

  it("presses during an in-flight call become a second call, not a bigger first one", async () => {
    // The server is additive, so a second `+2` is the correct way to send two
    // more units while the first call is still on the wire. Folding them into
    // the in-flight amount would make a rollback take back units that were
    // never sent.
    let resolveFirst!: () => void;
    const run = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValue(undefined);
    const registry = createCartAddRegistry(1000);

    registry.queueAdd(KEY_A, 1, run);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenNthCalledWith(1, 1);

    registry.queueAdd(KEY_A, 2, run);
    expect(registry.pendingDelta(KEY_A)).toBe(3);

    resolveFirst();
    await vi.advanceTimersByTimeAsync(1000);

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenNthCalledWith(2, 2);
    expect(registry.pendingDelta(KEY_A)).toBe(0);
  });

  it("pendingDelta clears even when the call rejects", async () => {
    const registry = createCartAddRegistry(1000);
    registry.queueAdd(KEY_A, 4, () => Promise.reject(new Error("boom")));

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);

    expect(registry.pendingDelta(KEY_A)).toBe(0);
  });

  it("cancel() drops queued units before they are sent", async () => {
    const registry = createCartAddRegistry(1000);
    const run = vi.fn().mockResolvedValue(undefined);

    registry.queueAdd(KEY_A, 5, run);
    registry.cancel(KEY_A);
    await vi.advanceTimersByTimeAsync(5000);

    expect(run).not.toHaveBeenCalled();
    expect(registry.pendingDelta(KEY_A)).toBe(0);
  });

  it("cancel() leaves a call that is already on the wire alone", async () => {
    // The request is out; pretending otherwise would leave the local cart
    // disagreeing with a write the server is about to commit.
    let resolveRun!: () => void;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        })
    );
    const registry = createCartAddRegistry(1000);

    registry.queueAdd(KEY_A, 2, run);
    await vi.advanceTimersByTimeAsync(1000);
    registry.cancel(KEY_A);

    expect(registry.pendingDelta(KEY_A)).toBe(2);
    resolveRun();
    await vi.advanceTimersByTimeAsync(0);
    expect(registry.pendingDelta(KEY_A)).toBe(0);
  });

  it("cancel() is safe for a key with nothing queued", () => {
    const registry = createCartAddRegistry(1000);
    expect(() => registry.cancel("nothing-queued")).not.toThrow();
  });

  it("cancelAll() drops every queued delta — the clearCart case", async () => {
    const registry = createCartAddRegistry(1000);
    const run = vi.fn().mockResolvedValue(undefined);

    registry.queueAdd(KEY_A, 1, run);
    registry.queueAdd(KEY_B, 1, run);
    registry.cancelAll();
    await vi.advanceTimersByTimeAsync(5000);

    expect(run).not.toHaveBeenCalled();
  });

  it("flushAll() fires armed timers immediately and resolves after the calls settle", async () => {
    // Checkout awaits this. It must not open against a cart the server has not
    // caught up to.
    const settled: string[] = [];
    const registry = createCartAddRegistry(1000);
    const run = vi.fn(async (delta: number) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      settled.push(`ran:${delta}`);
    });

    registry.queueAdd(KEY_A, 2, run);
    registry.queueAdd(KEY_B, 3, run);

    const flushed = registry.flushAll().then(() => settled.push("flushed"));
    await vi.advanceTimersByTimeAsync(100);
    await flushed;

    expect(run).toHaveBeenCalledTimes(2);
    expect(settled).toEqual(["ran:2", "ran:3", "flushed"]);
    expect(registry.pendingDelta(KEY_A)).toBe(0);
  });

  it("flushAll() also waits for a call that was already in flight", async () => {
    const settled: string[] = [];
    const registry = createCartAddRegistry(1000);
    const run = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      settled.push("ran");
    });

    registry.queueAdd(KEY_A, 1, run);
    await vi.advanceTimersByTimeAsync(1000);

    const flushed = registry.flushAll().then(() => settled.push("flushed"));
    await vi.advanceTimersByTimeAsync(100);
    await flushed;

    expect(settled).toEqual(["ran", "flushed"]);
  });

  it("flushAll() resolves immediately when nothing is pending", async () => {
    const registry = createCartAddRegistry(1000);
    await expect(registry.flushAll()).resolves.toBeUndefined();
  });

  it("flushAll() resolves even when a call rejects", async () => {
    const registry = createCartAddRegistry(1000);
    registry.queueAdd(KEY_A, 1, () => Promise.reject(new Error("boom")));

    const flushed = registry.flushAll();
    await vi.advanceTimersByTimeAsync(0);

    await expect(flushed).resolves.toBeUndefined();
  });

  it("subscribe() fires when a delta changes, and stops after unsubscribing", async () => {
    // This is what drives the "Added N" counter through useSyncExternalStore.
    const registry = createCartAddRegistry(1000);
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);

    registry.queueAdd(KEY_A, 1, () => Promise.resolve());
    expect(listener).toHaveBeenCalled();

    const afterQueue = listener.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(listener.mock.calls.length).toBeGreaterThan(afterQueue);

    unsubscribe();
    const afterUnsubscribe = listener.mock.calls.length;
    registry.queueAdd(KEY_B, 1, () => Promise.resolve());
    expect(listener.mock.calls.length).toBe(afterUnsubscribe);
  });

  it("its methods survive being passed as bare function references", () => {
    // `subscribe` and `isPending` are handed to useSyncExternalStore and to
    // reconcileServerCart detached from the object, so nothing may read `this`.
    const registry = createCartAddRegistry(1000);
    const { isPending, pendingDelta, subscribe } = registry;

    registry.queueAdd(KEY_A, 2, () => Promise.resolve());

    expect(isPending(KEY_A)).toBe(true);
    expect(pendingDelta(KEY_A)).toBe(2);
    expect(() => subscribe(() => {})()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/cart-add-registry.test.ts`
Expected: FAIL — `Failed to resolve import "./cart-add-registry"`.

- [ ] **Step 3: Write `src/lib/cart-add-registry.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/cart-add-registry.test.ts`
Expected: PASS — 20 tests.

- [ ] **Step 5: Report the task complete**

Do not commit. Confirm the burst test collapses 30 presses into one call with delta 30.

---

### Task 4: `flushAll` and a product-aware `reconcileServerCart`

**Files:**

- Modify: `src/lib/cart-sync-registry.ts`
- Modify: `src/lib/cart-sync-registry.test.ts`

**Interfaces:**

- Consumes: `cartAddKey` from `src/lib/cart-add-registry.ts` (Task 3).
- Produces: `CartSyncRegistry.flushAll(): Promise<void>`; `PendingCartWrites { isPendingItem(cartItemId): boolean; isPendingAdd(key): boolean }`; a new `reconcileServerCart<T extends { id: string; productId: string; variantId: string | null }>(serverItems, localItems, pending): T[]`.

**Two problems the optimistic add exposes.**

`reconcileServerCart` maps over _server_ items, so a local-only line with no
server row yet is not in its output at all. Every cart mutation's `onSuccess`
calls `invalidateCart()`, so any unrelated refetch would make a just-added line
vanish and reappear a second later. It must carry through local lines whose
product+variant has an add pending.

And a server line can be _behind_ the local one: two units on the server, five
locally, with the difference still queued. Matching only on cart item id would
stamp it back to two. So a server line whose product+variant has a pending add
keeps its local value too.

`flushAll` exists for the same reason it does on the add registry: the Checkout
button should flush pending writes and wait, not disable itself.

- [ ] **Step 1: Update the tests**

In `src/lib/cart-sync-registry.test.ts`, replace the whole
`describe("reconcileServerCart", ...)` block with the version below, and append
the new `flushAll` cases to the end of the
`describe("createCartSyncRegistry", ...)` block (immediately before its closing
`});`).

New `flushAll` cases, inside `describe("createCartSyncRegistry")`:

```ts
it("flushAll() fires an armed timer immediately and waits for the write", async () => {
  const settled: string[] = [];
  const registry = createCartSyncRegistry(1000);
  const run = vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    settled.push("ran");
  });

  registry.scheduleUpdate(ITEM_A, run);
  const flushed = registry.flushAll().then(() => settled.push("flushed"));
  await vi.advanceTimersByTimeAsync(100);
  await flushed;

  expect(run).toHaveBeenCalledTimes(1);
  expect(settled).toEqual(["ran", "flushed"]);
  expect(registry.isPending(ITEM_A)).toBe(false);
});

it("flushAll() waits for a write that had already fired", async () => {
  const settled: string[] = [];
  const registry = createCartSyncRegistry(1000);
  const run = vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    settled.push("ran");
  });

  registry.scheduleUpdate(ITEM_A, run);
  await vi.advanceTimersByTimeAsync(1000);

  const flushed = registry.flushAll().then(() => settled.push("flushed"));
  await vi.advanceTimersByTimeAsync(100);
  await flushed;

  expect(settled).toEqual(["ran", "flushed"]);
});

it("flushAll() resolves immediately when nothing is pending", async () => {
  const registry = createCartSyncRegistry(1000);
  await expect(registry.flushAll()).resolves.toBeUndefined();
});

it("flushAll() resolves even when a write rejects", async () => {
  const registry = createCartSyncRegistry(1000);
  registry.scheduleUpdate(ITEM_A, () => Promise.reject(new Error("boom")));

  const flushed = registry.flushAll();
  await vi.advanceTimersByTimeAsync(0);

  await expect(flushed).resolves.toBeUndefined();
});
```

Replacement `reconcileServerCart` block (note the fixtures now carry
`productId`/`variantId`, because the function keys on them):

```ts
describe("reconcileServerCart", () => {
  const PRODUCT = "product-1";
  const VARIANT = "variant-1";
  const KEY = `${PRODUCT}:${VARIANT}`;

  function line(
    id: string,
    quantity: number,
    variantId: string | null = VARIANT
  ) {
    return { id, productId: PRODUCT, variantId, quantity };
  }

  function pendingWrites(
    overrides: Partial<PendingCartWrites> = {}
  ): PendingCartWrites {
    return {
      isPendingItem: () => false,
      isPendingAdd: () => false,
      ...overrides,
    };
  }

  it("replaces a non-pending line with the server's value", () => {
    const server = [line(ITEM_A, 5)];
    const local = [line(ITEM_A, 1)];

    expect(reconcileServerCart(server, local, pendingWrites())).toEqual([
      line(ITEM_A, 5),
    ]);
  });

  it("keeps the local value for a line with a quantity edit in flight", () => {
    const pending = pendingWrites({ isPendingItem: (id) => id === ITEM_A });

    // The server still reflects the pre-edit quantity; the customer's
    // optimistic edit must survive this refetch.
    expect(
      reconcileServerCart([line(ITEM_A, 1)], [line(ITEM_A, 3)], pending)
    ).toEqual([line(ITEM_A, 3)]);
  });

  it("keeps the local value for a line with an add still queued", () => {
    // Two on the server, five locally, three still waiting on the debounce.
    // Matching only on cart item id would stamp the line back to two.
    const pending = pendingWrites({ isPendingAdd: (key) => key === KEY });

    expect(
      reconcileServerCart([line(ITEM_A, 2)], [line(ITEM_A, 5)], pending)
    ).toEqual([line(ITEM_A, 5)]);
  });

  it("carries through a local-only line whose add has not landed yet", () => {
    // The just-added case. Without this the new line vanishes on the next
    // unrelated refetch and reappears a second later.
    const pending = pendingWrites({ isPendingAdd: (key) => key === KEY });
    const local = [line("pending-abc", 1)];

    expect(reconcileServerCart([], local, pending)).toEqual(local);
  });

  it("drops a local-only line once its add has settled", () => {
    // Nothing pending and no server row means the add failed or was rolled
    // back. Keeping it would show the customer a line the server never has.
    const local = [line("pending-abc", 1)];
    expect(reconcileServerCart([], local, pendingWrites())).toEqual([]);
  });

  it("does not duplicate a line whose server row has arrived", () => {
    // The local copy still carries its `pending-` id while the server row
    // carries a uuid. Keyed on product+variant, they are one line.
    const pending = pendingWrites({ isPendingAdd: (key) => key === KEY });
    const server = [line(ITEM_A, 3)];
    const local = [line("pending-abc", 3)];

    expect(reconcileServerCart(server, local, pending)).toEqual([
      line("pending-abc", 3),
    ]);
  });

  it("only protects the pending line, not the rest of the cart", () => {
    const pending = pendingWrites({ isPendingItem: (id) => id === ITEM_A });
    const server = [line(ITEM_A, 1), line(ITEM_B, 9, "variant-2")];
    const local = [line(ITEM_A, 3), line(ITEM_B, 2, "variant-2")];

    expect(reconcileServerCart(server, local, pending)).toEqual([
      line(ITEM_A, 3),
      line(ITEM_B, 9, "variant-2"),
    ]);
  });

  it("falls back to the server value if a pending line has no local match", () => {
    const pending = pendingWrites({ isPendingItem: (id) => id === ITEM_A });
    expect(reconcileServerCart([line(ITEM_A, 1)], [], pending)).toEqual([
      line(ITEM_A, 1),
    ]);
  });

  it("keeps an untouched guest line out of the way", () => {
    // A guest line has no server row and no pending add — the merge effect
    // owns it, not this function.
    const local = [line("guest-abc", 2)];
    expect(reconcileServerCart([], local, pendingWrites())).toEqual([]);
  });
});
```

Update the import at the top of the file to bring in the new type:

```ts
import {
  createCartSyncRegistry,
  reconcileServerCart,
  type PendingCartWrites,
} from "./cart-sync-registry";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/cart-sync-registry.test.ts`
Expected: FAIL — `PendingCartWrites` is not exported, `registry.flushAll is not a function`, and the reconcile cases fail on the three-argument shape.

- [ ] **Step 3: Rewrite `createCartSyncRegistry` to track its writes**

`flushAll` needs to reach the `run` a timer is holding and to know which writes
are outstanding, neither of which the current closure keeps. Replace the whole
`createCartSyncRegistry` function body with:

```ts
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
```

Add `flushAll` to the `CartSyncRegistry` interface, after `isPending`:

```ts
  /**
   * Fire every armed timer now and resolve once every triggered write, and any
   * write already in flight, has settled. Awaited before checkout, so the
   * order is never priced against a cart the server has not caught up to.
   */
  flushAll(): Promise<void>;
```

- [ ] **Step 4: Replace `reconcileServerCart`**

Add the import at the top of `src/lib/cart-sync-registry.ts`:

```ts
import { cartAddKey } from "./cart-add-registry";
```

Then replace the whole `reconcileServerCart` function and its docblock with:

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/cart-sync-registry.test.ts src/lib/cart-add-registry.test.ts`
Expected: PASS — both files, 25 + 20 tests.

- [ ] **Step 6: Report the task complete**

Do not commit. Note that `reconcileServerCart`'s signature changed and that
`cart-provider.tsx` (Task 5) is its only production caller.

---

### Task 5: Optimistic add in the cart provider

**Files:**

- Modify: `src/lib/stores/cart-store.ts`
- Modify: `src/components/providers/cart-provider.tsx`

**Interfaces:**

- Consumes: `cartAddKey`, `createCartAddRegistry` (Task 3); `reconcileServerCart`, `PendingCartWrites` (Task 4); `showRetryToast` (Task 1).
- Produces: `PENDING_CART_ITEM_ID_PREFIX = "pending-"`, `isLocalOnlyCartItemId(cartItemId): boolean` from the store; and from `useCart()`: `addItem(productId, quantity?, variantId?, details?): void` (no longer async, no longer throws), `flushPendingWrites(): Promise<void>`, plus the module-level hook `useCartAddDelta(productId, variantId): number`.

This is where the round trip leaves the press path. `addItem`'s authenticated
branch is `await addMutation.mutateAsync(...)` today, which is why both add
buttons need an `isAdding` flag and why adding ten of something is ten round
trips behind a dead button.

**`isSyncing` stays for now.** This task stops _setting_ it, so it sits at
`false` and the cart is effectively un-frozen a task early. Task 8 deletes the
field, its setter and its three UI consumers together, so both tasks type-check
on their own.

- [ ] **Step 1: Add the pending-line prefix to the cart store**

In `src/lib/stores/cart-store.ts`, immediately after the
`GUEST_CART_ITEM_ID_PREFIX` declaration and its docblock, add:

```ts
/**
 * Id prefix for a line added optimistically by a signed-in customer.
 *
 * Deliberately **not** `guest-`. `CartProvider`'s merge effect keys off that
 * prefix to decide what to fold into the server cart at sign-in, so an
 * authenticated optimistic line carrying it would be added a second time —
 * once by the add itself and once by the merge. This prefix is excluded from
 * the merge filter and dropped by `clearSignedOutItems`, because the line
 * belongs to an account rather than to the browser.
 *
 * A `pending-` line lives only until its `cart.add` lands and `cart.get`
 * returns the real row; `reconcileServerCart` matches the two on product +
 * variant, so the swap is invisible.
 */
export const PENDING_CART_ITEM_ID_PREFIX = "pending-";

/**
 * True for a line that has no server row to address yet — a guest line
 * awaiting its merge, or an optimistic add still in flight.
 *
 * Both would fail `z.string().uuid()` if sent as a `cartItemId`, so quantity
 * edits and removals on these stay local.
 */
export function isLocalOnlyCartItemId(cartItemId: string): boolean {
  return (
    cartItemId.startsWith(GUEST_CART_ITEM_ID_PREFIX) ||
    cartItemId.startsWith(PENDING_CART_ITEM_ID_PREFIX)
  );
}
```

`clearSignedOutItems` needs no change: it already keeps only `guest-` lines, so
a `pending-` line is dropped at sign-out, which is correct. The merge effect
needs no change either, for the same reason.

- [ ] **Step 2: Verify nothing broke yet**

Run: `pnpm vitest run src/lib` and `pnpm type-check`
Expected: PASS / no errors. The two new exports have no consumers yet.

- [ ] **Step 3: Wire the add registry into the provider**

In `src/components/providers/cart-provider.tsx`, replace the import block and
the registry singleton (lines 10-31) with:

```ts
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import {
  useCartStore,
  GUEST_CART_ITEM_ID_PREFIX,
  PENDING_CART_ITEM_ID_PREFIX,
  isLocalOnlyCartItemId,
  type CartItem,
} from "@/lib/stores/cart-store";
import {
  createCartSyncRegistry,
  reconcileServerCart,
} from "@/lib/cart-sync-registry";
import { cartAddKey, createCartAddRegistry } from "@/lib/cart-add-registry";
import { showRetryToast } from "@/lib/optimistic-toast";
import { toast } from "sonner";

// Module scope, not inside `useCart()` — every component that calls the
// hook (CartDrawer, CartPopulated, ProductDetail, QuickAddSliderBar, ...)
// must share one debounce timer and one "is this line mid-write" flag per
// cart item id, the same way every caller already shares one
// `useCartStore()`. A registry scoped to the hook instead produced a
// separate timer per mounted component per line, so two surfaces editing
// the same line within a second could each win.
const cartSyncRegistry = createCartSyncRegistry();

// The same reasoning, for adds. Keyed on product+variant rather than cart item
// id, because a line being added may not have a server row yet. Note the two
// registries behave differently on purpose: quantity edits replace, adds
// accumulate — see the header of `cart-add-registry.ts`.
const cartAddRegistry = createCartAddRegistry();
```

- [ ] **Step 4: Teach the sync effect about pending adds**

In the `useEffect` that syncs the server cart (currently lines 65-81), replace
the `setItems(...)` call with:

```ts
const localItems = useCartStore.getState().items;
setItems(
  reconcileServerCart(items, localItems, {
    isPendingItem: cartSyncRegistry.isPending,
    isPendingAdd: cartAddRegistry.isPending,
  })
);
```

Both are passed as bare function references, which is why neither registry may
read `this`.

- [ ] **Step 5: Add the pending-delta hook**

Immediately after the `CartProvider` component (before the details interface),
add:

```ts
/**
 * How many units of one product+variant the server has not confirmed yet.
 *
 * Drives the "Added N" counter on the add buttons. The registry is a plain
 * module singleton with no React in it, so this subscribes the way the navbar
 * badge does, and reports 0 during SSR — a pending write cannot exist on the
 * server, and forcing the value keeps the button out of hydration mismatches.
 */
export function useCartAddDelta(
  productId: string,
  variantId: string | null
): number {
  const key = cartAddKey(productId, variantId);

  return useSyncExternalStore(
    cartAddRegistry.subscribe,
    () => cartAddRegistry.pendingDelta(key),
    () => 0
  );
}
```

- [ ] **Step 6: Rename the details type**

Replace the `GuestCartItemDetails` interface and its docblock (lines 174-181)
with:

```ts
/** Product data the store needs to render a cart line before the server does. */
export interface CartLineDetails {
  productName: string;
  productPrice: number;
  productImage: string | null;
  variantLabel: string | null;
  maxStock: number;
}
```

It is no longer guest-specific: an authenticated optimistic line needs exactly
the same display data, for the same reason — there is no server response to
read it from yet. `GuestCartItemDetails` had no importers outside this file.

- [ ] **Step 7: Replace `addItem`**

Replace the whole `addItem` `useCallback` (lines 219-264, including its leading
comment) with:

```ts
// Add item — a local write, always. For a signed-in customer the server call
// is debounced and additive: press thirty times and the cart reads thirty
// immediately while the server hears one `+30`. `details` is the display
// data (name, price, image, stock) the caller already has for the product;
// none of it is trusted again once it matters, because the server re-resolves
// price and stock on both the add and the guest merge.
const addItem = useCallback(
  (
    productId: string,
    quantity: number = 1,
    variantId: string | null = null,
    details?: CartLineDetails
  ) => {
    if (!details) {
      // No display data to show locally with — this means a call site hasn't
      // been updated to pass it, not that the customer did anything wrong,
      // but silently dropping the click would look identical to a real
      // failure from where they are standing.
      toast.error("Could not add this item to your cart");
      return;
    }

    const display = details;
    const prefix = isAuthenticated
      ? PENDING_CART_ITEM_ID_PREFIX
      : GUEST_CART_ITEM_ID_PREFIX;

    /** Show `delta` more units right now. */
    function addLocally(delta: number) {
      // `store.addItem` merges on product + variant, so the generated id is
      // only ever used when this is a brand-new line.
      store.addItem({
        id: `${prefix}${crypto.randomUUID()}`,
        productId,
        variantId,
        variantLabel: display.variantLabel,
        productName: display.productName,
        productPrice: display.productPrice,
        productImage: display.productImage,
        quantity: delta,
        maxStock: display.maxStock,
      });
    }

    /** Take `delta` units back out after a write the server refused. */
    function takeBackLocally(delta: number) {
      const line = useCartStore
        .getState()
        .items.find(
          (item) => item.productId === productId && item.variantId === variantId
        );
      if (!line) return;

      const next = line.quantity - delta;
      if (next > 0) store.updateQuantity(line.id, next);
      else store.removeItem(line.id);
    }

    addLocally(quantity);

    // A guest line stays local until `mergeGuestItems` folds it into the
    // server cart at sign-in.
    if (!isAuthenticated) return;

    const key = cartAddKey(productId, variantId);

    function queue(delta: number) {
      cartAddRegistry.queueAdd(key, delta, async (totalDelta) => {
        try {
          await addMutation.mutateAsync({
            productId,
            quantity: totalDelta,
            variantId,
          });
        } catch (error) {
          // Take back exactly what this call was carrying. Presses that
          // arrived while it was on the wire are a separate call and are
          // still perfectly good.
          takeBackLocally(totalDelta);
          // The client caps at the cached ceiling, so reaching here means
          // stock moved underneath us — refresh the figure the ceiling is
          // computed from so the page corrects itself.
          utils.public.products.getStock.invalidate();
          invalidateCart();
          showRetryToast(
            error instanceof Error && error.message
              ? error.message
              : "Couldn't add that to your cart.",
            () => {
              addLocally(totalDelta);
              queue(totalDelta);
            }
          );
        }
      });
    }

    queue(quantity);
  },
  [isAuthenticated, addMutation, store, utils, invalidateCart]
);
```

- [ ] **Step 8: Replace `updateQuantity`, `removeItem` and `clearCart`**

Replace those three `useCallback`s (lines 266-355) with:

```ts
// Update quantity — local first, server on a shared 1s debounce.
const updateQuantity = useCallback(
  (cartItemId: string, quantity: number) => {
    store.updateQuantity(cartItemId, quantity);

    // A `guest-` or `pending-` id has no server row to update yet. Sending
    // one as a cartItemId would fail uuid validation outright, so it stays
    // local until the merge — or the add — replaces it with a real one.
    if (!isAuthenticated || isLocalOnlyCartItemId(cartItemId)) return;

    function schedule() {
      // `scheduleUpdate` shares its timer across every `useCart()` instance
      // and marks this id "pending" for the sync effect, replacing any write
      // already scheduled for the same id — last call wins.
      cartSyncRegistry.scheduleUpdate(cartItemId, async () => {
        try {
          await updateMutation.mutateAsync({ cartItemId, quantity });
        } catch {
          // As far as the server is concerned the optimistic write never
          // happened. Pull the real value back in rather than leaving the
          // customer looking at a quantity nobody agrees with, and give them
          // a way to try again that does not mean re-finding the item.
          invalidateCart();
          showRetryToast("Couldn't save that quantity change.", () => {
            store.updateQuantity(cartItemId, quantity);
            schedule();
          });
        }
      });
    }

    schedule();
  },
  [isAuthenticated, updateMutation, store, invalidateCart]
);

// Remove item
const removeItem = useCallback(
  (cartItemId: string) => {
    // A debounced quantity write may still be armed for this id — let it
    // fire after the row is gone and `UpdateCartItemUseCase` rejects with
    // "Cart item not found" for no one to see.
    cartSyncRegistry.cancel(cartItemId);

    // Queued units for this product have nowhere to go now either.
    const line = useCartStore
      .getState()
      .items.find((item) => item.id === cartItemId);
    if (line) {
      cartAddRegistry.cancel(cartAddKey(line.productId, line.variantId));
    }

    store.removeItem(cartItemId);

    // See updateQuantity: a local-only id has no server row to delete.
    if (!isAuthenticated || isLocalOnlyCartItemId(cartItemId)) return;

    function attempt() {
      removeMutation.mutate(
        { cartItemId },
        {
          onError: () => {
            // The row survived, so the refetch restores it under the same
            // id — which is what makes retrying the identical call valid.
            invalidateCart();
            showRetryToast("Couldn't remove that item.", () => {
              store.removeItem(cartItemId);
              attempt();
            });
          },
        }
      );
    }

    attempt();
  },
  [isAuthenticated, removeMutation, store, invalidateCart]
);

// Clear cart
const clearCart = useCallback(() => {
  // Same reasoning as removeItem, for every line at once.
  cartSyncRegistry.cancelAll();
  cartAddRegistry.cancelAll();

  const snapshot = useCartStore.getState().items;
  store.clearCart();

  if (!isAuthenticated) return;

  function attempt() {
    clearMutation.mutate(undefined, {
      onError: () => {
        // Nothing was deleted, so put the whole cart back rather than
        // waiting for a refetch to notice.
        store.setItems(snapshot);
        showRetryToast("Couldn't empty your cart.", () => {
          store.clearCart();
          attempt();
        });
      },
    });
  }

  attempt();
}, [isAuthenticated, clearMutation, store]);

/**
 * Send everything that is still sitting on a debounce, and wait for it.
 *
 * Checkout is the one place where being behind the server actually costs
 * something, and disabling a button while `isSyncing` was only ever an
 * accidental approximation of this.
 */
const flushPendingWrites = useCallback(async () => {
  await Promise.all([cartAddRegistry.flushAll(), cartSyncRegistry.flushAll()]);
}, []);
```

- [ ] **Step 9: Export `flushPendingWrites`**

In the object `useCart()` returns, add `flushPendingWrites,` to the Actions
group, immediately after `clearCart,`.

- [ ] **Step 10: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: no type errors, 0 lint problems, every test passing.

Two things that will still look odd and are fixed in later tasks: `isSyncing` is
now permanently `false` (Task 8 deletes it), and `ProductDetail`/
`QuickAddSliderBar` still have `try`/`catch` blocks around an `addItem` that no
longer throws (Tasks 6 and 7).

- [ ] **Step 11: Report the task complete**

Do not commit. State that the press path no longer awaits the server and that
`flushPendingWrites` is exported but not yet called.

---

### Task 6: The product page ceiling

**Files:**

- Modify: `src/components/products/ProductDetail.tsx`
- Modify: `src/components/products/product-detail/ProductActions.tsx`

**Interfaces:**

- Consumes: `quantityInCart`, `remainingCapacity` (Task 2); `useCart` (Task 5).
- Produces: `ProductActionsProps` without `isAdding`, with `atCeiling: boolean` and `inCartQuantity: number`.

`ProductDetail.tsx:91` sets `maxQuantity` to the raw variant stock. The stepper
therefore offers five when three are already in the cart, and the server refuses
the add. `isAdding` (line 64) disables the button for a whole round trip per
press; with the press path now local there is nothing to wait for, so it goes.

**`isSelectionInStock` must keep reading raw stock.** Deriving it from the
remaining capacity would label a product "Out of Stock" when the customer simply
has all of it in their cart already — which is both false and unhelpful. The two
states are separate: sold out, and everything-that-exists-is-yours.

- [ ] **Step 1: Replace the ceiling arithmetic in `ProductDetail.tsx`**

Replace lines 87-112 (from the `maxQuantity` comment through
`effectiveQuantity`) with:

```ts
// Raw availability for the chosen variant: the live cached figure when there
// is one, otherwise the server-rendered snapshot. Null while no concrete
// variant is resolved, so nothing is claimed before the customer has chosen.
const variantStock = selectedVariant
  ? (stock.get(selectedVariant.id) ?? selectedVariant.availableStock)
  : null;

// How many *more* may be added, which is not the same number: the server
// enforces `already in cart + requested <= stock`, and until now the client
// did not know that, so the stepper offered five with three already held.
const inCartQuantity = selectedVariant
  ? quantityInCart(items, product.id, selectedVariant.id)
  : quantityInCart(items, product.id, null);

const maxQuantity = selectedVariant
  ? remainingCapacity(variantStock, inCartQuantity)
  : null;

// Only claim "out of stock" once we actually know which variant is meant.
// Before a size is picked there is no resolved variant, and reporting that as
// out of stock would tell the customer a perfectly available product is
// unavailable. In that state the button stays enabled and the click handler
// below explains what is missing.
//
// Read from raw stock, never from `maxQuantity`: a customer holding all five
// of a five-stock item is at the ceiling, not looking at a sold-out product,
// and the two deserve different words.
const isSelectionInStock =
  product.variants.length === 0
    ? (product.inStock ?? false)
    : selectedVariant
      ? (variantStock ?? 0) > 0
      : true;

/** In stock, but the cart already holds every unit that exists. */
const atCeiling = isSelectionInStock && maxQuantity === 0;

// Clamp on read rather than writing state during render: switching to a
// lower-stock variant, or adding until the ceiling drops, must not leave a
// quantity that cannot be fulfilled.
const effectiveQuantity =
  maxQuantity !== null && maxQuantity > 0
    ? Math.min(quantity, maxQuantity)
    : quantity;
```

- [ ] **Step 2: Simplify `handleAddToCart`**

Replace lines 114-173 (the whole `handleAddToCart`) with:

```ts
const handleAddToCart = () => {
  if (hasSizes && !selectedSize) {
    toast.error("Please select a size");
    return;
  }

  if (product.variants.length > 0 && !selectedVariant) {
    toast.error("That combination is not available");
    return;
  }

  // Local, immediate, debounced. A failure surfaces from the provider as a
  // toast with a Retry action, carrying the server's own message — which is
  // why there is nothing to catch here and no dialog to open.
  addItem(product.id, effectiveQuantity, selectedVariant?.id ?? null, {
    productName: product.name,
    productPrice: product.salePrice ?? product.price,
    productImage: product.images?.[0] ?? null,
    variantLabel: selectedVariant
      ? [selectedVariant.size, selectedVariant.color]
          .filter(Boolean)
          .join(" / ")
      : null,
    maxStock: variantStock ?? effectiveQuantity,
  });

  // The product page keeps the auto-open: there is no burst-pressing problem
  // behind a full-width button, and the drawer is the confirmation.
  openCart();
};
```

- [ ] **Step 3: Update the surrounding wiring in `ProductDetail.tsx`**

1. Delete the `parseStockFromMessage` helper (lines 44-52) and the
   `variantLabel` const (lines 76-78) — both existed only for the dialog.
2. Delete `const [isAdding, setIsAdding] = useState(false);` and
   `const [stockIssue, setStockIssue] = useState<StockIssue | null>(null);`.
3. Change the `useCart()` destructure to
   `const { addItem, openCart, isAuthenticated, items } = useCart();`.
4. Delete the `StockIssueDialog` import (lines 13-16) and its JSX block
   (lines 222-226).
5. Add the ceiling import beside the existing ones:

```ts
import { quantityInCart, remainingCapacity } from "@/lib/cart-stock-limit";
```

6. Replace the `<ProductActions .../>` element with:

```tsx
<ProductActions
  isAuthenticated={isAuthenticated}
  inStock={isSelectionInStock}
  atCeiling={atCeiling}
  inCartQuantity={inCartQuantity}
  onAddToCart={handleAddToCart}
  details={product.details}
/>
```

- [ ] **Step 4: Update `ProductActions.tsx`**

Replace lines 1-57 (the imports, the props interface, and the add-to-cart
block) with:

```tsx
"use client";

import Link from "next/link";
import { LogIn, Truck, RefreshCw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductActionsProps {
  isAuthenticated: boolean;
  inStock?: boolean;
  /** In stock, but the cart already holds every available unit. */
  atCeiling?: boolean;
  /** How many are already in the cart, for the at-ceiling label. */
  inCartQuantity?: number;
  onAddToCart: () => void;
  details?: string[];
}

export function ProductActions({
  isAuthenticated,
  inStock,
  atCeiling = false,
  inCartQuantity = 0,
  onAddToCart,
  details,
}: ProductActionsProps) {
  return (
    <>
      {/* Add to Cart */}
      <div className="flex gap-4 mb-8">
        {!isAuthenticated ? (
          <Button
            className="flex-1 bg-val-accent hover:bg-val-accent/90 text-white py-6 text-lg font-medium"
            asChild
          >
            <Link
              href={`/login?redirect=${encodeURIComponent(
                typeof window !== "undefined" ? window.location.pathname : "/"
              )}`}
            >
              <LogIn className="h-5 w-5 mr-2" />
              Sign In to Buy
            </Link>
          </Button>
        ) : (
          // No pending state: the press is a local write, so there is no round
          // trip to spin for and no reason the button should ever go dead
          // between presses. The stock ceiling is the only thing that stops it.
          <Button
            onClick={onAddToCart}
            className="flex-1 bg-white text-black hover:bg-val-silver py-6 text-lg font-medium"
            disabled={!inStock || atCeiling}
          >
            {!inStock
              ? "Out of Stock"
              : atCeiling
                ? `All ${inCartQuantity} in cart`
                : "Add to Cart"}
          </Button>
        )}
      </div>
```

The trust badges and product details below are unchanged.

- [ ] **Step 5: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint`
Expected: no type errors, 0 lint problems. `StockIssueDialog` is now imported
only by `QuickAddSliderBar`, which Task 7 handles.

- [ ] **Step 6: Manual check**

Run `pnpm dev`, open any product with a variant, and confirm: the stepper
maximum falls as items go into the cart; pressing Add repeatedly never disables
the button; once the cart holds all the stock the button reads "All N in cart"
and is disabled; and the network tab shows one `cart.add` per burst, not one
per press.

- [ ] **Step 7: Report the task complete**

Do not commit.

---

### Task 7: Quick Add — ceiling, counter, no auto-open

**Files:**

- Modify: `src/components/products/QuickAddSliderBar.tsx`
- Modify: `src/components/products/quick-add/QuickAddButton.tsx`
- Delete: `src/components/products/StockIssueDialog.tsx`

**Interfaces:**

- Consumes: `quantityInCart`, `remainingCapacity` (Task 2); `useCart`, `useCartAddDelta` (Task 5).
- Produces: `QuickAddButtonProps` = `{ isAuthenticated, inStock, atCeiling, inCartQuantity, pendingAdded, onAdd }`.

Three things change together because they are one behaviour.

`justAdded` (line 63) is a fixed 2s flag; under burst pressing it re-arms thirty
times and reads "Added!" throughout, telling the customer nothing about whether
press seven registered. It reads the live pending delta instead, so the button
is itself the evidence — "Added 7" — and the count climbing toward the ceiling
is legible.

`openCart()` on line 120 was correct when one press meant one add. With burst
pressing, press one slides the drawer over the card still being pressed. Quick
Add drops it; the navbar badge is the confirmation. The product page keeps its
auto-open (Task 6) — there is no burst problem behind a full-width button.

And the per-press `toast.success` goes with it, for the same reason: thirty
presses would stack thirty toasts.

**`StockIssueDialog` is deleted.** Its only two call sites read the rejected
add's error message synchronously from a `catch`, and there is no longer a
rejection to catch — the add resolves locally and any server refusal surfaces
from the provider as a retry toast carrying the server's own message ("Only 2
left in stock"). Keeping a component with no reachable caller is exactly the
dead code this repo has already cleared once.

- [ ] **Step 1: Rewrite the head of `QuickAddSliderBar.tsx`**

Replace lines 10-22 (the directive and imports) with:

```tsx
"use client";

import { useState } from "react";
import { useCart, useCartAddDelta } from "@/components/providers/cart-provider";
import { toast } from "sonner";

import { VerticalWheel } from "@/components/products/quick-add/VerticalWheel";
import { QuickAddButton } from "@/components/products/quick-add/QuickAddButton";
import { useVariantStock } from "@/hooks/use-variant-stock";
import { quantityInCart, remainingCapacity } from "@/lib/cart-stock-limit";
```

- [ ] **Step 2: Replace the component's state and derived values**

Replace lines 60-92 (from `const [sizeIndex...]` through the `inStock` const)
with:

```tsx
const [sizeIndex, setSizeIndex] = useState(0);
const [colorIndex, setColorIndex] = useState(0);

// Shares the same cached stock query as the product page — one fetch per set
// of variants, refreshed in the background, not one request per add.
const stock = useVariantStock(variants.map((v) => v.id));

const { addItem, isAuthenticated, items } = useCart();

const selectedSize = sizes[sizeIndex] || null;
const selectedColor = colors[colorIndex] || null;

// Check if the selected combination is in stock
const matchingVariant = variants.find(
  (v) =>
    (selectedSize === null || v.size === selectedSize) &&
    (selectedColor === null || v.color === selectedColor)
);
const variantId = matchingVariant?.id ?? null;

// Live figure when the cache has it, otherwise the flag the grid was rendered
// with.
const liveStock = stock.get(matchingVariant?.id);
const inStock =
  liveStock !== null ? liveStock > 0 : (matchingVariant?.inStock ?? false);

// What the cart already holds is part of the ceiling: the server checks
// `already in cart + requested <= stock`, and the customer should not have to
// discover that by being refused.
const inCartQuantity = quantityInCart(items, productId, variantId);
const remaining = remainingCapacity(liveStock, inCartQuantity);
const atCeiling = inStock && remaining === 0;

// Units this button has queued that the server has not confirmed. Replaces
// the old fixed 2s "Added!" flag, which under burst pressing re-armed thirty
// times and said nothing about whether press seven landed.
const pendingAdded = useCartAddDelta(productId, variantId);
```

- [ ] **Step 3: Replace `handleQuickAdd`**

Replace lines 94-147 with:

```tsx
const handleQuickAdd = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();

  if (!inStock) {
    toast.error("This combination is out of stock");
    return;
  }

  // The button is disabled at the ceiling; this is the belt to that pair of
  // braces, and it is what makes "the thirty-first press issues no request"
  // true at the call site rather than only in the arithmetic.
  if (remaining <= 0) return;

  // Local and immediate. Thirty presses become one additive `cart.add`; a
  // refusal surfaces from the provider as a toast with a Retry action.
  addItem(productId, 1, variantId, {
    productName,
    productPrice,
    productImage: productImage ?? null,
    variantLabel:
      [selectedSize, selectedColor].filter(Boolean).join(" / ") || null,
    // The grid's variant shape carries only a boolean, so when the live
    // cache has no figure yet we allow one unit and let the server resolve
    // the real ceiling.
    maxStock: liveStock ?? 1,
  });

  // No `openCart()` here on purpose: with burst pressing, press one would
  // slide the drawer over the card still being pressed. The navbar badge and
  // the button's own "Added N" are the confirmation.
};
```

- [ ] **Step 4: Update the JSX**

1. In the `variants.length === 0` fallback, leave the button as it is — it still
   calls `handleQuickAdd`.
2. Replace the `<QuickAddButton .../>` element with:

```tsx
<QuickAddButton
  isAuthenticated={isAuthenticated}
  inStock={inStock}
  atCeiling={atCeiling}
  inCartQuantity={inCartQuantity}
  pendingAdded={pendingAdded}
  onAdd={handleQuickAdd}
/>
```

3. Delete the `<StockIssueDialog ... />` element (lines 197-200).

- [ ] **Step 5: Rewrite `QuickAddButton.tsx`**

Replace the whole file with:

```tsx
"use client";

import { ShoppingCart, Check, LogIn } from "lucide-react";

interface QuickAddButtonProps {
  isAuthenticated: boolean;
  inStock: boolean;
  /** In stock, but the cart already holds every available unit. */
  atCeiling: boolean;
  /** How many are already in the cart, for the at-ceiling label. */
  inCartQuantity: number;
  /** Units queued locally that the server has not confirmed yet. */
  pendingAdded: number;
  onAdd: (e: React.MouseEvent) => void;
}

export function QuickAddButton({
  isAuthenticated,
  inStock,
  atCeiling,
  inCartQuantity,
  pendingAdded,
  onAdd,
}: QuickAddButtonProps) {
  if (!isAuthenticated) {
    return (
      <a
        href={`/login?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-center gap-1 w-full bg-val-accent hover:bg-val-accent/90 text-white text-[10px] py-2 rounded-md font-semibold transition-colors"
      >
        <LogIn className="h-3 w-3" />
        Sign In
      </a>
    );
  }

  // Two different stops, two different words: nothing left to sell, versus the
  // customer already holding all of it. "Sold Out" for the second would be a
  // lie about the product.
  const stopped = !inStock || atCeiling;

  return (
    <button
      onClick={onAdd}
      // Never disabled merely because a write is in flight — the press is a
      // local write, and a button that goes dead between presses is the whole
      // problem this replaces.
      disabled={stopped}
      className={`flex items-center justify-center gap-1 w-full text-[10px] py-2 rounded-md font-semibold transition-all duration-200 ${
        stopped
          ? "bg-gray-700 text-gray-400 cursor-not-allowed"
          : pendingAdded > 0
            ? "bg-green-600 text-white"
            : "bg-white text-black hover:bg-val-silver"
      }`}
    >
      {!inStock ? (
        "Sold Out"
      ) : atCeiling ? (
        `All ${inCartQuantity} in cart`
      ) : pendingAdded > 0 ? (
        <>
          <Check className="h-3 w-3" />
          Added {pendingAdded}
        </>
      ) : (
        <>
          <ShoppingCart className="h-3 w-3" />
          Add
        </>
      )}
    </button>
  );
}
```

- [ ] **Step 6: Delete the dialog**

```bash
rm src/components/products/StockIssueDialog.tsx
```

Confirm nothing still imports it:

```bash
grep -rn "StockIssueDialog" src
```

Expected: no output.

- [ ] **Step 7: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: no type errors, 0 lint problems, all tests passing.

- [ ] **Step 8: Manual check**

`pnpm dev`, open a collection page, and press one card's Add repeatedly: the
button turns green and counts up, the drawer does not open, no toast stack
appears, the badge climbs, and after a second the network tab shows a single
`cart.add`. Press until the count reaches the variant's stock and confirm the
button switches to "All N in cart" and stops firing.

- [ ] **Step 9: Report the task complete**

Do not commit. Mention that `StockIssueDialog.tsx` was deleted and why.

---

### Task 8: Un-freeze the cart and flush before checkout

**Files:**

- Modify: `src/components/cart/CartItem.tsx`
- Modify: `src/components/cart/CartDrawer.tsx`
- Modify: `src/components/cart/CartPopulated.tsx`
- Modify: `src/lib/stores/cart-store.ts`
- Modify: `src/components/providers/cart-provider.tsx`

**Interfaces:**

- Consumes: `flushPendingWrites` from `useCart()` (Task 5).
- Produces: `CartItemProps` without `disabled`; `CartState` without `isSyncing`; `CartActions` without `setSyncing`; `useCart()` no longer returns `isSyncing`.

`disabled={isSyncing}` is applied to every control in both cart surfaces
(`CartDrawer.tsx:97,137`, `CartPopulated.tsx:37,54,81`), so editing one line
locks the whole cart while a write is in flight — the optimistic value lands
instantly and the UI freezes anyway. There is nothing left to protect: every
quantity edit is last-call-wins on a shared debounce and every removal is
optimistic with a retry.

The Checkout button is the one place where waiting is right, but disabling was
the wrong instrument — it approximated "the server has caught up" only by
accident. It now **flushes** both registries and awaits them, so checkout can
never open against a cart the server is behind on.

- [ ] **Step 1: Drop the `disabled` prop from `CartItem`**

In `src/components/cart/CartItem.tsx`:

1. Remove `disabled?: boolean;` from `CartItemProps` and `disabled = false,`
   from the destructure.
2. The decrease button becomes `disabled={!canDecrease}`.
3. The increase button becomes `disabled={!canIncrease}`.
4. The remove button loses its `disabled={disabled}` attribute entirely.

`canDecrease` / `canIncrease` are the real constraints and stay exactly as they
are — `canIncrease` already reads `item.quantity < ceiling` against the live
`availableFor(item.id)`, which is correct and needs no change.

- [ ] **Step 2: Rewrite the checkout path in `CartDrawer.tsx`**

Replace lines 1-48 (through the `useCartStock` destructure) with:

```tsx
/**
 * Cart Drawer Component
 *
 * Slide-out drawer showing cart contents.
 * Uses Sheet component from shadcn/ui.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  ArrowRight,
  ShoppingCart,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CartItem } from "./CartItem";
import { CouponField } from "./CouponField";
import { useCart } from "@/components/providers/cart-provider";
import { useCartStock } from "@/components/providers/cart-stock-provider";
import { formatCurrency } from "@/lib/currency";

export function CartDrawer() {
  const {
    items,
    isOpen,
    itemCount,
    subtotal,
    isEmpty,
    isAuthenticated,
    updateQuantity,
    removeItem,
    closeCart,
    flushPendingWrites,
  } = useCart();

  // Opening the drawer is an action, so the check runs here too — the customer
  // should not be able to look straight at a cart that cannot be ordered.
  const { hasProblems, openDialog } = useCartStock();

  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);

  /**
   * Send everything still on a debounce before leaving for checkout.
   *
   * This replaces `disabled={isSyncing}`, which blocked the button while *any*
   * write was in flight and did nothing at all during the debounce window
   * before it — the moment when the cart is actually ahead of the server.
   */
  const handleCheckout = async () => {
    setIsLeaving(true);
    try {
      await flushPendingWrites();
    } finally {
      setIsLeaving(false);
    }
    closeCart();
    router.push("/checkout");
  };
```

- [ ] **Step 3: Un-freeze the drawer's controls**

1. In the `items.map`, delete `disabled={isSyncing}` from `<CartItem />`.
2. Replace the non-`hasProblems` checkout `<Button>` — lines 133-144, the element itself, not the `) : (` and `)}` that bracket it — with:

```tsx
<Button
  className="w-full bg-val-accent hover:bg-val-accent/90 text-black font-medium"
  size="lg"
  onClick={handleCheckout}
  disabled={isLeaving}
>
  {isLeaving ? (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  ) : (
    <ShoppingBag className="mr-2 h-4 w-4" />
  )}
  Checkout
  <ArrowRight className="ml-2 h-4 w-4" />
</Button>
```

`Link` is still imported and still used by the empty-cart CTA and the "View
Full Cart" button, so leave the import alone.

- [ ] **Step 4: Do the same in `CartPopulated.tsx`**

Replace the whole file with:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartItem } from "@/components/cart/CartItem";
import { CartSummary } from "@/components/cart/CartSummary";
import { CouponField } from "@/components/cart/CouponField";
import { useCart } from "@/components/providers/cart-provider";
import { useCartStock } from "@/components/providers/cart-stock-provider";

export function CartPopulated() {
  const {
    items,
    itemCount,
    subtotal,
    updateQuantity,
    removeItem,
    clearCart,
    flushPendingWrites,
  } = useCart();

  const { hasProblems, openDialog } = useCartStock();

  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);

  // See CartDrawer: checkout waits for the server to catch up, rather than the
  // whole cart being disabled whenever it hasn't.
  const handleCheckout = async () => {
    setIsLeaving(true);
    try {
      await flushPendingWrites();
    } finally {
      setIsLeaving(false);
    }
    router.push("/checkout");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          Your Cart ({itemCount} {itemCount === 1 ? "item" : "items"})
        </h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-red-400"
          onClick={clearCart}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Cart
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-white/10 bg-zinc-900 p-4">
            {items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            ))}
          </div>

          {/* Continue Shopping */}
          <div className="mt-6">
            <Button variant="outline" asChild>
              <Link href="/collections/all">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Continue Shopping
              </Link>
            </Button>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1 space-y-4">
          {/* Above the summary: the code is entered before the totals it will
              change, and the summary itself quotes no discount — checkout
              prices the coupon. */}
          <div className="rounded-lg border border-white/10 bg-zinc-900 p-4">
            <CouponField />
          </div>
          <CartSummary
            subtotal={subtotal}
            itemCount={itemCount}
            onCheckout={handleCheckout}
            isLoading={isLeaving}
            stockBlocked={hasProblems}
            onReviewStock={openDialog}
          />
        </div>
      </div>
    </div>
  );
}
```

`CartSummary` needs no change: it already renders a spinner when `isLoading` is
set alongside an `onCheckout` handler.

- [ ] **Step 5: Delete `isSyncing`**

Nothing sets it any more (Task 5 removed the four `setSyncing` calls) and
nothing reads it (Steps 1-4 removed the five call sites), so remove the field
rather than leaving a permanently-false flag for the next person to reason
about.

In `src/lib/stores/cart-store.ts`:

1. Remove `isSyncing: boolean;` from `CartState`.
2. Remove `setSyncing: (syncing: boolean) => void;` from `CartActions`.
3. Remove `isSyncing: false,` from the initial state.
4. Remove the `setSyncing: (syncing: boolean) => set({ isSyncing: syncing }),`
   action.

`partialize` persists only `items`, so no persisted cart needs migrating.

In `src/components/providers/cart-provider.tsx`, remove `isSyncing: store.isSyncing,`
from the object `useCart()` returns.

- [ ] **Step 6: Confirm it is gone**

```bash
grep -rn "isSyncing\|setSyncing" src
```

Expected: no output.

- [ ] **Step 7: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: no type errors, 0 lint problems, all tests passing.

- [ ] **Step 8: Manual check**

`pnpm dev`. In the drawer, hold the `+` on a line: the number climbs freely and
no other line's controls grey out. Press Checkout immediately after an edit and
confirm the button shows its spinner briefly, then navigates, and that the
checkout page's totals match what the cart showed.

- [ ] **Step 9: Report the task complete**

Do not commit.

---

### Task 9: Wishlist

**Files:**

- Modify: `src/app/(main)/account/wishlist/page.tsx`
- Modify: `src/components/wishlist/WishlistButton.tsx`

**Interfaces:**

- Consumes: `cachePatch`, `runOptimistic` (Task 1); `showRetryToast` (Task 1).
- Produces: nothing new.

The wishlist page awaits a round trip and then invalidates, so a removed row
sits there for ~58ms warm and ~560ms on a cold connection before it goes.

**Only removal is optimistic, and there is no stock ceiling here.** A saved item
is allowed to be sold out — the grid already says so
(`WishlistGrid.tsx:90`, "Unavailable right now — it stays saved here") — and the
grid's cart button is a `Link` to the product page (`WishlistGrid.tsx:112`), not
an add, because a wishlist entry is a product rather than a variant.

`WishlistButton` is re-expressed on the shared helpers in the same task. It is
already correct; the point is that it stops being the only place the sequence
is spelled out, and it gains the retry affordance the rest now have.

- [ ] **Step 1: Rewrite the wishlist page**

Replace `src/app/(main)/account/wishlist/page.tsx` with:

```tsx
"use client";

/**
 * Wishlist Page (Account)
 *
 * Displays user's saved items within the account layout.
 */

import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cachePatch, runOptimistic } from "@/lib/optimistic-patches";
import { showRetryToast } from "@/lib/optimistic-toast";

import { WishlistLoading } from "@/components/account/wishlist/WishlistLoading";
import { WishlistEmpty } from "@/components/account/wishlist/WishlistEmpty";
import { WishlistGrid } from "@/components/account/wishlist/WishlistGrid";

export default function WishlistPage() {
  const utils = trpc.useUtils();

  const { data: wishlistItems, isLoading } =
    trpc.public.wishlist.getMyWishlist.useQuery();

  // Hoisted so the mutation's own `onError` can re-run it without TypeScript
  // having to infer the mutation's type from options that reference it.
  function retryRemove(productId: string) {
    removeMutation.mutate({ productId });
  }

  const removeMutation = trpc.public.wishlist.removeFromWishlist.useMutation({
    // Three caches move together: the grid, the navbar count, and the heart on
    // any product card showing this product.
    onMutate: ({ productId }) =>
      runOptimistic([
        cachePatch({
          cancel: () => utils.public.wishlist.getMyWishlist.cancel(),
          read: () => utils.public.wishlist.getMyWishlist.getData(),
          write: (data) =>
            utils.public.wishlist.getMyWishlist.setData(undefined, data),
          invalidate: () => utils.public.wishlist.getMyWishlist.invalidate(),
          patch: (items) =>
            items?.filter((item) => item.productId !== productId),
        }),
        cachePatch({
          cancel: () => utils.public.wishlist.getCount.cancel(),
          read: () => utils.public.wishlist.getCount.getData(),
          write: (data) =>
            utils.public.wishlist.getCount.setData(undefined, data),
          invalidate: () => utils.public.wishlist.getCount.invalidate(),
          patch: (current) =>
            current && { count: Math.max(0, current.count - 1) },
        }),
        cachePatch({
          cancel: () => utils.public.wishlist.checkStatus.cancel({ productId }),
          read: () => utils.public.wishlist.checkStatus.getData({ productId }),
          write: (data) =>
            utils.public.wishlist.checkStatus.setData({ productId }, data),
          invalidate: () =>
            utils.public.wishlist.checkStatus.invalidate({ productId }),
          patch: () => ({ inWishlist: false }) as const,
        }),
      ]),
    onSuccess: () => {
      toast.success("Removed from wishlist");
    },
    onError: (_err, variables, handle) => {
      handle?.rollback();
      showRetryToast("Couldn't remove that from your wishlist.", () =>
        retryRemove(variables.productId)
      );
    },
    onSettled: (_data, _err, _variables, handle) => {
      handle?.settle();
    },
  });

  const handleRemove = (productId: string) => {
    removeMutation.mutate({ productId });
  };

  if (isLoading) return <WishlistLoading />;
  if (!wishlistItems || wishlistItems.length === 0) return <WishlistEmpty />;

  return <WishlistGrid items={wishlistItems} onRemove={handleRemove} />;
}
```

- [ ] **Step 2: Re-express `WishlistButton` on the shared helpers**

In `src/components/wishlist/WishlistButton.tsx`, add the imports:

```ts
import { cachePatch, runOptimistic } from "@/lib/optimistic-patches";
import { showRetryToast } from "@/lib/optimistic-toast";
```

Then replace both mutations (lines 51-107) with:

```ts
/**
 * The heart's own cache, patched for both directions.
 *
 * This component was the storefront's only correct optimistic mutation, and
 * it cost 55 hand-written lines to be so — which is exactly why nothing else
 * was. Same behaviour, now expressed in the shared vocabulary.
 */
const statusPatch = (inWishlist: boolean) =>
  cachePatch({
    cancel: () => utils.public.wishlist.checkStatus.cancel({ productId }),
    read: () => utils.public.wishlist.checkStatus.getData({ productId }),
    write: (data) =>
      utils.public.wishlist.checkStatus.setData({ productId }, data),
    invalidate: () =>
      utils.public.wishlist.checkStatus.invalidate({ productId }),
    patch: () => ({ inWishlist }) as const,
  });

const refreshLists = () => {
  utils.public.wishlist.getMyWishlist.invalidate();
  utils.public.wishlist.getCount.invalidate();
};

function retryAdd() {
  addMutation.mutate({ productId });
}

function retryRemove() {
  removeMutation.mutate({ productId });
}

const addMutation = trpc.public.wishlist.addToWishlist.useMutation({
  onMutate: () => runOptimistic([statusPatch(true)]),
  onSuccess: () => {
    refreshLists();
    toast("Added to wishlist");
  },
  onError: (_err, _variables, handle) => {
    handle?.rollback();
    showRetryToast("Couldn't add that to your wishlist.", retryAdd);
  },
  onSettled: (_data, _err, _variables, handle) => {
    handle?.settle();
  },
});

const removeMutation = trpc.public.wishlist.removeFromWishlist.useMutation({
  onMutate: () => runOptimistic([statusPatch(false)]),
  onSuccess: () => {
    refreshLists();
    toast("Removed from wishlist");
  },
  onError: (_err, _variables, handle) => {
    handle?.rollback();
    showRetryToast("Couldn't remove that from your wishlist.", retryRemove);
  },
  onSettled: (_data, _err, _variables, handle) => {
    handle?.settle();
  },
});
```

- [ ] **Step 3: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: no type errors, 0 lint problems, all tests passing.

- [ ] **Step 4: Manual check**

`pnpm dev`, sign in, save two products, open `/account/wishlist` and remove one:
the row goes immediately and the navbar count drops with it. Toggle a heart on a
product card and confirm it fills instantly and stays filled.

- [ ] **Step 5: Report the task complete**

Do not commit.

---

### Task 10: Notifications

**Files:**

- Modify: `src/components/UserNotificationsBell.tsx`
- Modify: `src/app/(main)/account/notifications/page.tsx`

**Interfaces:**

- Consumes: `cachePatch`, `runOptimistic`, `showRetryToast` (Task 1).
- Produces: nothing new.

The most visible of the remaining surfaces: the badge currently lags every
click, because both files invalidate and wait.

**Each component patches its own query key.** `list` is called with
`{ limit: 10 }` in the bell and `{ limit: PAGE_LIMIT, unreadOnly }` on the page,
and `setData` addresses one input at a time. Passing the same input object the
component's `useQuery` uses is what makes the patch land; passing `undefined`
silently patches nothing.

**`unreadOnly` changes what "mark as read" means.** On the Unread tab a row that
becomes read leaves the list; on All it stays and loses its emphasis. The patch
has to branch on the active filter or the row visibly refuses to go away.

- [ ] **Step 1: Make the bell optimistic**

In `src/components/UserNotificationsBell.tsx`, add the imports:

```ts
import { cachePatch, runOptimistic } from "@/lib/optimistic-patches";
import { showRetryToast } from "@/lib/optimistic-toast";
```

Replace the two mutations (lines 44-57) with:

```ts
const listInput = { limit: 10 } as const;

/** The dropdown's ten most recent, patched in place. */
const listPatch = (
  patch: (
    rows: RouterOutputs["public"]["notifications"]["list"] | undefined
  ) => RouterOutputs["public"]["notifications"]["list"] | undefined
) =>
  cachePatch({
    cancel: () => utils.public.notifications.list.cancel(listInput),
    read: () => utils.public.notifications.list.getData(listInput),
    write: (data) => utils.public.notifications.list.setData(listInput, data),
    invalidate: () => utils.public.notifications.list.invalidate(),
    patch,
  });

/** The badge. */
const countPatch = (next: (current: number) => number) =>
  cachePatch({
    cancel: () => utils.public.notifications.unreadCount.cancel(),
    read: () => utils.public.notifications.unreadCount.getData(),
    write: (data) =>
      utils.public.notifications.unreadCount.setData(undefined, data),
    invalidate: () => utils.public.notifications.unreadCount.invalidate(),
    patch: (current) => (current === undefined ? current : next(current)),
  });

function retryMarkAsRead(id: string) {
  markAsReadMutation.mutate({ id });
}

const markAsReadMutation = trpc.public.notifications.markAsRead.useMutation({
  onMutate: ({ id }) =>
    runOptimistic([
      listPatch((rows) =>
        rows?.map((row) => (row.id === id ? { ...row, isRead: true } : row))
      ),
      countPatch((current) => Math.max(0, current - 1)),
    ]),
  onError: (_err, variables, handle) => {
    handle?.rollback();
    showRetryToast("Couldn't mark that as read.", () =>
      retryMarkAsRead(variables.id)
    );
  },
  onSettled: (_data, _err, _variables, handle) => {
    handle?.settle();
  },
});

function retryMarkAllAsRead() {
  markAllAsReadMutation.mutate();
}

const markAllAsReadMutation =
  trpc.public.notifications.markAllAsRead.useMutation({
    onMutate: () =>
      runOptimistic([
        listPatch((rows) => rows?.map((row) => ({ ...row, isRead: true }))),
        countPatch(() => 0),
      ]),
    onError: (_err, _variables, handle) => {
      handle?.rollback();
      showRetryToast("Couldn't mark them all as read.", retryMarkAllAsRead);
    },
    onSettled: (_data, _err, _variables, handle) => {
      handle?.settle();
    },
  });
```

Add the router-output type alias near the top of the file, beside the other
imports:

```ts
import type { AppRouter } from "@/server";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
```

The bell already guards its call with `if (!n.isRead)`, so the count patch never
double-decrements a row that was already read.

- [ ] **Step 2: Make the notifications page optimistic**

In `src/app/(main)/account/notifications/page.tsx`, add the imports:

```ts
import { cachePatch, runOptimistic } from "@/lib/optimistic-patches";
import { showRetryToast } from "@/lib/optimistic-toast";
import type { AppRouter } from "@/server";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type NotificationRows = RouterOutputs["public"]["notifications"]["list"];
```

Replace the `refresh` helper and the three mutations (lines 36-62) with:

```ts
const listInput = { limit: PAGE_LIMIT, unreadOnly };

const listPatch = (
  patch: (rows: NotificationRows | undefined) => NotificationRows | undefined
) =>
  cachePatch({
    cancel: () => utils.public.notifications.list.cancel(listInput),
    read: () => utils.public.notifications.list.getData(listInput),
    write: (data) => utils.public.notifications.list.setData(listInput, data),
    invalidate: () => utils.public.notifications.list.invalidate(),
    patch,
  });

const countPatch = (next: (current: number) => number) =>
  cachePatch({
    cancel: () => utils.public.notifications.unreadCount.cancel(),
    read: () => utils.public.notifications.unreadCount.getData(),
    write: (data) =>
      utils.public.notifications.unreadCount.setData(undefined, data),
    invalidate: () => utils.public.notifications.unreadCount.invalidate(),
    patch: (current) => (current === undefined ? current : next(current)),
  });

/** Was this row unread a moment ago? Decides whether the badge moves. */
const isUnread = (id: string) =>
  utils.public.notifications.list
    .getData(listInput)
    ?.find((row) => row.id === id)?.isRead === false;

function retryMarkAsRead(id: string) {
  markAsRead.mutate({ id });
}

const markAsRead = trpc.public.notifications.markAsRead.useMutation({
  onMutate: ({ id }) => {
    const wasUnread = isUnread(id);
    return runOptimistic([
      listPatch((rows) =>
        // On the Unread tab a row that becomes read leaves the list; on All
        // it stays and simply loses its emphasis.
        unreadOnly
          ? rows?.filter((row) => row.id !== id)
          : rows?.map((row) => (row.id === id ? { ...row, isRead: true } : row))
      ),
      countPatch((current) => (wasUnread ? Math.max(0, current - 1) : current)),
    ]);
  },
  onError: (_err, variables, handle) => {
    handle?.rollback();
    showRetryToast("Couldn't mark that as read.", () =>
      retryMarkAsRead(variables.id)
    );
  },
  onSettled: (_data, _err, _variables, handle) => {
    handle?.settle();
  },
});

function retryMarkAllAsRead() {
  markAllAsRead.mutate();
}

const markAllAsRead = trpc.public.notifications.markAllAsRead.useMutation({
  onMutate: () =>
    runOptimistic([
      listPatch((rows) =>
        unreadOnly ? [] : rows?.map((row) => ({ ...row, isRead: true }))
      ),
      countPatch(() => 0),
    ]),
  onSuccess: () => {
    toast.success("All notifications marked as read");
  },
  onError: (_err, _variables, handle) => {
    handle?.rollback();
    showRetryToast("Couldn't mark them all as read.", retryMarkAllAsRead);
  },
  onSettled: (_data, _err, _variables, handle) => {
    handle?.settle();
  },
});

function retryDelete(id: string) {
  remove.mutate({ id });
}

const remove = trpc.public.notifications.delete.useMutation({
  onMutate: ({ id }) => {
    const wasUnread = isUnread(id);
    return runOptimistic([
      listPatch((rows) => rows?.filter((row) => row.id !== id)),
      countPatch((current) => (wasUnread ? Math.max(0, current - 1) : current)),
    ]);
  },
  onSuccess: () => {
    toast.success("Notification deleted");
  },
  onError: (_err, variables, handle) => {
    handle?.rollback();
    showRetryToast("Couldn't delete that notification.", () =>
      retryDelete(variables.id)
    );
  },
  onSettled: (_data, _err, _variables, handle) => {
    handle?.settle();
  },
});
```

`markAllAsRead.isPending` is still read by the "Mark all read" button's
`disabled`; leave it, since mark-all is a single deliberate action rather than
something anyone presses in a burst.

- [ ] **Step 3: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: no type errors, 0 lint problems, all tests passing.

- [ ] **Step 4: Manual check**

`pnpm dev`. With unread notifications, open the bell and click one: the badge
drops on the click, not a beat later. On `/account/notifications`, switch to
Unread and mark one read — it leaves the list immediately. Delete one and
confirm the row goes at once and the count follows only when it was unread.

- [ ] **Step 5: Report the task complete**

Do not commit.

---

### Task 11: Addresses and profile

**Files:**

- Modify: `src/app/(main)/account/addresses/page.tsx`
- Modify: `src/components/account/profile/ProfileForm.tsx`

**Interfaces:**

- Consumes: `cachePatch`, `runOptimistic`, `showRetryToast` (Task 1).
- Produces: nothing new.

Four address mutations and one profile mutation, all invalidate-and-wait today.

**Create needs a temporary id.** `address.create` returns `{ success: true }`,
not the row, so the optimistic entry carries a `optimistic-` prefixed id and is
replaced wholesale when the invalidation lands. That prefix must never be sent
back to the server, which is why the row is appended for display only and the
Edit and Delete handlers on it are simply wrong until the real row arrives — a
sub-second window, and the same trade the cart makes with `pending-`.

**Set-default is a pure list transform**: exactly one row carries `isDefault`,
so the patch needs no server data at all.

- [ ] **Step 1: Rewrite the address mutations**

In `src/app/(main)/account/addresses/page.tsx`, add the imports:

```ts
import { cachePatch, runOptimistic } from "@/lib/optimistic-patches";
import { showRetryToast } from "@/lib/optimistic-toast";
import type { AddressItem } from "@/components/account/addresses/AddressList";
```

(`AddressItem` is already imported alongside `AddressList` — extend that import
rather than adding a second one.)

Replace the four mutations (lines 29-76) with:

```ts
const listPatch = (
  patch: (rows: AddressItem[] | undefined) => AddressItem[] | undefined
) =>
  cachePatch({
    cancel: () => utils.public.address.list.cancel(),
    read: () => utils.public.address.list.getData(),
    write: (data) => utils.public.address.list.setData(undefined, data),
    invalidate: () => utils.public.address.list.invalidate(),
    patch,
  });

function retryCreate(data: AddressInput) {
  createMutation.mutate(data);
}

const createMutation = trpc.public.address.create.useMutation({
  // The server returns `{ success: true }`, not the row, so the optimistic
  // entry carries a temporary id and is replaced outright by the refetch.
  // The prefix marks it as never safe to send back.
  onMutate: (input) =>
    runOptimistic([
      listPatch((rows) => [
        ...(rows ?? []),
        {
          id: `optimistic-${crypto.randomUUID()}`,
          name: input.name,
          street: input.street,
          city: input.city,
          state: input.state ?? "",
          zipCode: input.zipCode ?? "",
          country: input.country ?? "",
          phone: input.phone,
          // Zod defaults this server-side, so the *input* type has it
          // optional — the list row does not.
          addressType: input.addressType ?? "shipping",
          // The first address a customer saves becomes their default.
          isDefault: (rows ?? []).length === 0,
        },
      ]),
    ]),
  onSuccess: () => {
    toast("Address added");
    setIsDialogOpen(false);
  },
  onError: (err, variables, handle) => {
    handle?.rollback();
    showRetryToast(err.message || "Couldn't add that address.", () =>
      retryCreate(variables)
    );
  },
  onSettled: (_data, _err, _variables, handle) => {
    handle?.settle();
  },
});

function retryUpdate(input: { id: string; data: AddressInput }) {
  updateMutation.mutate(input);
}

const updateMutation = trpc.public.address.update.useMutation({
  onMutate: ({ id, data }) =>
    runOptimistic([
      listPatch((rows) =>
        rows?.map((row) =>
          row.id === id
            ? {
                ...row,
                name: data.name,
                street: data.street,
                city: data.city,
                state: data.state ?? "",
                zipCode: data.zipCode ?? "",
                country: data.country ?? "",
                phone: data.phone,
                addressType: data.addressType ?? "shipping",
              }
            : row
        )
      ),
    ]),
  onSuccess: () => {
    toast("Address updated");
    setIsDialogOpen(false);
    setEditingAddress(null);
  },
  onError: (err, variables, handle) => {
    handle?.rollback();
    showRetryToast(err.message || "Couldn't update that address.", () =>
      retryUpdate(variables)
    );
  },
  onSettled: (_data, _err, _variables, handle) => {
    handle?.settle();
  },
});

function retryDelete(id: string) {
  deleteMutation.mutate({ id });
}

const deleteMutation = trpc.public.address.delete.useMutation({
  onMutate: ({ id }) =>
    runOptimistic([listPatch((rows) => rows?.filter((row) => row.id !== id))]),
  onSuccess: () => {
    toast("Address deleted");
  },
  // Without an error handler at all, this once failed in total silence — no
  // toast, no error, the row still on screen. Rolling back is not enough on
  // its own; the customer has to be told the row came back on purpose.
  onError: (err, variables, handle) => {
    handle?.rollback();
    showRetryToast(err.message || "Couldn't delete that address.", () =>
      retryDelete(variables.id)
    );
  },
  onSettled: (_data, _err, _variables, handle) => {
    handle?.settle();
  },
});

function retrySetDefault(id: string) {
  setDefaultMutation.mutate({ id });
}

const setDefaultMutation = trpc.public.address.setDefault.useMutation({
  // Exactly one row is default, so this needs nothing from the server.
  onMutate: ({ id }) =>
    runOptimistic([
      listPatch((rows) =>
        rows?.map((row) => ({ ...row, isDefault: row.id === id }))
      ),
    ]),
  onSuccess: () => {
    toast("Default address updated");
  },
  onError: (err, variables, handle) => {
    handle?.rollback();
    showRetryToast(err.message || "Couldn't update your default address.", () =>
      retrySetDefault(variables.id)
    );
  },
  onSettled: (_data, _err, _variables, handle) => {
    handle?.settle();
  },
});
```

Add the input type alias above them, beside the `AddressItem` import:

```ts
type RouterInputs = inferRouterInputs<AppRouter>;
type AddressInput = RouterInputs["public"]["address"]["create"];
```

with:

```ts
import type { AppRouter } from "@/server";
import type { inferRouterInputs } from "@trpc/server";
```

The JSX needs no change: `isSettingDefault` and `isDeleting` are still passed to
`AddressList` and still reflect a real in-flight mutation — they gate a
double-submit, not the visible row, which has already gone.

- [ ] **Step 2: Make the profile name optimistic**

In `src/components/account/profile/ProfileForm.tsx`, add the imports:

```ts
import { cachePatch, runOptimistic } from "@/lib/optimistic-patches";
import { showRetryToast } from "@/lib/optimistic-toast";
```

Replace the `updateName` mutation (lines 34-42) with:

```ts
function retryUpdateName(nextName: string) {
  updateName.mutate({ name: nextName });
}

const updateName = trpc.public.profile.updateName.useMutation({
  // `profile.me` is what the account header reads, so patching it is what
  // makes the new name appear at the same moment the button is pressed.
  onMutate: ({ name: nextName }) =>
    runOptimistic([
      cachePatch({
        cancel: () => utils.public.profile.me.cancel(),
        read: () => utils.public.profile.me.getData(),
        write: (data) => utils.public.profile.me.setData(undefined, data),
        invalidate: () => utils.public.profile.me.invalidate(),
        patch: (current) => current && { ...current, name: nextName },
      }),
    ]),
  onSuccess: () => {
    toast.success("Profile updated");
  },
  onError: (err, variables, handle) => {
    handle?.rollback();
    showRetryToast(err.message || "Couldn't update your profile.", () =>
      retryUpdateName(variables.name)
    );
  },
  onSettled: (_data, _err, _variables, handle) => {
    handle?.settle();
  },
});
```

Leave the `seededFor` logic alone. It seeds by user id precisely so a refetch —
including this mutation's own invalidation — cannot overwrite a name the
customer is part-way through typing, and the optimistic patch makes that
refetch land sooner rather than less often.

- [ ] **Step 3: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: no type errors, 0 lint problems, all tests passing.

- [ ] **Step 4: Manual check**

`pnpm dev`. On `/account/addresses`: add an address and watch the card appear
before the dialog's spinner would have finished; set a different one as default
and watch the badge move instantly; delete one and watch it go. On
`/account/profile`, change the name and confirm it updates without a pause.

- [ ] **Step 5: Report the task complete**

Do not commit.

---

### Task 12: Full verification

**Files:** none modified — this task only runs things and reports.

**Interfaces:**

- Consumes: everything.
- Produces: the evidence that the feature is done.

- [ ] **Step 1: Confirm the dead code is actually gone**

```bash
grep -rn "isSyncing\|setSyncing\|StockIssueDialog\|GuestCartItemDetails\|justAdded\|isAdding" src
```

Expected: no output. Every one of these was removed by Tasks 5-8; a hit means a
call site was missed.

- [ ] **Step 2: Confirm nothing bypasses the ceiling**

```bash
grep -rn "cart.add.useMutation\|addMutation" src
```

Expected: matches only in `src/components/providers/cart-provider.tsx`. Any
other component calling `cart.add` directly would skip both the debounce and the
ceiling.

- [ ] **Step 3: Run the full suite**

```bash
rm -rf .next && pnpm type-check && pnpm lint && pnpm test && pnpm build
```

Expected:

- `type-check`: no errors.
- `lint`: **0 problems** — this repo's baseline is zero warnings, not just zero
  errors.
- `test`: the pre-existing 469 tests plus roughly 60 new ones across
  `optimistic-patches`, `optimistic-toast`, `cart-stock-limit`,
  `cart-add-registry` and the extended `cart-sync-registry`, all passing.
- `build`: 98 static pages, no new warnings.

- [ ] **Step 4: Walk the feature end to end in the browser**

`pnpm dev`, signed in, with a variant product whose stock you know:

1. Press Quick Add on a card ten times fast. The button counts "Added 1"…
   "Added 10", the drawer does not open, the badge reaches ten, and exactly one
   `cart.add` appears in the network tab about a second after the last press.
2. Keep pressing to the variant's stock. The button switches to "All N in cart"
   and further presses fire no request at all — this is the assertion the whole
   feature rests on.
3. Open the product page for the same product. The stepper maximum is the
   _remaining_ count, not the raw stock, and the button reads "All N in cart".
4. Open the drawer and hold `+` on a line. The number climbs freely, no other
   line greys out, and one `cart.updateQuantity` lands a second after you stop.
5. Press Checkout straight after an edit. The button spins briefly, then the
   checkout page's totals match the cart exactly.
6. Remove a line, then a wishlist item, then mark a notification read, then
   change your default address. Each updates on the click.

- [ ] **Step 5: Report the results**

Do not commit. Report the actual command output — the test count, the lint
result, the build page count — rather than asserting success. If anything
failed, say which and show it.

---

## Risks and things to watch

- **Delta drift.** If a flush fails and `takeBackLocally` misses (the line was
  removed underneath it, say), the local cart and the server disagree until the
  next `cart.get`. Mitigated by rolling back the exact delta the failed call
  carried and by `reconcileServerCart` letting the server win the moment nothing
  is pending.
- **Ceiling staleness.** `remainingCapacity` is computed against the shared
  stock poll, which is 60s on browsing surfaces (`GRID_REFRESH_MS`). A customer
  can still be refused server-side if stock moved inside that window. That is
  acceptable and unchanged from today — the server remains the authority, and
  the cart's own check runs at 15s (`STOCK_CHECK_MS`) where staleness costs a
  failed checkout rather than a re-press.
- **Removing a line whose add is on the wire.** `removeItem` cancels the queued
  delta, but a call already sent will still commit, so the line can reappear on
  the next refetch. The window is under a second and it is strictly better than
  today, where the whole cart froze instead. If it proves annoying, the fix is to
  await `cartAddRegistry.flushAll()` before the remove.
- **Two ids for one line.** An optimistic `pending-` line and its server row
  coexist for one refetch. `reconcileServerCart` matches them on product+variant
  and `quantityInCart` sums rather than finds, so neither double-counts — but
  any new code that looks a cart line up by id alone needs to know this.
- **A new rejection branch in the add path.** `queueAdd`'s `run` closure owns its
  own failure handling; the registry deliberately swallows the rejection after
  it. Adding a new failure mode that does not take its units back out of the
  local store would leave the cart permanently ahead of the server.

## Out of scope, recorded here so it is not re-litigated

- **Guest checkout.** The guest cart pipeline is complete and unreachable:
  `useCart().addItem` has a guest branch, `mergeGuestItems` folds local lines
  into the server cart at sign-in, and `clearSignedOutItems` preserves guest
  lines across session expiry — but `QuickAddButton.tsx:20` and
  `ProductActions.tsx:26` render "Sign In" instead of the add button, so nothing
  reaches it. The intended end state is that **checkout** requires sign-in and
  the existing local cart is carried in. Deliberately deferred; the gate stays.
- **Checkout, reviews and coupons** stay pessimistic — see the spec's Non-goals.
- **Admin**, entirely.
