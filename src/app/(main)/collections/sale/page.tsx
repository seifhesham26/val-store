/**
 * Sale Collection Page
 *
 * Uses InfiniteProductGrid with isOnSale filter, seeded with a server-rendered
 * first page.
 */

import type { Metadata } from "next";
import { InfiniteProductGrid } from "@/components/products/InfiniteProductGrid";
import { getCachedFirstProductPage } from "@/lib/cache";

const TITLE = "Sale";
const DESCRIPTION = "Don't miss out on these limited-time offers.";

export const metadata: Metadata = {
  title: `${TITLE} | Valkyrie`,
  description: DESCRIPTION,
};

export default async function CollectionsSalePage() {
  const initialPage = await getCachedFirstProductPage({ isOnSale: true });

  return (
    <InfiniteProductGrid
      isOnSale
      title={TITLE}
      description={DESCRIPTION}
      initialPage={initialPage}
    />
  );
}
