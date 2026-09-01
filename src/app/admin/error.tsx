"use client";

/** Admin error boundary. Light-themed, so it uses tokens rather than storefront colours. */

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Admin] Route error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-muted-foreground max-w-md">
          This page failed to load. Trying again will often fix it.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      </div>

      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Reference {error.digest}
        </p>
      )}
    </div>
  );
}
