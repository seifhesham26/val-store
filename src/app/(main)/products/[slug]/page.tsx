/**
 * Product Detail Page (Server Component)
 *
 * Fetches product data from the database using cached queries.
 * Displays product details, images, variants, and related products.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { ProductDetail } from "@/components/products/ProductDetail";
import { RelatedProducts } from "@/components/products/RelatedProducts";
import { ProductReviews } from "@/components/products/ProductReviews";
import { notFound } from "next/navigation";
import {
  getCachedProductBySlug,
  getCachedRelatedProducts,
  getCachedProductSlugs,
} from "@/lib/cache";
import {
  transformProductForDetail,
  transformRelatedProducts,
} from "@/lib/transformers/products";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Prerender every product page at build time.
 *
 * Nothing here was prerendered, so each product page was rendered on demand on
 * first request. The catalogue is small and each page is cheap, so building
 * them all costs little and turns the first visit to any product into a cache
 * hit. A slug added after the build still renders on demand — `dynamicParams`
 * defaults to true — so this is purely additive.
 */
export async function generateStaticParams() {
  const slugs = await getCachedProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

/**
 * Per-product title and description.
 *
 * Every page on the site previously inherited the root layout's "Valkyrie -
 * Premium Clothing", so search results and shared links were indistinguishable
 * from one another.
 */
export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCachedProductBySlug(slug);

  if (!product) {
    return { title: "Product Not Found | Valkyrie" };
  }

  return {
    title: `${product.name} | Valkyrie`,
    description: product.description ?? undefined,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.images[0]?.imageUrl
        ? [{ url: product.images[0].imageUrl }]
        : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  // Fetch product from database (cached)
  const product = await getCachedProductBySlug(slug);

  if (!product) {
    notFound();
  }

  // Transform to format expected by ProductDetail component
  const productForDetail = transformProductForDetail(product);

  // Get related products (excluding current)
  const relatedProductsData = await getCachedRelatedProducts(product.id, 4);
  const relatedProducts = transformRelatedProducts(relatedProductsData);

  return (
    <>
      <ProductDetail product={productForDetail} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-white/10 mt-8">
        {/* Reviews fetch client-side, below the fold. Suspending them keeps
            that fetch from being part of what blocks the page: the product
            itself is server-rendered and should not wait on it. */}
        <Suspense fallback={<ReviewsFallback />}>
          <ProductReviews productId={product.id} />
        </Suspense>
      </div>
      {relatedProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-white/10">
          <RelatedProducts products={relatedProducts} />
        </div>
      )}
    </>
  );
}

/** Placeholder for the review list while it loads, sized to avoid a jump. */
function ReviewsFallback() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="val-skeleton h-6 w-40 rounded" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="val-skeleton h-4 w-32 rounded" />
          <div className="val-skeleton h-3 w-full rounded" />
          <div className="val-skeleton h-3 w-4/5 rounded" />
        </div>
      ))}
    </div>
  );
}
