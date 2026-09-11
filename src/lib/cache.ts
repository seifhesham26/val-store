/**
 * Cached Data Fetchers
 *
 * Uses Next.js unstable_cache to cache database queries for 60 seconds.
 * This reduces database load and improves page load times.
 *
 * How it works:
 * - First request: Fetches from database, stores in cache
 * - Next 60 seconds: Returns cached data (no DB query)
 * - After 60 seconds: Fetches fresh data, updates cache
 */

import type { Gender } from "@/types/product";
import { unstable_cache } from "next/cache";
import { container } from "@/application/container";
import { createAnonymousCaller } from "@/server/caller";
import { isReservedCollectionSlug } from "@/domain/categories/reserved-slugs";
import { collectCategoryTree } from "@/domain/categories/category-tree";
import { parseSectionContent } from "@/lib/cms-content-parser";
import { parseLegalDocument } from "@/lib/legal-frontmatter";
import type { LegalSlug } from "@/domain/legal/legal-slugs";
import {
  parseHeroContent,
  parseAnnouncementContent,
  parseBrandStoryContent,
  parsePromoBannerContent,
} from "@/domain/site/value-objects/content-schemas";
import { CMS_SECTIONS_TAG, cmsSectionTag } from "./cms-cache-tags";

// Cache tags for easy invalidation.
//
// The four CMS section tags are NOT written out here. They come from
// `cmsSectionTag`, which the admin write path also calls — see
// `./cms-cache-tags` for the mismatch that cost the hero and the announcement
// their invalidation entirely.
const CACHE_TAGS = {
  SITE_SETTINGS: "site-settings",
  FEATURED_PRODUCTS: "featured-products",
  FEATURED_CATEGORIES: "featured-categories",
  CATEGORIES: "categories",
} as const;

// Default revalidation time (60 seconds)
const DEFAULT_REVALIDATE = 60;

/**
 * Revalidation for catalogue data, which is tag-invalidated.
 *
 * Every admin write that changes what a product card shows now calls
 * `revalidateCatalogue()` — including the variant and image mutations, which
 * previously called nothing at all and left the storefront stale after an
 * edit. The tags are therefore the correctness mechanism and this TTL is only
 * a backstop for a write path nobody remembered to announce.
 *
 * Five minutes rather than the hour it could be: this audit found two write
 * paths with no invalidation at all, so the demonstrated rate of missed tags
 * in this codebase is not zero, and a stale-for-an-hour storefront is a much
 * worse failure than a stale-for-five-minutes one. Raise it once the tag
 * coverage has stayed complete through a few more features.
 */
const CATALOGUE_REVALIDATE = 300;

/**
 * Get hero section content with caching
 */
export const getCachedHeroSection = unstable_cache(
  async () => {
    const repo = container.getSiteConfigRepository();
    const section = await repo.getContentSection("hero");
    if (!section) return null;

    // Validated against `heroContentSchema` — the same schema the write path
    // enforces — rather than a bare `JSON.parse` and a force-cast. A row
    // that fails validation degrades to `null`, exactly like a missing
    // section, so `ServerHeroSection`'s existing try/catch falls back to its
    // hardcoded defaults instead of rendering `undefined` fields.
    const parsedContent = parseSectionContent(
      "hero",
      section.content,
      parseHeroContent
    );
    if (!parsedContent) return null;

    return {
      isActive: section.isActive,
      content: section.content,
      parsedContent,
    };
  },
  [cmsSectionTag("hero")],
  {
    revalidate: DEFAULT_REVALIDATE,
    tags: [cmsSectionTag("hero"), CMS_SECTIONS_TAG],
  }
);

/**
 * Get site settings with caching
 */
export const getCachedSiteSettings = unstable_cache(
  async () => {
    const repo = container.getSiteConfigRepository();
    return repo.getSiteSettings();
  },
  [CACHE_TAGS.SITE_SETTINGS],
  { revalidate: DEFAULT_REVALIDATE, tags: [CACHE_TAGS.SITE_SETTINGS] }
);

/**
 * Get announcement section with caching
 */
