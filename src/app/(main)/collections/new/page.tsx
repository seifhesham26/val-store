/**
 * New Arrivals Collection Page
 *
 * Uses InfiniteProductGrid with isFeatured filter, seeded with a
 * server-rendered first page.
 *
 * Note: this filters on `isFeatured`, not on recency — a pre-existing quirk
 * (ISSUES) left as-is here, since this change is about how the page loads and
 * not about which products it chooses.
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
  const initialPage = await getCachedFirstProductPage({ isFeatured: true });

  return (
    <InfiniteProductGrid
      isFeatured
      title={TITLE}
      description={DESCRIPTION}
      initialPage={initialPage}
    />
  );
}
