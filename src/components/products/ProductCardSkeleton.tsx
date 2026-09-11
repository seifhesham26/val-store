/**
 * Product Card Skeleton
 *
 * Placeholder matching the `ProductCard` footprint (3:4 media block plus two
 * text lines). Uses the branded steel shimmer rather than a flat pulse so the
 * waiting state reads as part of the Valkyrie system.
 *
 * The measurements track `ProductCard` deliberately — square corners, a 16px
 * gap under the media, an 11px name line and a 13px price line. A skeleton
 * that does not match its card is worse than none: the grid reflows the moment
 * the real cards arrive, which is exactly the jump the skeleton exists to
 * prevent.
 */

export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="val-skeleton aspect-3/4 w-full" />
      <div className="mt-4 space-y-2">
        <div className="val-skeleton h-3 w-3/4" />
        <div className="val-skeleton h-3 w-1/4" />
      </div>
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