export const getCachedAnnouncementSection = unstable_cache(
  async () => {
    const repo = container.getSiteConfigRepository();
    const section = await repo.getContentSection("announcement");
    if (!section) return null;

    // Same reasoning as `getCachedHeroSection`: validated against
    // `announcementContentSchema` rather than force-cast, and a failure
    // degrades to `null` so `ServerAnnouncementBar`'s try/catch falls back
    // to rendering nothing instead of a bar built from `undefined` fields.
    const parsedContent = parseSectionContent(
      "announcement",
      section.content,
      parseAnnouncementContent
    );
    if (!parsedContent) return null;

    return {
      isActive: section.isActive,
      content: section.content,
      parsedContent,
    };
  },
  [cmsSectionTag("announcement")],
  {
    revalidate: DEFAULT_REVALIDATE,
    tags: [cmsSectionTag("announcement"), CMS_SECTIONS_TAG],
  }
);

/**
 * Get the brand story section with caching.
 *
 * Both tags are deliberate, here and on all four CMS sections:
 * `content-sections.ts` fires the per-section tag and `cms-sections` on every
 * save, so listing both is what makes an admin edit appear immediately rather
 * than waiting out the TTL.
 */
export const getCachedBrandStorySection = unstable_cache(
  async () => {
    const repo = container.getSiteConfigRepository();
    const section = await repo.getContentSection("brand_story");
    if (!section) return null;

    // Same contract as the hero: a row that fails validation comes back as
    // `null`, so `ServerBrandStory` renders its hardcoded copy rather than a
    // section built from `undefined` fields.
    const parsedContent = parseSectionContent(
      "brand_story",
      section.content,
      parseBrandStoryContent
    );
    if (!parsedContent) return null;

    return {
      isActive: section.isActive,
      content: section.content,
      parsedContent,
    };
  },
  [cmsSectionTag("brand_story")],
  {
    revalidate: DEFAULT_REVALIDATE,
    tags: [cmsSectionTag("brand_story"), CMS_SECTIONS_TAG],
  }
);

/**
 * Get the promo banner section with caching.
 */
export const getCachedPromoBannerSection = unstable_cache(
  async () => {
    const repo = container.getSiteConfigRepository();
    const section = await repo.getContentSection("promo_banner");
    if (!section) return null;

    const parsedContent = parseSectionContent(
      "promo_banner",
      section.content,
      parsePromoBannerContent
    );
    if (!parsedContent) return null;

    return {
      isActive: section.isActive,
      content: section.content,
      parsedContent,
    };
  },
  [cmsSectionTag("promo_banner")],
  {
    revalidate: DEFAULT_REVALIDATE,
    tags: [cmsSectionTag("promo_banner"), CMS_SECTIONS_TAG],
  }
);

/**
 * Get featured products with caching
 */
export const getCachedFeaturedProducts = unstable_cache(
  async (limit: number = 8) => {
    const repo = container.getProductRepository();
    const imageRepo = container.getProductImageRepository();
    const variantRepo = container.getProductVariantRepository();
    const products = await resolveFeaturedProducts(repo, limit);
    const productIds = products.map((p) => p.id);

    // Batch-fetch primary images and variants (2 queries instead of 2N)
    const [imageMap, variantMap] = await Promise.all([
      imageRepo.findFirstTwoByProducts(productIds),
      variantRepo.findByProducts(productIds),
    ]);

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: p.basePrice,
      salePrice: p.salePrice,
      isFeatured: p.isFeatured,
      primaryImage: imageMap.get(p.id)?.[0]?.imageUrl ?? null,
      secondaryImage: imageMap.get(p.id)?.[1]?.imageUrl ?? null,
      // Needed by Quick Add: without these the card cannot record which variant
      // was bought, and the order would skip stock entirely.
      variants: (variantMap.get(p.id) ?? [])
        .filter((v) => v.isAvailable)
        .map((v) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          inStock: v.stockQuantity > 0,
        })),
    }));
  },
  [CACHE_TAGS.FEATURED_PRODUCTS],
  { revalidate: DEFAULT_REVALIDATE, tags: [CACHE_TAGS.FEATURED_PRODUCTS] }
);

