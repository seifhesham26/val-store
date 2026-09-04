/**
 * Server-side seed for the New Arrivals row.
 *
 * `NewArrivals` is a client component for its horizontal scroll arrows, not
 * for its data, so it fetched page 1 on mount and showed an empty skeleton
 * until hydration finished — on a homepage whose every other section
 * (`ServerHeroSection`, `ServerFeaturedCategories`, `ServerFeaturedProducts`)
 * already renders its content into the HTML.
 *
 * This wrapper resolves that page here and hands it over as seed data. Same
 * split as `/collections/*`: the server renders page 1, the client keeps the
 * interaction.
 */

import { NewArrivals, NEW_ARRIVALS_LIMIT } from "@/components/home/NewArrivals";
import { getCachedFirstProductPage, type ProductListPage } from "@/lib/cache";
import { NEW_ARRIVAL_WINDOW_DAYS } from "@/domain/products/new-arrivals";

interface ServerNewArrivalsProps {
  title?: string;
  subtitle?: string;
}

export async function ServerNewArrivals(props: ServerNewArrivalsProps) {
  let initialPage: ProductListPage | undefined;

  try {
    initialPage = await getCachedFirstProductPage({
      limit: NEW_ARRIVALS_LIMIT,
      createdWithinDays: NEW_ARRIVAL_WINDOW_DAYS,
    });
  } catch (error) {
    // Same degradation rule the other homepage sections follow: a seed is an
    // optimisation, so a failed read falls back to the client fetch rather
    // than taking the page down.
    console.error("[ServerNewArrivals] Failed to seed products:", error);
  }

  return <NewArrivals {...props} initialPage={initialPage} />;
}
