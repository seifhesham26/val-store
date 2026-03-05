import { ProductEntity } from "@/domain/entities/product.entity";
import { ProductRepositoryInterface } from "@/domain/interfaces/repositories/product.repository.interface";
import { DuplicateSKUException } from "@/domain/exceptions/duplicate-sku.exception";
import { InvalidPriceException } from "@/domain/exceptions/invalid-price.exception";

/**
 * Create Product Use Case
 *
 * Handles the business logic for creating a new product.
 */

export interface CreateProductInput {
  name: string;
  slug: string;
  sku: string;
  description: string;
  categoryId: string;
  basePrice: number;
  salePrice?: number;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface CreateProductOutput {
  id: string;
  name: string;
  slug: string;
  message: string;
}

export class CreateProductUseCase {
  constructor(private readonly productRepository: ProductRepositoryInterface) {}

  async execute(input: CreateProductInput): Promise<CreateProductOutput> {
    // 1. Validate business rules
    this.validatePrices(input.basePrice, input.salePrice);

    // 2. Check if SKU already exists
    const skuExists = await this.productRepository.existsBySKU(input.sku);
    if (skuExists) {
      throw new DuplicateSKUException(input.sku);
    }

    // 3. Create product entity
    const product = new ProductEntity(
      crypto.randomUUID(), // Generate ID
      input.name,
      input.slug,
      input.description,
      input.basePrice,
      input.salePrice || null,
      input.categoryId,
      0, // Initial stock
      [], // No images initially
      input.isActive ?? true,
      input.isFeatured ?? false,
      new Date(),
      new Date()
    );

    // 4. Save via repository
    const created = await this.productRepository.create(product);

    // 5. Return DTO
    return {
      id: created.id,
      name: created.name,
      slug: created.slug,
      message: "Product created successfully",
    };
  }

  private validatePrices(basePrice: number, salePrice?: number): void {
    if (basePrice <= 0) {
      throw new InvalidPriceException("Base price must be greater than 0");
    }

    if (salePrice !== undefined && salePrice !== null) {
      if (salePrice < 0) {
        throw new InvalidPriceException("Sale price cannot be negative");
      }

      if (salePrice >= basePrice) {
        throw new InvalidPriceException(
          "Sale price must be less than base price"
        );
      }
    }
  }
}
