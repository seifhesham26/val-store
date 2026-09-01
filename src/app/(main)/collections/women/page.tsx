/**
 * Women's Collection Page
 *
 * Uses InfiniteProductGrid with gender filter, seeded with a server-rendered
 * first page.
 */

import type { Metadata } from "next";
import { InfiniteProductGrid } from "@/components/products/InfiniteProductGrid";
import { getCachedFirstProductPage } from "@/lib/cache";

const TITLE = "Women's Collection";
const DESCRIPTION =
  "Elevated streetwear essentials crafted for the modern woman.";

export const metadata: Metadata = {
  title: `${TITLE} | Valkyrie`,
  description: DESCRIPTION,
};

export default async function CollectionsWomenPage() {
  const initialPage = await getCachedFirstProductPage({ gender: "women" });

  return (
    <InfiniteProductGrid
      gender="women"
      title={TITLE}
      description={DESCRIPTION}
      initialPage={initialPage}
    />
  );
}
