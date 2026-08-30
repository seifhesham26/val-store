"use client";

/**
 * useVariantStock
 *
 * One cached, periodically-refreshed copy of variant stock, shared by every
 * component that needs a limit — the product page, the Quick Add wheels and the
 * cart.
 *
 * The point is that the UI should already know the ceiling before the customer
 * reaches it. Discovering it from a rejected add-to-cart is both a wasted round
 * trip and a bad experience. The server still validates every write; this is
 * purely so the interface can be honest up front.
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

/** How long a cached stock figure is trusted before a background refresh. */
export const STOCK_STALE_MS = 15_000;

export interface VariantStock {
  /** Units available for a variant, or null while unknown. */
  get: (variantId: string | null | undefined) => number | null;
  isLoading: boolean;
  /** Force an immediate refresh — call after anything that consumes stock. */
  refresh: () => void;
}

export function useVariantStock(
  variantIds: (string | null | undefined)[]
): VariantStock {
  // Callers pass a freshly-mapped array every render, so memoise on the joined
  // contents rather than the array identity — otherwise this recomputes (and
  // produces a new query input object) on every single render.
  const key = variantIds
    .filter((id): id is string => !!id)
    .sort()
    .join(",");

  const ids = useMemo(() => (key ? key.split(",") : []), [key]);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.public.products.getStock.useQuery(
    { variantIds: ids },
    {
      enabled: ids.length > 0,
      staleTime: STOCK_STALE_MS,
      refetchInterval: STOCK_STALE_MS,
      refetchOnWindowFocus: true,
    }
  );

  return useMemo(
    () => ({
      get: (variantId) => {
        if (!variantId) return null;
        const value = data?.stock?.[variantId];
        return typeof value === "number" ? value : null;
      },
      isLoading,
      refresh: () => {
        utils.public.products.getStock.invalidate();
      },
    }),
    [data, isLoading, utils]
  );
}
