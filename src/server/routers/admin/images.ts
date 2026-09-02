/**
 * Product Images Admin Router
 *
 * tRPC endpoints for managing product images.
 * All endpoints require admin authentication.
 */

import { z } from "zod";
import { router, adminProcedure, adminWriteProcedure } from "../../trpc";
import { container } from "@/application/container";
import { urlOrAssetPath } from "@/domain/shared/value-objects/url-or-asset-path.schema";
import { ProductImageEntity } from "@/domain/products/entities/product-image.entity";
import { revalidateCatalogue } from "@/server/utils/revalidate-catalogue";

// Validation schemas
const addImageSchema = z.object({
  productId: z.string().uuid(),
  imageUrl: urlOrAssetPath,
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
  add: adminWriteProcedure.input(addImageSchema).mutation(async ({ input }) => {
    const useCase = container.getAddProductImageUseCase();
    const image = await useCase.execute(input);
    // A storefront card renders its primary image, so this changed the grid.
    revalidateCatalogue();
    return image;
  }),

  /**
   * Delete an image
   */
  delete: adminWriteProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const useCase = container.getRemoveProductImageUseCase();
      await useCase.execute({ imageId: input.id });
      revalidateCatalogue();
      return { success: true };
    }),

  /**
   * Set an image as primary
   */
  setPrimary: adminWriteProcedure
    .input(setPrimarySchema)
    .mutation(async ({ input }) => {
      const repo = container.getProductImageRepository();
      await repo.setPrimary(input.productId, input.imageId);
      // This is *the* field the card shows; without this the grid keeps
      // showing the old primary image until the cache expires on its own.
      revalidateCatalogue();
      return { success: true };
    }),
});
