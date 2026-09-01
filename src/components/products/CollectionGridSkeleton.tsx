/**
 * Collection Grid Skeleton
 *
 * The waiting state for a collection page, in one place.
 *
 * This markup is rendered from two directions: `loading.tsx` shows it while the
 * server component resolves, and `InfiniteProductGrid` shows it if it ever has
 * to fetch page 1 itself. If those two drifted apart the customer would see the
 * layout jump as one handed over to the other, so they share this rather than
 * each keeping a copy.
 */

import { ProductCardSkeletonGrid } from "@/components/products/ProductCardSkeleton";

/** Grid geometry, shared with `InfiniteProductGrid` so columns never shift. */
export const GRID_CLASSES =
  "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6";

interface CollectionGridSkeletonProps {
  /**
   * Render the real heading instead of a shimmering placeholder. A route that
   * already knows its own title — every static collection page does — should
   * pass it, so the title is painted immediately and only the products wait.
   */
  title?: string;
  description?: string;
  /** How many placeholder cards to draw. Roughly one screenful. */
  count?: number;
}

export function CollectionGridSkeleton({
  title,
  description,
  count = 8,
}: CollectionGridSkeletonProps) {
  return (
    <div className="min-h-screen">
      <div className="py-12 md:py-16 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          {title ? (
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              {title}
            </h1>
          ) : (
            <div className="val-skeleton h-8 w-48 rounded mb-4" />
          )}

          {description ? (
            <p className="text-gray-400 max-w-2xl mx-auto">{description}</p>
          ) : (
            <div className="val-skeleton h-4 w-96 max-w-full rounded mb-4" />
          )}

          <div className="val-skeleton h-4 w-24 rounded mt-4" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className={GRID_CLASSES}>
          <ProductCardSkeletonGrid count={count} />
        </div>
      </div>
    </div>
  );
}
