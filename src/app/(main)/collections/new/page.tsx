import type { Metadata } from "next";
import { InfiniteProductGrid } from "@/components/products/InfiniteProductGrid";
import { getCachedFirstProductPage } from "@/lib/cache";
import { NEW_ARRIVAL_WINDOW_DAYS } from "@/domain/products/new-arrivals";

/**
 * New Arrivals — products added within `NEW_ARRIVAL_WINDOW_DAYS`.
 *
 * This page previously called `getCachedFirstProductPage({})`: no filter at
 * all. Since `findAll` already orders by `created_at DESC`, its output was
 * byte-identical to `/collections/all` — the same 36 products in the same
 * order, under a different heading. "New" is a primary navbar item, so the
 * single most prominent merchandising link on the storefront was showing the
 * entire catalogue.
 *
 * The window is the filter, and it is shared with the homepage carousel and
 * the `/collections` index row so all three mean the same thing. See
 * `NEW_ARRIVAL_WINDOW_DAYS` for why recency rather than a curated category.
 */
const TITLE = "New Arrivals";
const DESCRIPTION = "The latest additions to our premium collection.";

export const metadata: Metadata = {
  title: `${TITLE} | Valkyrie`,
  description: DESCRIPTION,
};

export default async function CollectionsNewPage() {
  const initialPage = await getCachedFirstProductPage({
    createdWithinDays: NEW_ARRIVAL_WINDOW_DAYS,
  });

  return (
    <InfiniteProductGrid
      createdWithinDays={NEW_ARRIVAL_WINDOW_DAYS}
      title={TITLE}
      description={DESCRIPTION}
      initialPage={initialPage}
    />
  );
}
