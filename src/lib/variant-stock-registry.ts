/**
 * Variant stock registry
 *
 * The bookkeeping behind `VariantStockProvider`, kept free of React so it can
 * be reasoned about — and tested — on its own.
 *
 * Product cards come and go as the customer scrolls an infinite grid, and many
 * cards ask about overlapping variants. The registry answers one question: given
 * everything currently on screen, which variant ids should the single shared
 * stock query cover?
 */

/** Ceiling on tracked ids, matching the `getStock` input cap. */
export const MAX_TRACKED_VARIANTS = 500;

export interface VariantStockRegistry {
  /**
   * Track these ids until the returned disposer runs.
   *
   * Ref-counted: an id registered by two cards survives one of them
   * unmounting. The disposer is safe to call more than once.
   */
  register(variantIds: string[]): () => void;
  /**
   * The ids the query should cover: deduplicated, sorted, and capped.
   *
   * Sorted so that the same set of cards in a different render order produces
   * the same key and does not look like a new query.
   */
  tracked(): string[];
  /** Distinct ids currently held, ignoring the cap. Diagnostics only. */
  size(): number;
}

export function createVariantStockRegistry(
  maxTracked: number = MAX_TRACKED_VARIANTS
): VariantStockRegistry {
  const counts = new Map<string, number>();

  return {
    register(variantIds: string[]): () => void {
      // Deduplicate within a single call. A card that somehow passes the same
      // id twice must not need two disposers to release it.
      const unique = [...new Set(variantIds.filter(Boolean))];

      for (const id of unique) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }

      let released = false;
      return () => {
        // React can invoke an effect cleanup more than once in development;
        // decrementing twice would drop an id another card still needs.
        if (released) return;
        released = true;

        for (const id of unique) {
          const next = (counts.get(id) ?? 1) - 1;
          if (next <= 0) counts.delete(id);
          else counts.set(id, next);
        }
      };
    },

    tracked(): string[] {
      return [...counts.keys()].sort().slice(0, maxTracked);
    },

    size(): number {
      return counts.size;
    },
  };
}
