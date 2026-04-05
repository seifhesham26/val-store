"use client";

/**
 * Dynamic Featured Products
 *
 * Fetches featured products from public API.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/ProductCard";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

interface DynamicFeaturedProductsProps {
  title?: string;
  subtitle?: string;
  showViewAll?: boolean;
  limit?: number;
}

export function DynamicFeaturedProducts({
  title = "Best Sellers",
  subtitle = "Our most popular pieces",
  showViewAll = true,
  limit = 8,
}: DynamicFeaturedProductsProps) {
  // Fetch featured products from public API
  const { data: products, isLoading } =
    trpc.public.products.getFeatured.useQuery(
      { limit },
      { staleTime: 1000 * 60 * 5 } // Cache for 5 minutes
    );

  if (isLoading) {
    return (
      <section className="py-16 md:py-24 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Skeleton className="h-10 w-48 mx-auto mb-3" />
            <Skeleton className="h-5 w-64 mx-auto" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-3/4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section className="py-16 md:py-24 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {title}
          </h2>
          <p className="text-gray-400">{subtitle}</p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
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

        {/* View All Button */}
        {showViewAll && (
          <div className="text-center mt-12">
            <Link href="/collections/all">
              <Button
                variant="outline"
                size="lg"
                className="border-white/20 text-white hover:bg-white hover:text-black px-8"
              >
                View All Products
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
