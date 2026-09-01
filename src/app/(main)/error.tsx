"use client";

/**
 * Storefront error boundary.
 *
 * Without this a failed fetch drops the customer on the framework's default
 * error screen with no way back. `reset()` re-runs the segment's render, which
 * for a transient database or network failure is usually all that is needed.
 *
 * Storefront-themed on purpose: the body is `bg-black text-white`, so the
 * default `Button` (near-black on near-white) would be nearly invisible here —
 * see the two-themes note in CLAUDE.md.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Storefront] Route error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          Something went wrong
        </h1>
        <p className="text-gray-400 max-w-md">
          We could not load this page. This is usually temporary — trying again
          will often fix it.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="bg-val-accent text-black px-6 py-2.5 text-sm font-medium rounded-md hover:bg-val-accent-light transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="border border-white/20 bg-transparent text-white px-6 py-2.5 text-sm font-medium rounded-md hover:bg-white/5 transition-colors"
        >
          Back to home
        </Link>
      </div>

      {error.digest && (
        <p className="text-[11px] uppercase tracking-[0.2em] text-gray-600">
          Reference {error.digest}
        </p>
      )}
    </div>
  );
}
