"use client";

/**
 * Cart Stock Provider
 *
 * One shared, self-refreshing answer to "can this cart actually be fulfilled?",
 * available to the cart drawer, the cart page and checkout.
 *
 * The gap this closes: stock was validated when an item was added and again
 * inside the order transaction, with nothing in between. A customer could add
 * the last two of something, browse for ten minutes while someone else bought
 * them, walk all the way through checkout, and only be told at the final button
 * — as a toast, with no way to act on it.
 *
 * So the cart is reconciled against live stock whenever the customer is
 * actually looking at it, never trusting a figure older than STOCK_CHECK_MS,
 * and problems are surfaced as a dialog that offers a way out.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { useCartStore } from "@/lib/stores/cart-store";
import type { CartStockLine } from "@/application/cart/use-cases/check-cart-stock.use-case";

/** Longest a stock figure is trusted before it is refetched. */
export const STOCK_CHECK_MS = 15_000;

interface CartStockContextValue {
  /** Every cart line with its live availability. */
  lines: CartStockLine[];
  /** Just the lines that cannot be fulfilled as they stand. */
  problems: CartStockLine[];
  hasProblems: boolean;
  isChecking: boolean;
  /** Live ceiling for a cart line, or null while unknown. */
  availableFor: (cartItemId: string) => number | null;
  /**
   * Force an immediate check and return the problems found. Awaited at the
   * points where being wrong actually costs something — opening checkout,
   * placing the order.
   */
  revalidate: () => Promise<CartStockLine[]>;
  /** Re-check in the background, e.g. after the cart changes. */
  refresh: () => void;
  isDialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
}

const CartStockContext = createContext<CartStockContextValue | null>(null);

/** Identifies a specific set of problems, so a dismissed dialog stays dismissed
 * until something actually changes. */
function signatureOf(lines: CartStockLine[]): string {
  return lines
    .map((l) => `${l.cartItemId}:${l.status}:${l.requested}/${l.available}`)
    .sort()
    .join("|");
}

export function CartStockProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  const itemCount = useCartStore((state) => state.items.length);
  const isCartOpen = useCartStore((state) => state.isOpen);
  const pathname = usePathname();

  // Poll only where the customer can see and act on the answer. Elsewhere the
  // staleness rule alone is enough — the next time they open the cart the data
  // is refetched anyway.
  const isWatching =
    isCartOpen || pathname === "/cart" || pathname.startsWith("/checkout");

  const utils = trpc.useUtils();

  const { data, isFetching } = trpc.public.cart.stockStatus.useQuery(
    undefined,
    {
      enabled: isAuthenticated && itemCount > 0,
      staleTime: STOCK_CHECK_MS,
      refetchInterval: isWatching ? STOCK_CHECK_MS : false,
      refetchOnWindowFocus: true,
    }
  );

  const lines = useMemo(() => data?.lines ?? [], [data]);
  const problems = useMemo(
    () => lines.filter((line) => line.status !== "ok"),
    [lines]
  );

  const signature = useMemo(() => signatureOf(problems), [problems]);

  // Visibility is derived, not stored: the dialog is open whenever there is a
  // problem the customer has not already waved away. A *different* problem
  // produces a different signature, so a newly-changed line reopens it rather
  // than being swallowed by an earlier dismissal.
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(
    null
  );

  // Only while the customer is looking at the cart — interrupting someone
  // browsing an unrelated page with a modal would be worse than the toast it
  // replaces.
  const isDialogOpen =
    problems.length > 0 && isWatching && signature !== dismissedSignature;

  const closeDialog = useCallback(
    () => setDismissedSignature(signature),
    [signature]
  );

  const openDialog = useCallback(() => setDismissedSignature(null), []);

  const revalidate = useCallback(async () => {
    await utils.public.cart.stockStatus.invalidate();
    const fresh = await utils.public.cart.stockStatus.fetch();
    return fresh.lines.filter((line) => line.status !== "ok");
  }, [utils]);

  const refresh = useCallback(() => {
    utils.public.cart.stockStatus.invalidate();
  }, [utils]);

  const availableFor = useCallback(
    (cartItemId: string) =>
      lines.find((line) => line.cartItemId === cartItemId)?.available ?? null,
    [lines]
  );

  const value = useMemo<CartStockContextValue>(
    () => ({
      lines,
      problems,
      hasProblems: problems.length > 0,
      isChecking: isFetching,
      availableFor,
      revalidate,
      refresh,
      isDialogOpen,
      openDialog,
      closeDialog,
    }),
    [
      lines,
      problems,
      isFetching,
      availableFor,
      revalidate,
      refresh,
      isDialogOpen,
      openDialog,
      closeDialog,
    ]
  );

  return (
    <CartStockContext.Provider value={value}>
      {children}
    </CartStockContext.Provider>
  );
}

/**
 * Read the shared stock check.
 *
 * Returns a safe inert value when no provider is mounted, so components can be
 * used outside the storefront shell without crashing.
 */
export function useCartStock(): CartStockContextValue {
  const context = useContext(CartStockContext);

  const fallback = useMemo<CartStockContextValue>(
    () => ({
      lines: [],
      problems: [],
      hasProblems: false,
      isChecking: false,
      availableFor: () => null,
      revalidate: async () => [],
      refresh: () => {},
      isDialogOpen: false,
      openDialog: () => {},
      closeDialog: () => {},
    }),
    []
  );

  return context ?? fallback;
}
