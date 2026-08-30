"use client";

/**
 * Infinite Search Grid Component
 *
 * Client-side component that displays search results with infinite scroll.
 * Uses tRPC useInfiniteQuery for pagination.
 */

import { trpc } from "@/lib/trpc";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductCardSkeletonGrid } from "@/components/products/ProductCardSkeleton";
import { ValkyrieLoader } from "@/components/ui/valkyrie-loader";
import { ChevronDown, Search } from "lucide-react";
import Link from "next/link";

interface InfiniteSearchGridProps {
  query: string;
}

const ITEMS_PER_PAGE = 12;

/** How many placeholder cards to append while the next page is in flight. */
const NEXT_PAGE_PLACEHOLDERS = 4;

const GRID_CLASSES = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6";

export function InfiniteSearchGrid({ query }: InfiniteSearchGridProps) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.public.products.search.useInfiniteQuery(
      { query, limit: ITEMS_PER_PAGE },
      {
        getNextPageParam: (lastPage) => {
          if (lastPage.page < lastPage.totalPages) {
            return lastPage.page + 1;
          }
          return undefined;
        },
        initialCursor: 1,
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

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="mb-8 space-y-3">
          <div className="val-skeleton h-8 w-64 max-w-full rounded" />
          <div className="val-skeleton h-4 w-40 rounded" />
        </div>
        <div className={GRID_CLASSES}>
          <ProductCardSkeletonGrid count={8} />
        </div>
      </div>
    );
  }

  // Empty state
  if (products.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <Search className="h-16 w-16 text-gray-400 mb-6" />
        <h1 className="text-2xl font-bold text-white mb-2">No Results Found</h1>
        <p className="text-gray-400 text-center max-w-md mb-6">
          We couldn&apos;t find any products matching &quot;{query}&quot;. Try a
          different search term.
        </p>
        <Link href="/collections/all" className="text-primary hover:underline">
          Browse all products →
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Search: &quot;{query}&quot;</h1>
        <p className="text-sm text-muted-foreground">
          Showing {products.length} of {total} results
        </p>
      </div>

      {/* Product Grid */}
      <div className={GRID_CLASSES}>
        {products.map((product) => (
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
            variants={product.variants}
          />
        ))}

        {/* Placeholders grow the grid while the next page loads */}
        {isFetchingNextPage && (
          <ProductCardSkeletonGrid count={NEXT_PAGE_PLACEHOLDERS} />
        )}
      </div>

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
      {!hasNextPage && products.length > 0 && (
        <div className="flex items-center gap-4 py-12">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
          <span className="text-[11px] uppercase tracking-[0.28em] text-gray-500">
            End of results
          </span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
        </div>
      )}
    </div>
  );
}