/**
 * The curated homepage sections, as written by Settings → Featured.
 *
 * The admin tab wrote to `featured_items` and the homepage read
 * `products.isFeatured` instead, so curating changed nothing. The table is now
 * the source of truth — with the old behaviour kept as the fallback, so an
 * empty curation shows sensible defaults instead of a blank homepage.
 */
const FEATURED_PRODUCTS_SECTION = "homepage_featured";
const FEATURED_CATEGORIES_SECTION = "homepage_categories";

async function resolveFeaturedProducts(
  repo: ReturnType<typeof container.getProductRepository>,
  limit: number
) {
  const curated = await container
    .getSiteConfigRepository()
    .getFeaturedItems(FEATURED_PRODUCTS_SECTION);

  const curatedIds = curated
    .filter((item) => item.itemType === "product")
    .map((item) => item.itemId);

  if (curatedIds.length === 0) {
    return repo.findFeatured(limit);
  }

  const products = await repo.findByIds(curatedIds);
  const byId = new Map(products.map((product) => [product.id, product]));

  // Re-apply the admin's order, and drop ids whose product has since been
  // deleted or deactivated rather than rendering a hole.
  const resolved = curatedIds
    .flatMap((id) => {
      const product = byId.get(id);
      return product?.isActive ? [product] : [];
    })
    .slice(0, limit);

  // A curation can outlive its products: archive or delete every item on the
  // list and this resolves to nothing. Fall back rather than render a titled
  // section with an empty grid under it.
  return resolved.length > 0 ? resolved : repo.findFeatured(limit);
}

/**
 * Categories for the homepage grid, curated if any have been chosen.
 */
export const getCachedFeaturedCategories = unstable_cache(
  async (limit: number = 3) => {
    const categoryRepo = container.getCategoryRepository();
    const curated = await container
      .getSiteConfigRepository()
      .getFeaturedItems(FEATURED_CATEGORIES_SECTION);

    const curatedIds = curated
      .filter((item) => item.itemType === "category")
      .map((item) => item.itemId);

    let selected: Awaited<ReturnType<typeof categoryRepo.findActive>> = [];
    if (curatedIds.length > 0) {
      const found = await categoryRepo.findByIds(curatedIds);
      const byId = new Map(found.map((category) => [category.id, category]));
      selected = curatedIds
        .flatMap((id) => {
          const category = byId.get(id);
          return category?.isActive ? [category] : [];
        })
        .slice(0, limit);
    }

    // Same as for products: an empty list *and* a list whose every entry has
    // since been deactivated both mean "nothing curated", and both fall back.
    if (selected.length === 0) {
      const active = await categoryRepo.findActive();
      selected = active
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .slice(0, limit);
    }

    // One grouped count for the whole grid. This used to be a `findAll()` per
    // category — a full table scan each, inside a loop.
    const counts = await categoryRepo.countProductsByCategory();

    return selected.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      // Carried through because the card renders it. It used to be dropped
      // here, so `categories.image_url` was a column an admin could set and
      // nothing would ever read — the grid showed a random picsum photo keyed
      // on the slug instead.
      imageUrl: category.imageUrl ?? null,
      productCount: counts.get(category.id) ?? 0,
    }));
  },
  [CACHE_TAGS.FEATURED_CATEGORIES],
  {
    revalidate: DEFAULT_REVALIDATE,
    tags: [CACHE_TAGS.FEATURED_CATEGORIES, CACHE_TAGS.CATEGORIES],
  }
);

/**
 * Get all categories with caching
 */
export const getCachedCategories = unstable_cache(
  async () => {
    const repo = container.getCategoryRepository();
    const categories = await repo.findAll();

    // Return serializable data only
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      isActive: c.isActive,
    }));
  },
  [CACHE_TAGS.CATEGORIES],
  { revalidate: DEFAULT_REVALIDATE, tags: [CACHE_TAGS.CATEGORIES] }
);

/**
 * Get products by category with caching
 *
 * Tagged `all-products` like the list fetchers below it. These three carried a
 * cache key but no tags, so `revalidateTag("all-products")` — which every admin
 * product write calls — could not reach them: the lists updated on save while
 * the detail page for the same product stayed stale for up to a minute.
 */
