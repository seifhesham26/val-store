/**
 * Dynamic Collection Page
 *
 * Handles any category slug from the database.
 *
 * This was a client component, and it was the slowest page on the storefront:
 * after hydrating it fetched the category by slug, and only once *that*
 * resolved did the grid begin fetching products. Two sequential round trips
 * before a single card appeared, the first of them spent turning a slug into
 * an id — data that changes when an admin edits a category and not otherwise.
 *
 * Both now resolve on the server, cached and tagged, and the grid is handed
 * its first page already filled in.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfiniteProductGrid } from "@/components/products/InfiniteProductGrid";
import {
  getCachedCategoryBySlug,
  getCachedCategorySlugs,
  getCachedFirstProductPage,
} from "@/lib/cache";

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Prerender a page per active category. A category added later still renders
 * on demand, so this only ever removes work.
 */
export async function generateStaticParams() {
  const slugs = await getCachedCategorySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCachedCategoryBySlug(slug);

  if (!category) {
    return { title: "Collection Not Found | Valkyrie" };
  }

  return {
    title: `${category.name} | Valkyrie`,
    description: category.description ?? undefined,
  };
}

export default async function DynamicCollectionPage({
  params,
}: CollectionPageProps) {
  const { slug } = await params;

  const category = await getCachedCategoryBySlug(slug);

  // A missing category is a 404 now, rather than a rendered "not found" panel
  // returned with a 200. That is both more correct and one less thing for the
  // client to decide after hydrating.
  if (!category) {
    notFound();
  }

  // Only the products depend on the category id, so this is a genuine
  // dependency rather than an avoidable serial await.
  const initialPage = await getCachedFirstProductPage({
    categoryId: category.id,
  });

  return (
    <InfiniteProductGrid
      categoryId={category.id}
      title={category.name}
      description={category.description ?? undefined}
      initialPage={initialPage}
    />
  );
}
