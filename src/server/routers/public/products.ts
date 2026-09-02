/**
 * Public Products Router
 *
 * Public endpoints for storefront product data.
 * All endpoints use publicProcedure (no auth required).
 * Returns only active products with filtered data (no cost/admin info).
 *
 * Every list endpoint here costs a fixed four queries regardless of page size:
 * one bounded page of products, one count for the pager, and two batched
 * lookups for the images and variants the cards render. They used to load the
 * entire active catalogue, slice it in JavaScript, and then fetch images and
 * variants **one product at a time** — 1 + 2N queries for an N-card grid.
 */

import { z } from "zod";
import { headers } from "next/headers";
import { router, publicProcedure } from "../../trpc";
import { container } from "@/application/container";
import type { ProductEntity } from "@/domain/products/entities/product.entity";
import { pageWindow, pageCount } from "@/domain/shared/pagination";
import {
  apiRateLimiter,
  enforceRateLimit,
  getClientIp,
} from "@/server/utils/rate-limiter";

/**
 * Attach the presentation data a product card needs, in two queries total.
 *
 * The batched repository helpers already existed for the cached homepage; the
 * storefront routers were the callers that never adopted them.
 */
async function withCardData(pageProducts: ProductEntity[]) {
  if (pageProducts.length === 0) return [];

  const imageRepo = container.getProductImageRepository();
  const variantRepo = container.getProductVariantRepository();
  const productIds = pageProducts.map((p) => p.id);

  const [imageMap, variantMap] = await Promise.all([
    imageRepo.findPrimaryByProducts(productIds),
    variantRepo.findByProducts(productIds),
  ]);

  return pageProducts.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    basePrice: p.basePrice,
    salePrice: p.salePrice,
    categoryId: p.categoryId,
    gender: p.gender,
    isFeatured: p.isFeatured,
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
}

export const publicProductsRouter = router({
  /**
   * List active products for storefront with infinite scroll support
   */
  list: publicProcedure
    .input(
      z
        .object({
          categoryId: z.string().uuid().optional(),
          // A category *and its descendants*, resolved by the caller. Bounded
          // because it lands in an `IN (…)`; the catalogue's deepest tree is
          // two levels, so 50 is far above anything real.
          categoryIds: z.array(z.string().uuid()).max(50).optional(),
          gender: z.string().optional(),
          isFeatured: z.boolean().optional(),
          isOnSale: z.boolean().optional(),
          // "Added in the last N days" — the New Arrivals filter. Bounded so
          // it cannot be used to ask for an unbounded history window.
          createdWithinDays: z.number().int().min(1).max(365).optional(),
          limit: z.number().min(1).max(50).optional().default(12),
          cursor: z.number().min(1).optional(), // Page number
        })
        .optional()
    )
    .query(async ({ input }) => {
      const repo = container.getProductRepository();
      const page = input?.cursor ?? 1;
      const { limit, offset } = pageWindow(page, input?.limit ?? 12);

      // Gender and on-sale are SQL predicates now. Filtering them in JS meant
      // the page could only be sliced after every active product was loaded.
      const filters = {
        isActive: true,
        categoryId: input?.categoryId,
        categoryIds: input?.categoryIds,
        isFeatured: input?.isFeatured,
        gender: input?.gender,
        isOnSale: input?.isOnSale,
        createdWithinDays: input?.createdWithinDays,
      };

      const [pageProducts, total] = await Promise.all([
        repo.findAll({ ...filters, limit, offset }),
        repo.count(filters),
      ]);

      return {
        products: await withCardData(pageProducts),
        total,
        page,
        limit,
        totalPages: pageCount(total, limit),
      };
    }),

  // `getBySlug` (product detail) and `getFeatured` (homepage) were deleted
  // (ISSUES.md #28) — neither had a caller. `/products/[slug]` reads through
  // `getCachedProductBySlug` and the homepage through
  // `getCachedFeaturedProducts`, both in `src/lib/cache.ts`, calling the
  // repository directly rather than this router.

  /**
   * Search products with infinite scroll support
   */
  search: publicProcedure
    .input(
      z.object({
        // Bounded. Nothing legitimate searches with a 100KB term, and this one
        // becomes an `ILIKE '%…%'` pattern against two columns.
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(50).optional().default(12),
        cursor: z.number().min(1).optional(),
      })
    )
    .query(async ({ input }) => {
      // The most expensive thing an anonymous caller can ask for: two
      // unindexed leading-wildcard scans per call, with no auth to slow anyone
      // down first. Reading the client IP is not an auth lookup, so this does
      // not mark the request as having touched auth and the response stays
      // publicly cacheable — which is also why the limiter only ever sees the
      // requests a shared cache could not answer.
      await enforceRateLimit(
        apiRateLimiter,
        `search:${getClientIp(await headers())}`
      );

      const repo = container.getProductRepository();
      const page = input.cursor ?? 1;
      const { limit, offset } = pageWindow(page, input.limit ?? 12);

      // A real `ILIKE` against name and description, paginated in SQL. This
      // used to load every active product and filter with `String.includes`.
      const filters = { isActive: true, search: input.query };

      const [pageProducts, total] = await Promise.all([
        repo.findAll({ ...filters, limit, offset }),
        repo.count(filters),
      ]);

      return {
        products: await withCardData(pageProducts),
        total,
        page,
        limit,
        totalPages: pageCount(total, limit),
      };
    }),

  /**
   * Live stock for a set of variants.
   *
   * Split out from the product payloads so the client can hold one cached,
   * periodically-refreshed copy of stock and know every limit up front, instead
   * of discovering it from failed add-to-cart calls. Server-side validation
   * still runs on every write — this is for the UI, not for trust.
   *
   * The cap is generous because a whole product grid now shares **one** call
   * through `VariantStockProvider`. It used to be one call per card.
   */
  getStock: publicProcedure
    .input(z.object({ variantIds: z.array(z.string().uuid()).max(500) }))
    .query(async ({ input }) => {
      if (input.variantIds.length === 0) {
        return { stock: {} as Record<string, number> };
      }

      const repo = container.getProductVariantRepository();
      const variants = await repo.findByIds(input.variantIds);

      const stock: Record<string, number> = {};
      for (const variant of variants) {
        stock[variant.id] = variant.isAvailable ? variant.stockQuantity : 0;
      }

      return { stock };
    }),
});
