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

  /**
   * Get featured categories for homepage with product counts
   */
  getFeatured: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(10).optional().default(6) }))
    .query(async ({ input }) => {
      const siteConfigRepo = container.getSiteConfigRepository();
      const categoryRepo = container.getCategoryRepository();

      // Get featured items of type 'category'
      const featuredItems = await siteConfigRepo.getFeaturedItemsByType(
        "homepage_categories",
        "category"
      );

      const curatedIds = featuredItems
        .slice(0, input.limit)
        .map((item) => item.itemId);

      if (curatedIds.length === 0) return [];

      // Three queries total. This was one `findById` plus one full product
      // scan per curated category.
      const [categories, counts] = await Promise.all([
        categoryRepo.findByIds(curatedIds),
        categoryRepo.countProductsByCategory({ activeOnly: true }),
      ]);

      const byId = new Map(categories.map((c) => [c.id, c]));

      // Re-apply the admin's curated order — `findByIds` does not guarantee it.
      return curatedIds.flatMap((id) => {
        const category = byId.get(id);
        if (!category?.isActive) return [];
        return [
          {
            id: category.id,
            name: category.name,
            slug: category.slug,
            imageUrl: category.imageUrl,
            productCount: counts.get(category.id) ?? 0,
          },
        ];
      });
    }),
});
