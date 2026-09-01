"use client";

/**
 * Infinite Product Grid Component
 *
 * Client-side component that displays products with infinite scroll.
 * Uses tRPC useInfiniteQuery for pagination.
 */

import { trpc } from "@/lib/trpc";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductCardSkeletonGrid } from "@/components/products/ProductCardSkeleton";
import {
  CollectionGridSkeleton,
  GRID_CLASSES,
} from "@/components/products/CollectionGridSkeleton";
import { ValkyrieLoader } from "@/components/ui/valkyrie-loader";
import { ChevronDown } from "lucide-react";
import type { ProductListPage } from "@/lib/cache";

interface InfiniteProductGridProps {
  categoryId?: string;
  gender?: string;
  isFeatured?: boolean;
  isOnSale?: boolean;
  title?: string;
  description?: string;
  /**
   * Page 1, already fetched on the server.
   *
   * When present the grid renders products on first paint and never issues the
   * page-1 request at all — the whole bundle/hydrate/request/query chain that
   * used to stand between the customer and the first card is gone. Pages 2+
   * still stream in over tRPC exactly as before.
   *
   * Left optional so a caller that genuinely cannot fetch server-side still
   * works; it just pays the old waterfall.
   */
  initialPage?: ProductListPage;
}

const ITEMS_PER_PAGE = 12;

/** How many placeholder cards to append while the next page is in flight. */
const NEXT_PAGE_PLACEHOLDERS = 4;

export function InfiniteProductGrid({
  categoryId,
  gender,
  isFeatured,
  isOnSale,
  title = "All Products",
  description,
  initialPage,
}: InfiniteProductGridProps) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.public.products.list.useInfiniteQuery(
      { limit: ITEMS_PER_PAGE, categoryId, gender, isFeatured, isOnSale },
      {
        getNextPageParam: (lastPage) => {
          if (lastPage.page < lastPage.totalPages) {
            return lastPage.page + 1;
          }
          return undefined;
        },
        initialCursor: 1,
        // Seeding the cache rather than fetching. `pageParams` must line up
        // with `pages` or `getNextPageParam` asks for the wrong page next.
        initialData: initialPage
          ? { pages: [initialPage], pageParams: [1] }
          : undefined,
      }
    );

  // Flatten all pages
  const products = data?.pages.flatMap((page) => page.products) || [];
  const total = data?.pages[0]?.total || 0;

  // Infinite scroll
  const { ref: sentinelRef } = useInfiniteScroll({
    onLoadMore: () => fetchNextPage(),
    enabled: hasNextPage && !isFetchingNextPage,
  });

  // Only reachable when the caller did not pass `initialPage` — with it, the
  // query starts resolved. Shares markup with `loading.tsx` so a page that
  // does hand over between the two does not visibly reflow.
  if (isLoading) {
    return <CollectionGridSkeleton title={title} description={description} />;
  }

  return (
    <div className="min-h-screen">
      {/* Collection Header */}
      <div className="py-12 md:py-16 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            {title}
          </h1>
          {description && (
            <p className="text-gray-400 max-w-2xl mx-auto">{description}</p>
          )}
          <p className="text-sm text-gray-500 mt-4">
            Showing {products.length} of {total} products
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Product Grid */}
        {products.length > 0 ? (
          <div className={GRID_CLASSES}>
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                slug={product.slug}
                price={product.basePrice}
                salePrice={product.salePrice ?? undefined}
                primaryImage={product.primaryImage ?? undefined}
                isOnSale={
                  product.salePrice !== null &&
                  product.salePrice < product.basePrice
                }
                isFeatured={product.isFeatured}
                variants={product.variants}
                priority={index < 4}
              />
            ))}

            {/* Placeholders grow the grid while the next page loads */}
            {isFetchingNextPage && (
              <ProductCardSkeletonGrid count={NEXT_PAGE_PLACEHOLDERS} />
            )}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No products found</p>
          </div>
        )}

        {/* Infinite scroll sentinel */}
        {hasNextPage && (
          <div
            ref={sentinelRef}
            className="flex items-center justify-center py-12"
          >
            {isFetchingNextPage ? (
              <ValkyrieLoader size="md" label="Loading" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-600">
                <ChevronDown className="val-hint h-4 w-4" />
                <span className="text-[11px] uppercase tracking-[0.28em]">
                  Scroll for more
                </span>
              </div>
            )}
          </div>
        )}

        {/* End of list */}
        {!hasNextPage && products.length > 0 && <EndOfCollection />}
      </div>
    </div>
  );
}

/** Closing marker shown once every product has been loaded. */
function EndOfCollection() {
  return (
    <div className="flex items-center gap-4 py-12">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
      <div className="flex items-center gap-3">
        <svg
          width="14"
          height="14"
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
        >
          <polygon
            points="24,3 42,13.5 42,34.5 24,45 6,34.5 6,13.5"
            stroke="var(--val-accent)"
            strokeOpacity="0.5"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-[11px] uppercase tracking-[0.28em] text-gray-500">
          End of collection
        </span>
      </div>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
    </div>
  );
}
