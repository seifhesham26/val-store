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
import { Loader2 } from "lucide-react";

interface InfiniteProductGridProps {
  categoryId?: string;
  gender?: string;
  isFeatured?: boolean;
  isOnSale?: boolean;
  title?: string;
  description?: string;
}

const ITEMS_PER_PAGE = 12;

export function InfiniteProductGrid({
  categoryId,
  gender,
  isFeatured,
  isOnSale,
  title = "All Products",
  description,
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
      <div className="min-h-screen">
        {/* Header skeleton */}
        <div className="py-12 md:py-16 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            <div className="h-8 w-48 bg-white/12 rounded animate-pulse mb-4" />
            <div className="h-4 w-96 max-w-full bg-white/12 rounded animate-pulse mb-4" />
            <div className="h-4 w-24 bg-white/12 rounded animate-pulse" />
          </div>
        </div>
        {/* Product grid skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-3/4 bg-white/12 rounded-lg animate-pulse" />
                <div className="h-4 w-3/4 bg-white/12 rounded animate-pulse" />
                <div className="h-4 w-1/4 bg-white/12 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
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
                isFeatured={product.isFeatured}
                variants={product.variants}
              />
            ))}
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
            className="flex items-center justify-center py-8"
          >
            {isFetchingNextPage ? (
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            ) : (
              <span className="text-sm text-gray-500">Scroll for more...</span>
            )}
          </div>
        )}

        {/* End of list */}
        {!hasNextPage && products.length > 0 && (
          <p className="text-center text-sm text-gray-500 py-8">
            You&apos;ve reached the end
          </p>
        )}
      </div>
    </div>
  );
}