export const getCachedProductsByCategory = unstable_cache(
  async (categoryId: string) => {
    const repo = container.getProductRepository();
    const products = await repo.findByCategory(categoryId);

    return products
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        basePrice: p.basePrice,
        salePrice: p.salePrice,
      }));
  },
  ["products-by-category"],
  { revalidate: DEFAULT_REVALIDATE, tags: ["all-products"] }
);

/**
 * Get product by slug with caching (for product detail page)
 */
export const getCachedProductBySlug = unstable_cache(
  async (slug: string) => {
    const productRepo = container.getProductRepository();
    const product = await productRepo.findBySlug(slug);

    if (!product || !product.isActive) {
      return null;
    }

    // Get images and variants
    const imageRepo = container.getProductImageRepository();
    const variantRepo = container.getProductVariantRepository();

    // Independent queries. Awaited in series they cost two round trips to the
    // database; issued together postgres.js pipelines them down one connection
    // and they cost roughly one.
    const [images, variants] = await Promise.all([
      imageRepo.findByProduct(product.id),
      variantRepo.findByProduct(product.id),
    ]);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      basePrice: product.basePrice,
      salePrice: product.salePrice,
      categoryId: product.categoryId,
      material: product.material,
      careInstructions: product.careInstructions,
      images: images.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        altText: img.altText,
        isPrimary: img.isPrimary,
        displayOrder: img.displayOrder,
      })),
      variants: variants
        .filter((v) => v.isAvailable)
        .map((v) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          priceAdjustment: v.priceAdjustment,
          inStock: v.stockQuantity > 0,
          // Exposed so the product page can cap the quantity stepper at what
          // can actually be fulfilled.
          availableStock: v.stockQuantity,
        })),
    };
  },
  ["product-by-slug"],
  { revalidate: DEFAULT_REVALIDATE, tags: ["all-products"] }
);

/**
 * Get all active products with caching (for collections page)
 * Uses DB-level LIMIT instead of fetching all then slicing
 */
export const getCachedAllProducts = unstable_cache(
  async (limit: number = 50) => {
    const repo = container.getProductRepository();
    const imageRepo = container.getProductImageRepository();
    const products = await repo.findAll({ isActive: true, limit });

    // Batch-fetch primary images (1 query instead of N)
    const imageMap = await imageRepo.findFirstTwoByProducts(
      products.map((p) => p.id)
    );

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: p.basePrice,
      salePrice: p.salePrice,
      isFeatured: p.isFeatured,
      primaryImage: imageMap.get(p.id)?.[0]?.imageUrl ?? null,
      secondaryImage: imageMap.get(p.id)?.[1]?.imageUrl ?? null,
    }));
  },
  ["all-products"],
  { revalidate: DEFAULT_REVALIDATE, tags: ["all-products"] }
);

/**
 * Get related products (excluding current product)
 * Uses DB-level WHERE + LIMIT instead of fetching all then filtering in JS
 */
export const getCachedRelatedProducts = unstable_cache(
  async (excludeId: string, limit: number = 4) => {
    const repo = container.getProductRepository();
    const imageRepo = container.getProductImageRepository();
    const variantRepo = container.getProductVariantRepository();
    const products = await repo.findAll({
      isActive: true,
      excludeId,
      limit,
    });
    const productIds = products.map((p) => p.id);

    const [imageMap, variantMap] = await Promise.all([
      imageRepo.findFirstTwoByProducts(productIds),
      variantRepo.findByProducts(productIds),
    ]);

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: p.basePrice,
      salePrice: p.salePrice,
      primaryImage: imageMap.get(p.id)?.[0]?.imageUrl ?? null,
      secondaryImage: imageMap.get(p.id)?.[1]?.imageUrl ?? null,
      variants: (variantMap.get(p.id) ?? [])
        .filter((v) => v.isAvailable)
        .map((v) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          inStock: v.stockQuantity > 0,
        })),
    }));
  },
  ["related-products"],
  { revalidate: DEFAULT_REVALIDATE, tags: ["all-products"] }
);

/**
 * Every active product slug, for `generateStaticParams`.
 *
 * Deliberately a bare list of strings rather than whole entities: this runs at
 * build time for the sole purpose of enumerating routes, and pulling full
 * products to read one field each would be wasteful.
 */
