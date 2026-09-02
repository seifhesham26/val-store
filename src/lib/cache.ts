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

import { unstable_cache } from "next/cache";
import { container } from "@/application/container";
import { createAnonymousCaller } from "@/server/caller";

// Cache tags for easy invalidation
const CACHE_TAGS = {
  HERO: "hero-section",
  SITE_SETTINGS: "site-settings",
  FEATURED_PRODUCTS: "featured-products",
  FEATURED_CATEGORIES: "featured-categories",
  CATEGORIES: "categories",
  ANNOUNCEMENT: "announcement",
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

    return {
      isActive: section.isActive,
      content: section.content,
      parsedContent: JSON.parse(section.content),
    };
  },
  [CACHE_TAGS.HERO],
  { revalidate: DEFAULT_REVALIDATE, tags: [CACHE_TAGS.HERO] }
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

    return {
      isActive: section.isActive,
      content: section.content,
      parsedContent: JSON.parse(section.content),
    };
  },
  [CACHE_TAGS.ANNOUNCEMENT],
  { revalidate: DEFAULT_REVALIDATE, tags: [CACHE_TAGS.ANNOUNCEMENT] }
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
      imageRepo.findPrimaryByProducts(productIds),
      variantRepo.findByProducts(productIds),
    ]);

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: p.basePrice,
      salePrice: p.salePrice,
      isFeatured: p.isFeatured,
      primaryImage: imageMap.get(p.id)?.imageUrl ?? null,
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
    const imageMap = await imageRepo.findPrimaryByProducts(
      products.map((p) => p.id)
    );

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: p.basePrice,
      salePrice: p.salePrice,
      isFeatured: p.isFeatured,
      primaryImage: imageMap.get(p.id)?.imageUrl ?? null,
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
      imageRepo.findPrimaryByProducts(productIds),
      variantRepo.findByProducts(productIds),
    ]);

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: p.basePrice,
      salePrice: p.salePrice,
      primaryImage: imageMap.get(p.id)?.imageUrl ?? null,
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
  gender?: string;
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

// Export cache tags for revalidation
export { CACHE_TAGS };
