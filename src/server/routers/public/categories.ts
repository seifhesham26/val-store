/**
 * Public Categories Router
 *
 * Public endpoints for storefront category data.
 */

import { z } from "zod";
import { router, publicProcedure } from "../../trpc";
import { container } from "@/application/container";

export const publicCategoriesRouter = router({
  /**
   * List active categories with product counts
   */
  list: publicProcedure.query(async () => {
    const repo = container.getCategoryRepository();

    // One grouped count for every category, not one full product scan each.
    // The previous shape called `findAll({ categoryId })` inside a `map` — and
    // that query joins every variant and image — so listing twelve categories
    // hydrated the entire active catalogue twelve times to produce twelve
    // integers.
    const [categories, counts] = await Promise.all([
      repo.findAll(),
      repo.countProductsByCategory({ activeOnly: true }),
    ]);

    return categories
      .filter((c) => c.isActive)
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl,
        parentId: c.parentId,
        displayOrder: c.displayOrder,
        productCount: counts.get(c.id) ?? 0,
      }));
  }),

  /**
   * Get category by slug with products
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const categoryRepo = container.getCategoryRepository();
      const category = await categoryRepo.findBySlug(input.slug);

      if (!category || !category.isActive) {
        return null;
      }

      // A count, not the products themselves. The only caller — the dynamic
      // collection page — reads `id`, `name` and `description`, then hands the
      // id to `InfiniteProductGrid`, which queries the products again with
      // pagination. Returning the whole category here meant every collection
      // page loaded its entire product list twice, once of it unpaginated.
      const productCount = await container
        .getProductRepository()
        .count({ isActive: true, categoryId: category.id });

      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        productCount,
      };
    }),

  // `getFeatured` (curated homepage category cards via `featured_items`) was
  // deleted (ISSUES.md #28) — it had no caller. The homepage server component
  // reads the same curation straight from the repository through
  // `getCachedFeaturedCategories` in `src/lib/cache.ts` instead.
});
