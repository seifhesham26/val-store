/**
 * Men's Collection Page
 *
 * Uses InfiniteProductGrid with gender filter, seeded with a server-rendered
 * first page.
 */

import type { Metadata } from "next";
import { InfiniteProductGrid } from "@/components/products/InfiniteProductGrid";
import { getCachedFirstProductPage } from "@/lib/cache";

const TITLE = "Men's Collection";
const DESCRIPTION =
  "Premium streetwear essentials designed for the modern man.";

export const metadata: Metadata = {
  title: `${TITLE} | Valkyrie`,
  description: DESCRIPTION,
};

export default async function CollectionsMenPage() {
  const initialPage = await getCachedFirstProductPage({ gender: "men" });

  return (
    <InfiniteProductGrid
      gender="men"
      title={TITLE}
      description={DESCRIPTION}
      initialPage={initialPage}
    />
  );
}
