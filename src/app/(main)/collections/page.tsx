/**
 * Collections Landing Page
 *
 * One preview row per collection, each linking through to the full grid.
 *
 * This was a client component holding four hardcoded filter definitions, and
 * two of them were wrong in the same way `/collections/men` and
 * `/collections/women` were: they filtered on `products.gender`, which matched
 * one product and zero products respectively out of a catalogue where nearly
 * everything is `unisex`. The "Women's Collection" row rendered "No products
 * in this collection yet." on a store with thirteen women's products.
 *
 * A third, "New Arrivals", filtered on `isFeatured` — a fourth definition of
 * "new" alongside the `new-arrivals` category, `/collections/new` (which
 * filtered nothing at all) and the homepage row.
 *
 * So the category-backed rows now resolve their real category server-side,
 * subtree included, and there is one definition of each collection rather than
 * one per page that mentions it. `isOnSale` stays a comparison, because it is
 * one — no `categories` row can express "the sale price undercuts the base
 * price".
 */

import { CollectionBanner } from "@/components/collections/CollectionBanner";
import {
  BANNER_CONTENT,
  FALLBACK_IMAGE,
  resolveImage,
} from "@/components/collections/collection-banner-content";
import {
  CollectionMosaic,
  type MosaicTile,
} from "@/components/collections/CollectionMosaic";
import {
  CollectionSection,
  PREVIEW_LIMIT,
} from "@/components/collections/CollectionSection";
import { RevealRegion } from "@/components/motion/RevealRegion";
import {
  getCachedCategoryBySlug,
  getCachedFirstProductPage,
} from "@/lib/cache";
import { NEW_ARRIVAL_WINDOW_DAYS } from "@/domain/products/new-arrivals";

/** Artwork per collection row. Falls back until the campaign shots land. */
const TILE_IMAGES: Record<string, string> = {
  "/collections/new": "/brand/tile-new.png",
  "/collections/men": "/brand/tile-men.jpg",
  "/collections/women": "/brand/tile-women.jpg",
  "/collections/sale": "/brand/tile-sale.jpg",
  // Listed before the art exists: `resolveImage` falls back to the hero until
  // the file lands, which is the whole point of that helper — every other tile
  // was wired the same way and needed no code change when its shot arrived.
  "/collections/all": "/brand/tile-all.jpg",
};

interface CollectionRow {
  title: string;
  description: string;
  href: string;
  queryParams: {
    categoryIds?: string[];
    isOnSale?: boolean;
    createdWithinDays?: number;
  };
}

/** Rows backed by a real category, named by slug. */
const CATEGORY_ROWS = [
  {
    slug: "men",
    description: "Premium streetwear essentials designed for the modern man.",
  },
  {
    slug: "women",
    description: "Elevated streetwear essentials crafted for the modern woman.",
  },
] as const;

export default async function CollectionsPage() {
  // Resolved together — each is a cached read, and nothing here depends on
  // anything else here.
  const categories = await Promise.all(
    CATEGORY_ROWS.map(async (row) => ({
      row,
      // Tolerated rather than thrown: a category an admin has since removed is
      // a content gap, and dropping one row is a better answer than a 500 on
      // the page every collection link points at.
      category: await getCachedCategoryBySlug(row.slug).catch(() => null),
    }))
  );

  const collections: CollectionRow[] = [
    {
      // Recency, not `isFeatured` — see `NEW_ARRIVAL_WINDOW_DAYS`. Shared with
      // `/collections/new` and the homepage carousel so all three agree.
      title: "New Arrivals",
      description: "The latest additions to our premium collection.",
      href: "/collections/new",
      queryParams: { createdWithinDays: NEW_ARRIVAL_WINDOW_DAYS },
    },
    ...categories
      .filter((entry) => entry.category !== null)
      .map(({ row, category }) => ({
        // The category's own name, so renaming it in the admin renames it here.
        title: category!.name,
        description: category!.description ?? row.description,
        href: `/collections/${category!.slug}`,
        queryParams: { categoryIds: category!.categoryIds },
      })),
    {
      title: "On Sale",
      description: "Don't miss out on these limited-time offers.",
      href: "/collections/sale",
      queryParams: { isOnSale: true as const },
    },
  ];

  // Seed every row's page 1 here rather than letting four client components
  // each fetch on mount. These are cached reads with no dependency on one
  // another, so `Promise.all` pipelines them; the alternative was four empty
  // skeleton grids until hydration finished.
  //
  // A row whose fetch fails renders its skeleton and recovers on the client,
  // which is exactly what it did before — a seed is an optimisation, and one
  // failing row must not take the page down.
  const seeded = await Promise.all(
    collections.map(async (collection) => ({
      collection,
      initialPage: await getCachedFirstProductPage({
        limit: PREVIEW_LIMIT,
        ...collection.queryParams,
      }).catch(() => undefined),
    }))
  );

  const tiles: MosaicTile[] = seeded.map(({ collection, initialPage }, i) => ({
    title: collection.title,
    href: collection.href,
    image: resolveImage(TILE_IMAGES[collection.href] ?? FALLBACK_IMAGE),
    // No `?? 0`. The seeded read is tolerated-on-failure above, so an absent
    // page means "unknown", not "none" — and `?? 0` printed a confident
    // "0 PRODUCTS" under New Arrivals on a collection whose own preview row,
    // fetched client-side, was showing five.
    count: initialPage?.total,
    featured: i === 0,
  }));

  // Fills the mosaic's fourth free cell and replaces the deleted
  // `BrowseAllBanner`. No count — the catalogue total is not among the four
  // reads this page already makes, and it is not worth a fifth.
  tiles.push({
    title: "All Products",
    href: "/collections/all",
    image: resolveImage(TILE_IMAGES["/collections/all"] ?? FALLBACK_IMAGE),
  });

  return (
    <div className="min-h-screen">
      <RevealRegion>
        <CollectionBanner {...BANNER_CONTENT.index} />
      </RevealRegion>
      <CollectionMosaic tiles={tiles} />

      <div className="mx-auto max-w-[1600px] space-y-10 px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        {seeded.map(({ collection, initialPage }) => (
          <CollectionSection
            key={collection.href}
            {...collection}
            initialPage={initialPage}
          />
        ))}
      </div>
    </div>
  );
}
