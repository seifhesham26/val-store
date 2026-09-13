"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { useState } from "react";

/**
 * React Query's defaults refetch on every mount and whenever the tab regains
 * focus. Thirty seconds stays the safe shared default for account and admin
 * data. Rare-write catalogue queries opt into a longer policy, while cart and
 * live-stock queries keep their own refresh intervals.
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
