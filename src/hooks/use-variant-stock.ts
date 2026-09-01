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
 *
 * **Sharing is the whole point, and it used to be the bug.** The query keys on
 * the ids it is handed, so every product card — each passing its own variants —
 * got its own request and its own polling timer. Under a
 * `VariantStockProvider` this hook now registers its ids with that one shared
 * query and reads the answer from it. Without a provider (the product detail
 * page) it falls back to querying for itself, which is one request for the one
 * product being looked at.
 */

import { useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  useSharedVariantStock,
  type VariantStockLookup,
} from "@/components/providers/variant-stock-provider";

/** How long a cached stock figure is trusted before a background refresh. */
export const STOCK_STALE_MS = 15_000;

export type VariantStock = VariantStockLookup;

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

  const shared = useSharedVariantStock();

  // `register` is stable for the provider's lifetime; depending on the whole
  // context value would re-register on every stock refresh.
  const register = shared?.register;

  useEffect(() => {
    if (!register || ids.length === 0) return;
    return register(ids);
  }, [register, ids]);

  const utils = trpc.useUtils();

  // Only queries when nothing upstream is already doing it for us.
  const standalone = shared === null && ids.length > 0;

  const { data, isLoading } = trpc.public.products.getStock.useQuery(
    { variantIds: ids },
    {
      enabled: standalone,
      staleTime: STOCK_STALE_MS,
      refetchInterval: standalone ? STOCK_STALE_MS : false,
      refetchOnWindowFocus: true,
    }
  );

  const own = useMemo<VariantStock>(
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

  return shared ?? own;
}
