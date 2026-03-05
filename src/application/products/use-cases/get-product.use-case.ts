import { ProductEntity } from "@/domain/entities/product.entity";
import { ProductRepositoryInterface } from "@/domain/interfaces/repositories/product.repository.interface";
import { ProductNotFoundException } from "@/domain/exceptions/product-not-found.exception";

/**
 * Get Product Use Case
 *
 * Retrieves a single product by ID or slug.
 */

export interface GetProductInput {
  id?: string;
  slug?: string;
}

export interface GetProductOutput {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  salePrice: number | null;
  currentPrice: number;
  categoryId: string | null;
  stock: number;
  images: string[];
  isActive: boolean;
  isFeatured: boolean;
  isAvailable: boolean;
  isOnSale: boolean;
  isLowStock: boolean;
  isOutOfStock: boolean;
  discountPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export class GetProductUseCase {
  constructor(private readonly productRepository: ProductRepositoryInterface) {}

  async execute(input: GetProductInput): Promise<GetProductOutput> {
    // 1. Validate input
    if (!input.id && !input.slug) {
      throw new Error("Either id or slug must be provided");
    }

    // 2. Fetch product
    let product: ProductEntity | null;

    if (input.id) {
      product = await this.productRepository.findById(input.id);
      if (!product) {
        throw new ProductNotFoundException(input.id);
      }
    } else {
      product = await this.productRepository.findBySlug(input.slug!);
      if (!product) {
        throw new ProductNotFoundException(input.slug!);
      }
    }

    // 3. Map to DTO
    return this.mapToDTO(product);
  }

  private mapToDTO(product: ProductEntity): GetProductOutput {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      basePrice: product.basePrice,
      salePrice: product.salePrice,
      currentPrice: product.getCurrentPrice(),
      categoryId: product.categoryId,
      stock: product.stock,
      images: product.images,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      isAvailable: product.isAvailable(),
      isOnSale: product.isOnSale(),
      isLowStock: product.isLowStock(),
      isOutOfStock: product.isOutOfStock(),
      discountPercentage: product.getDiscountPercentage(),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
