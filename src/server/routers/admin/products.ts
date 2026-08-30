import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { revalidateTag } from "next/cache";
import { container } from "@/application/container";
import { urlOrAssetPath } from "@/domain/shared/value-objects/url-or-asset-path.schema";

// Validation schemas
const createProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  // Bounded to match the column: `products.sku` is varchar(100), and
  // overflowing it surfaces a raw Postgres error instead of a field message.
  sku: z.string().min(1).max(100),
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

// Images and variants are accepted by `create` only. On the edit page they are
// managed one at a time through admin.images / admin.variants, where each change
// is its own deliberate action; at creation they must land with the product or
// not at all.
const newProductRelationsSchema = z.object({
  images: z
    .array(
      z.object({
        imageUrl: urlOrAssetPath,
        altText: z.string().nullable().optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .max(20)
    .optional(),
  variants: z
    .array(
      z.object({
        sku: z.string().min(1).max(100),
        size: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        stockQuantity: z.number().int().min(0),
        priceAdjustment: z.number(),
      })
    )
    .max(100)
    .optional(),
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

/**
 * Drop the homepage's cached view of the catalogue.
 *
 * `isFeatured`, the price and the active flag are all read through
 * `unstable_cache`, so an edit that is not announced here stays invisible on the
 * storefront for up to a minute — long enough for an admin to conclude the save
 * did not work and press it again.
 */
function revalidateCatalogue() {
  revalidateTag("featured-products", "max");
  revalidateTag("all-products", "max");
}

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
    .input(createProductSchema.extend(newProductRelationsSchema.shape))
    .mutation(async ({ input }) => {
      const useCase = container.getCreateProductUseCase();
      const result = await useCase.execute(input);
      revalidateCatalogue();
      return result;
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
      const result = await useCase.execute(input);
      revalidateCatalogue();
      return result;
    }),

  // Delete product
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const useCase = container.getDeleteProductUseCase();
      const result = await useCase.execute(input);
      revalidateCatalogue();
      return result;
    }),

  // Toggle product status
  toggleStatus: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const useCase = container.getToggleProductStatusUseCase();
      const result = await useCase.execute(input);
      revalidateCatalogue();
      return result;
    }),
});
