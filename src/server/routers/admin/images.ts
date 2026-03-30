/**
 * Product Images Admin Router
 *
 * tRPC endpoints for managing product images.
 * All endpoints require admin authentication.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { container } from "@/application/container";
import { ProductImageEntity } from "@/domain/products/entities/product-image.entity";

// Validation schemas
const addImageSchema = z.object({
  productId: z.string().uuid(),
  imageUrl: z.string().url("Must be a valid URL"),
  altText: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const setPrimarySchema = z.object({
  productId: z.string().uuid(),
  imageId: z.string().uuid(),
});

// Helper to convert entity to plain object
function imageToOutput(image: ProductImageEntity) {
  return {
    id: image.id,
    productId: image.productId,
    imageUrl: image.imageUrl,
    altText: image.altText,
    displayOrder: image.displayOrder,
    isPrimary: image.isPrimary,
    createdAt: image.createdAt,
  };
}

export const imagesRouter = router({
  /**
   * List all images for a product
   */
  list: adminProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ input }) => {
      const repo = container.getProductImageRepository();
      const images = await repo.findByProduct(input.productId);
      return images.map(imageToOutput);
    }),

  /**
   * Add a new image to a product
   */
  add: adminProcedure.input(addImageSchema).mutation(async ({ input }) => {
    const useCase = container.getAddProductImageUseCase();
    return useCase.execute(input);
  }),

  /**
   * Delete an image
   */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const useCase = container.getRemoveProductImageUseCase();
      await useCase.execute({ imageId: input.id });
      return { success: true };
    }),

  /**
   * Set an image as primary
   */
  setPrimary: adminProcedure
    .input(setPrimarySchema)
    .mutation(async ({ input }) => {
      const repo = container.getProductImageRepository();
      await repo.setPrimary(input.productId, input.imageId);
      return { success: true };
    }),
});
