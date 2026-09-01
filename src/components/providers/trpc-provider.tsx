"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { useState } from "react";

/**
 * React Query's own defaults are tuned for dashboards that must never look
 * stale: `staleTime: 0` refetches on every mount, and `refetchOnWindowFocus`
 * refetches everything again each time the tab regains focus. On a storefront
 * that means re-querying the catalogue every time a customer navigates back to
 * a grid or alt-tabs, for data that changes when an admin edits a product.
 *
 * Thirty seconds is short enough that a price or stock edit shows up promptly
 * and long enough that browsing costs nothing. Anything that genuinely needs to
 * be fresher — the cart's stock check, the shared variant-stock query — sets
 * its own `staleTime` and `refetchInterval`, which still win.
 */
const DEFAULT_STALE_MS = 30_000;

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: DEFAULT_STALE_MS,
            refetchOnWindowFocus: false,
            // One retry, not three: a failing query on a storefront should
            // surface quickly rather than hold a spinner through a backoff.
            retry: 1,
          },
        },
      })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
