"use client";

/**
 * Variant Stock Provider
 *
 * One live stock query for the whole storefront, instead of one per product
 * card.
 *
 * `useVariantStock` keys its query on the variant ids it is given, and every
 * `ProductCard` renders a `QuickAddSliderBar` that calls it with *that card's*
 * variants. So each card produced its own query key, its own request, and its
 * own `refetchInterval` — a twelve-card grid hit `getStock` twelve times on
 * load and twelve more every fifteen seconds, forever, growing as the customer
 * scrolled. The hook's own docstring promised "one cached copy shared by every
 * component"; this is the piece that was missing.
 *
 * Cards register the ids they care about, the provider unions them, and one
 * query serves everybody.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { trpc } from "@/lib/trpc";
import { createVariantStockRegistry } from "@/lib/variant-stock-registry";

/**
 * How often the shared copy refreshes.
 *
 * Deliberately the same fifteen seconds the per-card queries used, so this
 * change is purely a reduction in *how many* requests are made and not in how
 * fresh the answer is — the product page's quantity ceiling stays exactly as
 * current as it was. Affordable now that it is one request rather than one per
 * card.
 */
const GRID_REFRESH_MS = 15_000;

/** Coalesces a burst of card mounts into a single query input. */
const REGISTRATION_FLUSH_MS = 50;

export interface VariantStockLookup {
  /** Units available for a variant, or null while unknown. */
  get: (variantId: string | null | undefined) => number | null;
  isLoading: boolean;
  /** Force an immediate refresh — call after anything that consumes stock. */
  refresh: () => void;
}

interface VariantStockRegistry extends VariantStockLookup {
  /** Track these ids until the returned disposer runs. */
  register: (variantIds: string[]) => () => void;
}

const VariantStockContext = createContext<VariantStockRegistry | null>(null);

export function VariantStockProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ref-counted so a card unmounting during infinite scroll stops us polling
  // for stock nobody is displaying, while ids shared by two cards survive one
  // of them leaving. The bookkeeping is a plain module so it can be tested
  // without mounting React — see `variant-stock-registry.ts`.
  const registry = useRef(createVariantStockRegistry());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [trackedKey, setTrackedKey] = useState("");

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      // Joined into a string so React re-renders on a change of *contents*
      // rather than of array identity; the registry returns them sorted.
      setTrackedKey(registry.current.tracked().join(","));
    }, REGISTRATION_FLUSH_MS);
  }, []);

  const register = useCallback(
    (variantIds: string[]) => {
      const release = registry.current.register(variantIds);
      scheduleFlush();

      return () => {
        release();
        scheduleFlush();
      };
    },
    [scheduleFlush]
  );

  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, []);

  const variantIds = useMemo(
    () => (trackedKey ? trackedKey.split(",") : []),
    [trackedKey]
  );

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.public.products.getStock.useQuery(
    { variantIds },
    {
      enabled: variantIds.length > 0,
      staleTime: GRID_REFRESH_MS,
      refetchInterval: variantIds.length > 0 ? GRID_REFRESH_MS : false,
      refetchOnWindowFocus: true,
    }
  );

  const value = useMemo<VariantStockRegistry>(
    () => ({
      register,
      isLoading,
      get: (variantId) => {
        if (!variantId) return null;
        const value = data?.stock?.[variantId];
        return typeof value === "number" ? value : null;
      },
      refresh: () => {
        utils.public.products.getStock.invalidate();
      },
    }),
    [register, isLoading, data, utils]
  );

  return (
    <VariantStockContext.Provider value={value}>
      {children}
    </VariantStockContext.Provider>
  );
}

/** The shared registry, or null outside a provider. */
export function useSharedVariantStock(): VariantStockRegistry | null {
  return useContext(VariantStockContext);
}
