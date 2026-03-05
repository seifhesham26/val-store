/**
 * Add Product Image Use Case
 *
 * Adds a new image to a product.
 * Validates product existence and handles display ordering.
 */

import { ProductImageRepositoryInterface } from "@/domain/interfaces/repositories/product-image.repository.interface";
import { ProductRepositoryInterface } from "@/domain/interfaces/repositories/product.repository.interface";
import { ProductImageEntity } from "@/domain/entities/product-image.entity";
import { ProductNotFoundException } from "@/domain/exceptions/product-not-found.exception";

export interface AddProductImageInput {
  productId: string;
  imageUrl: string;
  altText?: string;
  isPrimary?: boolean;
}

export interface AddProductImageOutput {
  id: string;
  productId: string;
  imageUrl: string;
  altText: string | null;
  displayOrder: number;
  isPrimary: boolean;
}

export class AddProductImageUseCase {
  constructor(
    private readonly imageRepository: ProductImageRepositoryInterface,
    private readonly productRepository: ProductRepositoryInterface
  ) {}

  async execute(input: AddProductImageInput): Promise<AddProductImageOutput> {
    // Verify product exists
    const product = await this.productRepository.findById(input.productId);
    if (!product) {
      throw new ProductNotFoundException(input.productId);
    }

    // Get current image count for display order
    const currentCount = await this.imageRepository.countByProduct(
      input.productId
    );

    // Determine if this should be primary
    // First image is always primary, or if explicitly set
    const isPrimary = input.isPrimary ?? currentCount === 0;

    // If setting as primary, need to unset other primary images
    if (isPrimary && currentCount > 0) {
      // Get existing primary and unset it
      const existing = await this.imageRepository.findByProduct(
        input.productId
      );
      for (const img of existing) {
        if (img.isPrimary) {
          await this.imageRepository.update(img.setPrimary(false));
        }
      }
    }

    // Create the image entity
    const image = new ProductImageEntity(
      "", // ID will be generated
      input.productId,
      input.imageUrl,
      input.altText ?? null,
      currentCount, // Next display order
      isPrimary,
      new Date()
    );

    // Save to database
    const saved = await this.imageRepository.create(image);

    return {
      id: saved.id,
      productId: saved.productId,
      imageUrl: saved.imageUrl,
      altText: saved.altText,
      displayOrder: saved.displayOrder,
      isPrimary: saved.isPrimary,
    };
  }
}
