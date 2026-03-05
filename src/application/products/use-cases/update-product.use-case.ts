/**
 * Update Product Use Case
 *
 * Updates an existing product with partial data.
 * Validates product exists and handles partial updates.
 */

import { ProductRepositoryInterface } from "@/domain/interfaces/repositories/product.repository.interface";
import { ProductEntity } from "@/domain/entities/product.entity";
import { ProductNotFoundException } from "@/domain/exceptions/product-not-found.exception";

export interface UpdateProductInput {
  id: string;
  data: {
    name?: string;
    slug?: string;
    description?: string;
    categoryId?: string;
    basePrice?: number;
    salePrice?: number | null;
    isActive?: boolean;
    isFeatured?: boolean;
  };
}

export interface UpdateProductOutput {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string | null;
  basePrice: number;
  salePrice: number | null;
  isActive: boolean;
  isFeatured: boolean;
  updatedAt: Date;
}

export class UpdateProductUseCase {
  constructor(private readonly productRepository: ProductRepositoryInterface) {}

  async execute(input: UpdateProductInput): Promise<UpdateProductOutput> {
    // Find existing product
    const existingProduct = await this.productRepository.findById(input.id);
    if (!existingProduct) {
      throw new ProductNotFoundException(input.id);
    }

    // Merge existing data with updates
    const updatedProduct = new ProductEntity(
      existingProduct.id,
      input.data.name ?? existingProduct.name,
      input.data.slug ?? existingProduct.slug,
      input.data.description ?? existingProduct.description,
      input.data.basePrice ?? existingProduct.basePrice,
      input.data.salePrice !== undefined
        ? input.data.salePrice
        : existingProduct.salePrice,
      input.data.categoryId ?? existingProduct.categoryId,
      existingProduct.stock, // Stock managed separately via variants
      existingProduct.images,
      input.data.isActive ?? existingProduct.isActive,
      input.data.isFeatured ?? existingProduct.isFeatured,
      existingProduct.createdAt,
      new Date() // updatedAt
    );

    // Validate price logic
    if (
      updatedProduct.salePrice !== null &&
      updatedProduct.salePrice >= updatedProduct.basePrice
    ) {
      throw new Error("Sale price must be less than base price");
    }

    // Persist the update
    const saved = await this.productRepository.update(updatedProduct);

    return {
      id: saved.id,
      name: saved.name,
      slug: saved.slug,
      description: saved.description,
      categoryId: saved.categoryId,
      basePrice: saved.basePrice,
      salePrice: saved.salePrice,
      isActive: saved.isActive,
      isFeatured: saved.isFeatured,
      updatedAt: saved.updatedAt,
    };
  }
}
