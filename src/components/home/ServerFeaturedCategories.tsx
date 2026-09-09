/**
 * Server-side Featured Categories
 *
 * Fetches featured categories on the server for instant page load.
 * Uses caching for 60-second revalidation.
 */

import Link from "next/link";
import { ProductImage } from "@/components/shared/ProductImage";
import { getCachedFeaturedCategories } from "@/lib/cache";

interface ServerFeaturedCategoriesProps {
  title?: string;
  subtitle?: string;
}

function CategoryCard({
  name,
  slug,
  imageUrl,
  productCount,
}: {
  name: string;
  slug: string;
  imageUrl: string | null;
  productCount?: number;
}) {
  return (
    <Link
      href={`/collections/${slug}`}
      className="group relative block overflow-hidden"
    >
      {/* Image container with aspect ratio */}
      <div className="relative aspect-3/4 bg-val-steel overflow-hidden">
        {/*
         * The category's own image, set in the admin. This used to be a random
         * picsum photo keyed on the slug — decorative filler that looked like
         * real photography and quietly ignored `categories.image_url`.
         *
         * With no image set, a brand gradient rather than a stock photo: an
         * honest empty state reads better than someone else's picture of
         * someone else's clothes.
         */}
        {imageUrl ? (
          <ProductImage
            src={imageUrl}
            alt={name}
            sizes="(max-width: 768px) 100vw, 33vw"
            className="transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-gray-700 via-gray-800 to-gray-900" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent transition-colors duration-300 group-hover:from-black/50" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-1">
            {name}
          </h3>
          {productCount !== undefined && productCount > 0 && (
            <p className="text-sm text-gray-300">{productCount} items</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export async function ServerFeaturedCategories({
  title = "Shop by Category",
  subtitle = "Find your perfect style",
}: ServerFeaturedCategoriesProps) {
  // Derived from the fetcher rather than hand-written. This was a duplicated
  // literal type, and it had already drifted: `imageUrl` was added to the
  // fetcher and the annotation here silently kept the old shape, so the field
  // was invisible to the component that needed it.
  let featuredCategories: Awaited<
    ReturnType<typeof getCachedFeaturedCategories>
  > = [];

  try {
    // Curated in Settings → Featured when anything has been chosen there, and
    // the first three active categories by display order when it has not.
    featuredCategories = await getCachedFeaturedCategories(3);
  } catch (error) {
    console.error(
      "[ServerFeaturedCategories] Failed to fetch categories:",
      error
    );
    // featuredCategories stays empty - render empty state
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

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {featuredCategories.map((category) => (
            <CategoryCard
              key={category.id}
              name={category.name}
              slug={category.slug}
              imageUrl={category.imageUrl}
              productCount={category.productCount}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