export const getCachedProductSlugs = unstable_cache(
  async () => {
    const repo = container.getProductRepository();
    const products = await repo.findAll({ isActive: true });
    return products.map((p) => p.slug);
  },
  ["product-slugs"],
  { revalidate: CATALOGUE_REVALIDATE, tags: ["all-products"] }
);

/** Every active category slug, for `generateStaticParams`. */
export const getCachedCategorySlugs = unstable_cache(
  async () => {
    const repo = container.getCategoryRepository();
    const categories = await repo.findActive();
    return categories.map((c) => c.slug);
  },
  ["category-slugs"],
  { revalidate: CATALOGUE_REVALIDATE, tags: [CACHE_TAGS.CATEGORIES] }
);

/**
 * The filters a collection page can pin its grid to. Mirrors the subset of
 * `public.products.list` input that the storefront grids actually vary.
 */
export interface ProductListPageFilters {
  categoryId?: string;
  /** A category and its descendants — see `collectCategoryTree`. */
  categoryIds?: string[];
  gender?: Gender;
  isFeatured?: boolean;
  isOnSale?: boolean;
  /** Added within the last N days — see `NEW_ARRIVAL_WINDOW_DAYS`. */
  createdWithinDays?: number;
  limit?: number;
}

/**
 * Page 1 of a product grid, resolved on the server.
 *
 * This is the fix for the collection pages' worst waterfall. They rendered a
 * client component that fetched page 1 over HTTP after the bundle downloaded
 * and hydrated, so the chain to first product was: shell, bundle, hydrate,
 * request, four queries, paint. The server had everything it needed the whole
 * time.
 *
 * It calls the *same procedure* the client would have called rather than
 * reimplementing the query, so the payload handed to `initialData` cannot
 * drift from what page 2 returns — a mismatch there would show as cards
 * changing shape the moment the customer scrolled.
 */
export const getCachedFirstProductPage = unstable_cache(
  async (filters: ProductListPageFilters) => {
    const caller = createAnonymousCaller();
    return caller.public.products.list({
      ...filters,
      limit: filters.limit ?? 12,
      cursor: 1,
    });
  },
  ["product-list-first-page"],
  { revalidate: CATALOGUE_REVALIDATE, tags: ["all-products"] }
);

/** The exact payload shape `InfiniteProductGrid` seeds its query cache with. */
export type ProductListPage = Awaited<
  ReturnType<typeof getCachedFirstProductPage>
>;

/**
 * A category resolved by slug, for `/collections/[slug]`.
 *
 * That page was a client component that fetched the category first and only
 * then let the grid start fetching products — two sequential round trips after
 * hydration to turn a slug into an id, for data that changes when an admin
 * edits a category and not otherwise.
 */
export const getCachedCategoryBySlug = unstable_cache(
  async (slug: string) => {
    const caller = createAnonymousCaller();
    return caller.public.categories.getBySlug({ slug });
  },
  ["category-by-slug"],
  { revalidate: CATALOGUE_REVALIDATE, tags: [CACHE_TAGS.CATEGORIES] }
);

/**
 * Top-level categories for the site navigation.
 *
 * The nav was three hardcoded link lists — `Navbar`, `MobileMenu`, `Footer` —
 * which could not drift *into* correctness: an admin creating a category got no
 * link, and deleting one left a dead link behind. That is not hypothetical;
 * three of those links pointed at "Summer 2025", "Essentials" and "Best
 * Sellers", categories that have never existed in any seed, and every one was a
 * hard 404 served from the mobile menu.
 *
 * This is also what finally gives `public.categories.list` a caller. It had
 * none outside an integration test, while being exactly the procedure this
 * needed — it already returns `parentId`, `displayOrder` and a product count,
 * and already filters to active categories.
 *
 * Reserved slugs are dropped: `all`, `sale` and `new` are served by static
 * routes and already appear in the nav as curated links, so a category sharing
 * one of those slugs would render a duplicate entry pointing somewhere it does
 * not control. See `RESERVED_COLLECTION_SLUGS`.
 */
