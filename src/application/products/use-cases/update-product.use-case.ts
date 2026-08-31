/**
 * Update Product Use Case
 *
 * Updates an existing product with partial data.
 * Validates product exists and handles partial updates.
 */

import { ProductRepositoryInterface } from "@/domain/products/interfaces/repositories/product.repository.interface";
import {
  ProductEntity,
  Gender,
} from "@/domain/products/entities/product.entity";
import { ProductNotFoundException } from "@/domain/products/exceptions/product-not-found.exception";
import { DuplicateSKUException } from "@/domain/products/exceptions/duplicate-sku.exception";

export interface UpdateProductInput {
  id: string;
  data: {
    name?: string;
    slug?: string;
    sku?: string;
    description?: string;
    categoryId?: string;
    basePrice?: number;
    salePrice?: number | null;
    isActive?: boolean;
    isFeatured?: boolean;
    gender?: Gender | null;
    material?: string | null;
    careInstructions?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
  };
}

export interface UpdateProductOutput {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  categoryId: string | null;
  basePrice: number;
  salePrice: number | null;
  isActive: boolean;
  isFeatured: boolean;
  gender: Gender | null;
  material: string | null;
  careInstructions: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
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

    // The SKU column is unique, so a collision would otherwise surface as a raw
    // Postgres error. Checked only when the value actually changes — re-saving a
    // product without touching its SKU must not collide with itself.
    if (input.data.sku && input.data.sku !== existingProduct.sku) {
      const skuTaken = await this.productRepository.existsBySKU(input.data.sku);
      if (skuTaken) {
        throw new DuplicateSKUException(input.data.sku);
      }
    }

    // Merge existing data with updates
    const updatedProduct = new ProductEntity(
      existingProduct.id,
      input.data.name ?? existingProduct.name,
      input.data.slug ?? existingProduct.slug,
      input.data.sku ?? existingProduct.sku,
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
      new Date(), // updatedAt
      // Detail fields: `!== undefined` (not `??`) so an explicit null clears the
      // value, while an omitted key preserves what is already stored.
      input.data.gender !== undefined
        ? input.data.gender
        : existingProduct.gender,
      input.data.material !== undefined
        ? input.data.material
        : existingProduct.material,
      input.data.careInstructions !== undefined
        ? input.data.careInstructions
        : existingProduct.careInstructions,
      input.data.metaTitle !== undefined
        ? input.data.metaTitle
        : existingProduct.metaTitle,
      input.data.metaDescription !== undefined
        ? input.data.metaDescription
        : existingProduct.metaDescription
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
      sku: saved.sku,
      description: saved.description,
      categoryId: saved.categoryId,
      basePrice: saved.basePrice,
      salePrice: saved.salePrice,
      isActive: saved.isActive,
      isFeatured: saved.isFeatured,
      gender: saved.gender,
      material: saved.material,
      careInstructions: saved.careInstructions,
      metaTitle: saved.metaTitle,
      metaDescription: saved.metaDescription,
      updatedAt: saved.updatedAt,
    };
  }
}
