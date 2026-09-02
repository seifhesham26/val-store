/**
 * New Arrivals Collection Page
 *
 * Seeded with a server-rendered first page.
 *
 * This used to filter on `isFeatured`, which is curation, not recency — so
 * "New Arrivals" showed whatever an admin had pinned, and a product added
 * yesterday never appeared unless someone featured it.
 *
 * The fix needs no sort parameter: the product repository already orders by
 * `createdAt DESC` by default, so dropping the wrong filter *is* the recency
 * ordering. A `limit` stands in for a recency window — the newest twelve is a
 * more useful definition of "new" for a 36-product catalogue than an arbitrary
 * date cutoff that could return nothing.
 */

import type { Metadata } from "next";
import { InfiniteProductGrid } from "@/components/products/InfiniteProductGrid";
import { getCachedFirstProductPage } from "@/lib/cache";

const TITLE = "New Arrivals";
const DESCRIPTION = "The latest additions to our premium collection.";

export const metadata: Metadata = {
  title: `${TITLE} | Valkyrie`,
  description: DESCRIPTION,
};

export default async function CollectionsNewPage() {
  const initialPage = await getCachedFirstProductPage({});

  return (
    <InfiniteProductGrid
      title={TITLE}
      description={DESCRIPTION}
      initialPage={initialPage}
    />
  );
}
