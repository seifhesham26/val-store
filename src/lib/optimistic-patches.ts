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
