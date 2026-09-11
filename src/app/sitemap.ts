import type { MetadataRoute } from "next";
import { getCachedCategorySlugs, getCachedProductSlugs } from "@/lib/cache";
import { absoluteUrl } from "@/lib/site-url";

/**
 * sitemap.xml
 *
 * Served at `/sitemap.xml`, and named by `robots.ts`.
 *
 * ## Where the data comes from
 *
 * `getCachedProductSlugs` and `getCachedCategorySlugs` already exist — they are
 * what `generateStaticParams` uses to prerender `/products/[slug]` and
 * `/collections/[slug]`. Reusing them rather than writing new queries is the
 * point: the sitemap then lists exactly the pages that get built, and cannot
 * drift into advertising a URL that 404s. Both are `unstable_cache`d and
 * tagged, so an admin publishing a product invalidates this too.
 *
 * ## The fallback
 *
 * A database failure degrades to the static list instead of throwing. This is
 * the same pattern the CMS sections use, but the reasoning is sharper here:
 * robots.txt publishes this URL, so a crawler will fetch it whether or not
 * Neon is awake. Serving a partial sitemap is a missed crawl of the product
 * pages; serving a 500 repeatedly is what makes Search Console mark the
 * sitemap itself as broken.
 */

type Entry = MetadataRoute.Sitemap[number];

/**
 * `priority` is a hint about relative importance *within this site* — Google
 * treats it loosely and it never affects ranking against anyone else. The
 * values below just encode the obvious: the homepage and the collection
 * landings are the entry points, the legal pages are not.
 *
 * `changeFrequency` is likewise advisory. `lastModified` is the field crawlers
 * actually act on, and it is honest here only for the static routes — see the
 * note on the catalogue entries below.
 */
const STATIC_ROUTES: {
  path: string;
  priority: number;
  freq: Entry["changeFrequency"];
}[] = [
  { path: "/", priority: 1, freq: "daily" },

  // Collection landings. `/collections/new` is a real page rather than a
  // redirect — the comment in `reserved-slugs.ts` calling it one is stale —
  // so it belongs here alongside the other two static collections.
  { path: "/collections", priority: 0.9, freq: "daily" },
  { path: "/collections/all", priority: 0.9, freq: "daily" },
  { path: "/collections/new", priority: 0.9, freq: "daily" },
  { path: "/collections/sale", priority: 0.9, freq: "daily" },

  // Marketing.
  { path: "/about", priority: 0.6, freq: "monthly" },
  { path: "/contact", priority: 0.6, freq: "monthly" },
  { path: "/blog", priority: 0.5, freq: "weekly" },
  { path: "/careers", priority: 0.4, freq: "monthly" },
  { path: "/press", priority: 0.4, freq: "monthly" },
  { path: "/sustainability", priority: 0.4, freq: "monthly" },

  // Support. `/size-guide` and `/shipping` are genuinely searched for by name
  // alongside the brand, so they are rated above the rest of this group.
  { path: "/size-guide", priority: 0.6, freq: "monthly" },
  { path: "/shipping", priority: 0.6, freq: "monthly" },
  { path: "/faq", priority: 0.5, freq: "monthly" },
  { path: "/returns", priority: 0.5, freq: "monthly" },

  // Legal. Low priority, but they must be indexable: a payment provider
  // review and a Meta/Google ad account review both check that these exist
  // and are publicly reachable.
  { path: "/privacy", priority: 0.3, freq: "yearly" },
  { path: "/terms", priority: 0.3, freq: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.freq,
    priority: route.priority,
  }));

  let catalogueEntries: MetadataRoute.Sitemap = [];

  try {
    const [categorySlugs, productSlugs] = await Promise.all([
      getCachedCategorySlugs(),
      getCachedProductSlugs(),
    ]);

    // `lastModified` is the generation time rather than the row's `updatedAt`,
    // because the cached fetchers return slugs only. That is deliberate: this
    // route is itself revalidated on the catalogue tags, so the timestamp
    // moves when the catalogue changes, which is the signal a crawler wants.
    // Widening those fetchers to carry timestamps would change what four
    // prerender paths load, to sharpen a field crawlers treat as a hint.
    catalogueEntries = [
      ...categorySlugs.map((slug) => ({
        url: absoluteUrl(`/collections/${slug}`),
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...productSlugs.map((slug) => ({
        url: absoluteUrl(`/products/${slug}`),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch (error) {
    // Logged rather than swallowed: a sitemap that quietly shrinks to 17 URLs
    // looks like a working sitemap, and the only symptom would be product
    // pages slowly dropping out of the index weeks later.
    console.error(
      "[sitemap] catalogue lookup failed, serving static routes only:",
      error
    );
  }

  return [...staticEntries, ...catalogueEntries];
}
