/**
 * Sale Collection Page
 *
 * Uses InfiniteProductGrid with isOnSale filter, seeded with a server-rendered
 * first page.
 */

import type { Metadata } from "next";
import { InfiniteProductGrid } from "@/components/products/InfiniteProductGrid";
import {
  getCachedFirstProductPage,
  getCachedToolbarCategories,
} from "@/lib/cache";
import { BANNER_CONTENT } from "@/components/collections/collection-banner-content";

const TITLE = "Sale";
const DESCRIPTION = "Don't miss out on these limited-time offers.";

export const metadata: Metadata = {
  title: `${TITLE} | Valkyrie`,
  description: DESCRIPTION,
};

export default async function CollectionsSalePage() {
  const [initialPage, categories] = await Promise.all([
    getCachedFirstProductPage({ isOnSale: true }),
    getCachedToolbarCategories(),
  ]);

  return (
    <InfiniteProductGrid
      isOnSale
      title={TITLE}
      description={DESCRIPTION}
      initialPage={initialPage}
      bannerEyebrow={BANNER_CONTENT.sale.eyebrow}
      bannerImage={BANNER_CONTENT.sale.image}
      categories={categories}
    />
  );
}
