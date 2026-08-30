/**
 * Server-side Featured Products
 *
 * Fetches featured products on the server for instant page load.
 * Uses caching for 60-second revalidation.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/ProductCard";
import { getCachedFeaturedProducts } from "@/lib/cache";

interface ServerFeaturedProductsProps {
  title?: string;
  subtitle?: string;
  showViewAll?: boolean;
  limit?: number;
}

export async function ServerFeaturedProducts({
  title = "Best Sellers",
  subtitle = "Our most popular pieces",
  showViewAll = true,
  limit = 8,
}: ServerFeaturedProductsProps) {
  let products: Awaited<ReturnType<typeof getCachedFeaturedProducts>> = [];

  // Try to fetch featured products with caching
  try {
    products = await getCachedFeaturedProducts(limit);
  } catch (error) {
    console.error("[ServerFeaturedProducts] Failed to fetch products:", error);
    // products stays empty - we'll show nothing rather than crash
  }

  // Don't render section if no products (but don't crash)

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

        {/* Products Grid - only show if we have products */}
        {products.length > 0 ? (
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
                variants={product.variants}
                isOnSale={
                  product.salePrice !== null &&
                  product.salePrice < product.basePrice
                }
                isFeatured={product.isFeatured}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">
            No featured products yet. Check back soon!
          </p>
        )}

        {/* View All Button */}
        {showViewAll && (
          <div className="text-center mt-12">
            <Link href="/collections/all">
              <Button
                size="lg"
                className="bg-white text-black hover:bg-val-silver px-8 py-6 text-base font-medium tracking-wide"
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
