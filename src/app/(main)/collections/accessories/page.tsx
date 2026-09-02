/**
 * Accessories Collection Page
 *
 * This page used to apply no filter at all, so it rendered the entire
 * catalogue under an "Accessories" heading — every hoodie and tee presented as
 * an accessory. Its own comment admitted it.
 *
 * It is a real category page now. The slug is resolved on the server through
 * the same cached fetcher `/collections/[slug]` uses, and the grid is pinned to
 * whatever id comes back.
 *
 * There is no `accessories` category in the database yet, and that is the
 * interesting case: rather than falling back to "show everything", the page
 * says the collection is empty. Create a category with the slug `accessories`
 * and it fills in on the next revalidation with no code change.
 */

import type { Metadata } from "next";
import { InfiniteProductGrid } from "@/components/products/InfiniteProductGrid";
import {
  getCachedCategoryBySlug,
  getCachedFirstProductPage,
} from "@/lib/cache";

const TITLE = "Accessories";
const DESCRIPTION =
  "Complete your look with our curated selection of accessories.";

export const metadata: Metadata = {
  title: `${TITLE} | Valkyrie`,
  description: DESCRIPTION,
};

export default async function CollectionsAccessoriesPage() {
  // Tolerated rather than thrown: a missing category is a content gap, not a
  // broken route, and a 404 on a link the footer and nav both point at is
  // worse than an honest empty collection.
  const category = await getCachedCategoryBySlug("accessories").catch(
    () => null
  );

  const initialPage = category?.id
    ? await getCachedFirstProductPage({ categoryId: category.id })
    : null;

  if (!initialPage) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">{TITLE}</h1>
        <p className="mt-3 max-w-xl text-gray-400">{DESCRIPTION}</p>
        <p className="mt-10 text-gray-500">
          There is nothing in this collection yet. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <InfiniteProductGrid
      categoryId={category?.id}
      title={TITLE}
      description={DESCRIPTION}
      initialPage={initialPage}
    />
  );
}
