/**
 * Collection slugs the storefront serves from a static route.
 *
 * `/collections/[slug]` renders a category, but a handful of collections are
 * not categories at all — "everything" and "discounted" are cross-cutting
 * views over the catalogue, and no row in `categories` can express them. Those
 * live at static routes.
 *
 * Next.js resolves a static segment before a dynamic one, so a static route
 * silently wins over any category that happens to share its slug. That is not
 * hypothetical: `men`, `women`, `accessories` and `sale` all existed as
 * categories while static pages at those paths served something else entirely
 * — `/collections/men` filtered on `products.gender` rather than on the Men
 * category, so it showed one product out of the fourteen filed beneath it, and
 * an admin editing the category saw no effect at all.
 *
 * Three of those static pages are gone and `[slug]` now owns them. What is
 * left is the rule that stops it recurring: a category may not take one of
 * these slugs, and a new static route may not take a slug outside this list.
 * Both halves are enforced — the first by the create/update use cases, the
 * second by `reserved-slugs.test.ts`, which reads the route directory.
 */
export const RESERVED_COLLECTION_SLUGS = [
  /** Every active product, unfiltered. */
  "all",
  /** Sale price undercuts base price — a comparison, not a category. */
  "sale",
  /** Kept only as a redirect to the `new-arrivals` category. */
  "new",
] as const;

export type ReservedCollectionSlug = (typeof RESERVED_COLLECTION_SLUGS)[number];

/** Would a category with this slug be unreachable behind a static route? */
export function isReservedCollectionSlug(slug: string): boolean {
  return (RESERVED_COLLECTION_SLUGS as readonly string[]).includes(
    slug.toLowerCase()
  );
}

/**
 * The message an admin sees. Names the alternative rather than just refusing,
 * because "sale" is a genuinely reasonable thing to want to call a category.
 */
export function reservedCollectionSlugMessage(slug: string): string {
  return (
    `"${slug}" is reserved for a built-in collection page, so a category ` +
    `using it would never be reachable. Choose a different slug — ` +
    `"${slug}-collection", for example.`
  );
}
