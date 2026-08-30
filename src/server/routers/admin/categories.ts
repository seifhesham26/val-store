import { container } from "@/application/container";
import { urlOrAssetPath } from "@/domain/shared/value-objects/url-or-asset-path.schema";
import { z } from "zod";
import { router, adminProcedure } from "../../trpc";

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

export const categoriesRouter = router({
  // List all categories
  list: adminProcedure.input(listCategoriesSchema).query(async ({ input }) => {
    const useCase = container.getListCategoriesUseCase();
    return useCase.execute(input || {});
  }),

  // Create new category
  create: adminProcedure
    .input(createCategorySchema)
    .mutation(async ({ input }) => {
      const useCase = container.getCreateCategoryUseCase();
      return useCase.execute(input);
    }),

  // Update an existing category
  update: adminProcedure
    .input(updateCategorySchema)
    .mutation(async ({ input }) => {
      const useCase = container.getUpdateCategoryUseCase();
      return useCase.execute(input);
    }),

  // Delete category
  delete: adminProcedure
    .input(deleteCategorySchema)
    .mutation(async ({ input }) => {
      const useCase = container.getDeleteCategoryUseCase();
      return useCase.execute(input);
    }),
});
