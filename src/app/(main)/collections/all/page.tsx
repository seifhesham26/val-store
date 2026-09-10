/**
 * All Products Collection Page
 *
 * Page 1 is resolved here, on the server, and handed to the grid as seed data.
 * The grid keeps its infinite scroll for everything after that.
 */

import type { Metadata } from "next";
import { InfiniteProductGrid } from "@/components/products/InfiniteProductGrid";
import {
  getCachedFirstProductPage,
  getCachedToolbarCategories,
} from "@/lib/cache";
import { BANNER_CONTENT } from "@/components/collections/collection-banner-content";

const TITLE = "All Products";
const DESCRIPTION =
  "Browse our complete collection of premium streetwear essentials.";

export const metadata: Metadata = {
  title: `${TITLE} | Valkyrie`,
  description: DESCRIPTION,
};

export default async function CollectionsAllPage() {
  const [initialPage, categories] = await Promise.all([
    getCachedFirstProductPage({}),
    getCachedToolbarCategories(),
  ]);

  return (
    <InfiniteProductGrid
      title={TITLE}
      description={DESCRIPTION}
      initialPage={initialPage}
      bannerEyebrow={BANNER_CONTENT.all.eyebrow}
      bannerImage={BANNER_CONTENT.all.image}
      categories={categories}
    />
  );
}