export const getCachedNavCategories = unstable_cache(
  async () => {
    const caller = createAnonymousCaller();
    const categories = await caller.public.categories.list();

    return categories
      .filter((category) => category.parentId === null)
      .filter((category) => !isReservedCollectionSlug(category.slug))
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((category) => ({
        label: category.name,
        href: `/collections/${category.slug}`,
      }));
  },
  ["nav-categories"],
  { revalidate: CATALOGUE_REVALIDATE, tags: [CACHE_TAGS.CATEGORIES] }
);

/** One nav entry: what the three link lists consume. */
export type NavCategory = Awaited<
  ReturnType<typeof getCachedNavCategories>
>[number];

/**
 * Top-level categories for the collection toolbar, each carrying its whole
 * subtree.
 *
 * The subtree is the point. Every product is filed against a *leaf* category
 * while the navigation links to parents, so `eq(products.categoryId, parentId)`
 * matched nothing — that is what rendered "No products found" on
 * `/collections/women` for a store with thirteen women's products.
 *
 * Separate from `getCachedNavCategories`, which deliberately returns only what
 * a link list needs.
 */
export const getCachedToolbarCategories = unstable_cache(
  async () => {
    const caller = createAnonymousCaller();
    const categories = await caller.public.categories.list();

    return categories
      .filter((category) => category.parentId === null)
      .filter((category) => !isReservedCollectionSlug(category.slug))
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((category) => ({
        slug: category.slug,
        name: category.name,
        categoryIds: collectCategoryTree(categories, category.id),
      }));
  },
  ["toolbar-categories"],
  { revalidate: CATALOGUE_REVALIDATE, tags: [CACHE_TAGS.CATEGORIES] }
);

/** One toolbar chip. Matches `ToolbarCategory` in `CollectionToolbar`. */
export type ToolbarCategoryData = Awaited<
  ReturnType<typeof getCachedToolbarCategories>
>[number];

/**
 * One legal page, by slug.
 *
 * `unstable_cache` cannot take a closure argument in its key, so this is a
 * factory: one cached fetcher per slug, each with its own tag. `admin.legal`
 * calls `revalidateTag(`legal-<slug>`, "max")` after a write, which is the
 * actual correctness mechanism — the TTL is only a backstop.
 *
 * It calls the router rather than reimplementing its query, so a
 * server-rendered policy page cannot drift from what the admin editor reads.
 */
const legalPageFetchers = new Map<
  LegalSlug,
  () => Promise<LegalPagePayload | null>
>();

export type LegalPagePayload = {
  slug: string;
  title: string;
  bodyMarkdown: string;
  effectiveDate: string;
};

export function getCachedLegalPage(slug: LegalSlug) {
  const existing = legalPageFetchers.get(slug);
  if (existing) return existing;

  const fetcher = unstable_cache(
    async () => {
      const caller = createAnonymousCaller();
      return (await caller.public.legal.getBySlug({
        slug,
      })) as LegalPagePayload | null;
    },
    ["legal-page", slug],
    { revalidate: CATALOGUE_REVALIDATE, tags: [`legal-${slug}`] }
  );

  legalPageFetchers.set(slug, fetcher);
  return fetcher;
}

/**
 * The page content, with the repo markdown as a fallback.
 *
 * Every CMS-backed surface in this codebase degrades rather than crashing, and
 * a policy page is where that matters most: a database blip must not replace
 * a customer's statutory rights with a 500. `content/legal/*.md` is the same
 * text the database was seeded from, so falling back to it is truthful rather
 * than merely non-empty.
 *
 * These pages are prerendered, so this path runs at build time where the repo
 * is on disk. If even that fails the caller renders a short notice.
 */
export async function resolveLegalPage(
  slug: LegalSlug
): Promise<LegalPagePayload | null> {
  try {
    const page = await getCachedLegalPage(slug)();
    if (page) return page;
  } catch {
    // fall through to the repo copy
  }

  try {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const raw = readFileSync(
      join(process.cwd(), "content", "legal", `${slug}.md`),
      "utf-8"
    );
    const doc = parseLegalDocument(raw);
    return {
      slug,
      title: doc.title,
      bodyMarkdown: doc.body,
      effectiveDate: doc.effectiveDate,
    };
  } catch {
    return null;
  }
}

// Export cache tags for revalidation
export { CACHE_TAGS };
