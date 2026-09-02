import { revalidateTag } from "next/cache";
import { container } from "@/application/container";
import { urlOrAssetPath } from "@/domain/shared/value-objects/url-or-asset-path.schema";
import { z } from "zod";
import { router, adminProcedure, adminWriteProcedure } from "../../trpc";

/**
 * Categories Router - Thin Adapter
 *
 * Delegates all business logic to use cases.
 * Protected with admin-only access.
 */

const listCategoriesSchema = z
  .object({
    activeOnly: z.boolean().optional(),
  })
  .optional();

const createCategorySchema = z.object({
  name: z.string().min(1),
  // Omitted means "derive from the name", same as on update.
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
  imageUrl: urlOrAssetPath.optional(),
  displayOrder: z.number().int().optional(),
});

const updateCategorySchema = z.object({
  id: z.string().uuid(),
  data: z.object({
    name: z.string().min(1).optional(),
    // Omitted means "derive from the name". Sending one explicitly is how an
    // admin keeps an existing URL alive after renaming a category.
    slug: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
    imageUrl: urlOrAssetPath.nullable().optional(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
});

const deleteCategorySchema = z.object({
  id: z.string().uuid(),
});

/**
 * Drop the homepage's cached view of the categories.
 *
 * The storefront reads categories through `unstable_cache`, so without this an
 * admin edit is invisible for up to a minute. It never mattered while there was
 * no Categories page; now that there is one, every write has to say so.
 */
function revalidateCategories() {
  revalidateTag("categories", "max");
  revalidateTag("featured-categories", "max");
}

export const categoriesRouter = router({
  // List all categories
  list: adminProcedure.input(listCategoriesSchema).query(async ({ input }) => {
    const useCase = container.getListCategoriesUseCase();
    return useCase.execute(input || {});
  }),

  // Create new category
  create: adminWriteProcedure
    .input(createCategorySchema)
    .mutation(async ({ input }) => {
      const useCase = container.getCreateCategoryUseCase();
      const result = await useCase.execute(input);
      revalidateCategories();
      return result;
    }),

  // Update an existing category
  update: adminWriteProcedure
    .input(updateCategorySchema)
    .mutation(async ({ input }) => {
      const useCase = container.getUpdateCategoryUseCase();
      const result = await useCase.execute(input);
      revalidateCategories();
      return result;
    }),

  // Delete category
  delete: adminWriteProcedure
    .input(deleteCategorySchema)
    .mutation(async ({ input }) => {
      const useCase = container.getDeleteCategoryUseCase();
      const result = await useCase.execute(input);
      revalidateCategories();
      return result;
    }),
});
