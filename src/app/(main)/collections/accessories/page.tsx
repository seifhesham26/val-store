/**
 * Accessories Collection Page
 *
 * Seeded with a server-rendered first page.
 *
 * Note: this applies no filter at all — there is no accessories category in
 * the database yet, so it currently shows the same set as /collections/all
 * (ISSUES). Preserved as-is; this change is about how the page loads.
 */

import type { Metadata } from "next";
import { InfiniteProductGrid } from "@/components/products/InfiniteProductGrid";
import { getCachedFirstProductPage } from "@/lib/cache";

const TITLE = "Accessories";
const DESCRIPTION =
  "Complete your look with our curated selection of accessories.";

export const metadata: Metadata = {
  title: `${TITLE} | Valkyrie`,
  description: DESCRIPTION,
};

export default async function CollectionsAccessoriesPage() {
  const initialPage = await getCachedFirstProductPage({});

  return (
    <InfiniteProductGrid
      title={TITLE}
      description={DESCRIPTION}
      initialPage={initialPage}
    />
  );
}
