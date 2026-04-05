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
import { Loader2, Search } from "lucide-react";
import Link from "next/link";

interface InfiniteSearchGridProps {
  query: string;
}

const ITEMS_PER_PAGE = 12;

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
      <div className="container py-16">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
      </div>

      {/* Infinite scroll sentinel */}
      {hasNextPage && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-8"
        >
          {isFetchingNextPage ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-sm text-muted-foreground">
              Scroll for more...
            </span>
          )}
        </div>
      )}

      {/* End of list */}
      {!hasNextPage && products.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          You&apos;ve reached the end
        </p>
      )}
    </div>
  );
}
