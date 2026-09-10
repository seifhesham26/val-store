"use client";

/**
 * Infinite Product Grid Component
 *
 * Client-side component that displays products with infinite scroll.
 * Uses tRPC useInfiniteQuery for pagination.
 */

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductCardSkeletonGrid } from "@/components/products/ProductCardSkeleton";
import { GRID_CLASSES } from "@/components/products/CollectionGridSkeleton";
import { CollectionBanner } from "@/components/collections/CollectionBanner";
import {
  CollectionToolbar,
  type ToolbarCategory,
} from "@/components/collections/CollectionToolbar";
import { ProductGridItems } from "@/components/products/ProductGridItems";
import { ValkyrieLoader } from "@/components/ui/valkyrie-loader";
import { useReveal } from "@/hooks/use-reveal";
import { parseProductSort } from "@/lib/collection-sort";
import { ChevronDown } from "lucide-react";
import type { ProductListPage } from "@/lib/cache";

interface InfiniteProductGridProps {
  categoryId?: string;
  /**
   * A category and its descendants, resolved server-side.
   *
   * Collection pages pass this rather than `categoryId`: every product is
   * filed against a leaf category while the navigation links to parents, so
   * matching a single id emptied every parent collection.
   */
  categoryIds?: string[];
  gender?: string;
  isFeatured?: boolean;
  isOnSale?: boolean;
  /** Added within the last N days — the New Arrivals filter. */
  createdWithinDays?: number;
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
   * works; it just pays the old waterfall. Only used for the default view —
   * see the `initialData` gate below.
   */
  initialPage?: ProductListPage;
  /** Small label above the banner headline. */
  bannerEyebrow?: string;
  /** Banner artwork. Required — every collection route has one. */
  bannerImage: string;
  /** Chips for the toolbar. Omit to render the toolbar without filters. */
  categories?: ToolbarCategory[];
}

const ITEMS_PER_PAGE = 12;

/** How many placeholder cards to append while the next page is in flight. */
const NEXT_PAGE_PLACEHOLDERS = 4;

export function InfiniteProductGrid({
  categoryId,
  categoryIds,
  gender,
  isFeatured,
  isOnSale,
  createdWithinDays,
  title = "All Products",
  description,
  initialPage,
  bannerEyebrow,
  bannerImage,
  categories,
}: InfiniteProductGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sort = parseProductSort(searchParams.get("sort"));
  const activeSlug = searchParams.get("category");

  const activeCategory = useMemo(
    () => categories?.find((c) => c.slug === activeSlug) ?? null,
    [categories, activeSlug]
  );

  /** Rewrites one query param, preserving the rest and the scroll position. */
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  };

  const bannerRef = useReveal<HTMLDivElement>();
  const revealRef = useReveal<HTMLDivElement>();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.public.products.list.useInfiniteQuery(
      {
        limit: ITEMS_PER_PAGE,
        categoryId,
        categoryIds: activeCategory?.categoryIds ?? categoryIds,
        gender,
        isFeatured,
        isOnSale,
        createdWithinDays,
        sort,
      },
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
        // Only correct for the default, unfiltered view — the server-seeded
        // page 1 always reflects `sort: "newest"` with no category filter, so
        // any other combination must fetch for real.
        initialData:
          initialPage && sort === "newest" && activeSlug === null
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

  return (
    <div className="min-h-screen">
      <div ref={bannerRef}>
        <CollectionBanner
          eyebrow={bannerEyebrow}
          title={title}
          description={description}
          image={bannerImage}
          productCount={total}
        />
      </div>

      <CollectionToolbar
        categories={categories ?? []}
        activeSlug={activeSlug}
        sort={sort}
        shownCount={products.length}
        totalCount={total}
        onCategoryChange={(slug) => setParam("category", slug)}
        onSortChange={(next) => setParam("sort", next)}
      />

      {isLoading ? (
        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 md:py-12 lg:px-8">
          <div className={GRID_CLASSES}>
            <ProductCardSkeletonGrid count={10} />
          </div>
        </div>
      ) : (
        <div
          ref={revealRef}
          className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 md:py-12 lg:px-8"
        >
          {/* Product Grid */}
          {products.length > 0 ? (
            <ProductGridItems
              transitionKey={`${activeSlug ?? "all"}:${sort}`}
              className={GRID_CLASSES}
            >
              {products.map((product, index) => (
                <div key={product.id} className="val-reveal" data-reveal>
                  <ProductCard
                    id={product.id}
                    name={product.name}
                    slug={product.slug}
                    price={product.basePrice}
                    salePrice={product.salePrice ?? undefined}
                    primaryImage={product.primaryImage ?? undefined}
                    secondaryImage={product.secondaryImage ?? undefined}
                    index={index}
                    isOnSale={
                      product.salePrice !== null &&
                      product.salePrice < product.basePrice
                    }
                    isFeatured={product.isFeatured}
                    variants={product.variants}
                    priority={index < 5}
                  />
                </div>
              ))}

              {/* Placeholders grow the grid while the next page loads */}
              {isFetchingNextPage && (
                <ProductCardSkeletonGrid count={NEXT_PAGE_PLACEHOLDERS} />
              )}
            </ProductGridItems>
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
      )}
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
