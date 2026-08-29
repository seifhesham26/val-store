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

// Cache tags for easy invalidation
const CACHE_TAGS = {
  HERO: "hero-section",
  SITE_SETTINGS: "site-settings",
  FEATURED_PRODUCTS: "featured-products",
  CATEGORIES: "categories",
  ANNOUNCEMENT: "announcement",
} as const;

// Default revalidation time (60 seconds)
const DEFAULT_REVALIDATE = 60;

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
    const products = await repo.findFeatured(limit);
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
  { revalidate: DEFAULT_REVALIDATE }
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

    const images = await imageRepo.findByProduct(product.id);
    const variants = await variantRepo.findByProduct(product.id);

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
  { revalidate: DEFAULT_REVALIDATE }
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
  { revalidate: DEFAULT_REVALIDATE }
);

// Export cache tags for revalidation
export { CACHE_TAGS };
