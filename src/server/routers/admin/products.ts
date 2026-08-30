import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { container } from "@/application/container";

// Validation schemas
const createProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  sku: z.string().min(1),
  description: z.string(),
  categoryId: z.string().uuid(),
  basePrice: z.number().positive(),
  salePrice: z.number().positive().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  gender: z.enum(["men", "women", "unisex", "kids"]).nullable().optional(),
  material: z.string().nullable().optional(),
  careInstructions: z.string().nullable().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
});

const listProductsSchema = z.object({
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  categoryId: z.string().uuid().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  limit: z.number().min(1).max(100).optional().default(10),
  cursor: z.number().min(1).optional(), // Page number as cursor for infinite scroll
});

export const productsRouter = router({
  // List all products with infinite scroll support
  list: adminProcedure
    .input(listProductsSchema.optional())
    .query(async ({ input }) => {
      const useCase = container.getListProductsUseCase();
      // Use cursor as page number, default to 1
      const page = input?.cursor ?? 1;
      return useCase.execute({
        ...input,
        page,
        limit: input?.limit ?? 10,
      });
    }),

  // Get single product by ID
  getById: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const useCase = container.getGetProductUseCase();
      return useCase.execute({ id: input.id });
    }),

  // Get product by slug
  getBySlug: adminProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const useCase = container.getGetProductUseCase();
      return useCase.execute({ slug: input.slug });
    }),

  // Create new product
  create: adminProcedure
    .input(createProductSchema)
    .mutation(async ({ input }) => {
      const useCase = container.getCreateProductUseCase();
      return useCase.execute(input);
    }),

  // Update product
  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        // salePrice is nullable on update specifically: sending null is how the
        // edit form clears an existing sale price. An omitted key still means
        // "leave unchanged".
        data: createProductSchema.partial().extend({
          salePrice: z.number().positive().nullable().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const useCase = container.getUpdateProductUseCase();
      return useCase.execute(input);
    }),

  // Delete product
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const useCase = container.getDeleteProductUseCase();
      return useCase.execute(input);
    }),

  // Toggle product status
  toggleStatus: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const useCase = container.getToggleProductStatusUseCase();
      return useCase.execute(input);
    }),
});
