/**
 * Product Card Skeleton
 *
 * Placeholder matching the `ProductCard` footprint (3:4 media block plus two
 * text lines). Uses the branded steel shimmer rather than a flat pulse so the
 * waiting state reads as part of the Valkyrie system.
 */

import { cn } from "@/lib/utils";

export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden="true">
      <div className="val-skeleton aspect-3/4 w-full rounded-lg" />
      <div className="val-skeleton h-3.5 w-3/4 rounded" />
      <div className="val-skeleton h-3.5 w-1/4 rounded" />
    </div>
  );
}

/** Renders `count` skeleton cards, for grid loading states. */
export function ProductCardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </>
  );
}
