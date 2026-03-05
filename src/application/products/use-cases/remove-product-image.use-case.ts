/**
 * Remove Product Image Use Case
 *
 * Removes an image from a product.
 * Handles primary image re-assignment when removing the primary image.
 */

import { ProductImageRepositoryInterface } from "@/domain/interfaces/repositories/product-image.repository.interface";

export interface RemoveProductImageInput {
  imageId: string;
}

export interface RemoveProductImageOutput {
  success: boolean;
  deletedImageId: string;
  newPrimaryImageId: string | null;
}

export class RemoveProductImageUseCase {
  constructor(
    private readonly imageRepository: ProductImageRepositoryInterface
  ) {}

  async execute(
    input: RemoveProductImageInput
  ): Promise<RemoveProductImageOutput> {
    // Find the image to delete
    const image = await this.imageRepository.findById(input.imageId);
    if (!image) {
      throw new Error(`Image with ID "${input.imageId}" not found`);
    }

    const productId = image.productId;
    const wasPrimary = image.isPrimary;

    // Delete the image
    await this.imageRepository.delete(input.imageId);

    let newPrimaryImageId: string | null = null;

    // If deleted image was primary, assign a new primary
    if (wasPrimary) {
      const remainingImages =
        await this.imageRepository.findByProduct(productId);

      if (remainingImages.length > 0) {
        // Set the first remaining image as primary
        const newPrimary = remainingImages[0];
        await this.imageRepository.setPrimary(productId, newPrimary.id);
        newPrimaryImageId = newPrimary.id;
      }
    }

    return {
      success: true,
      deletedImageId: input.imageId,
      newPrimaryImageId,
    };
  }
}
