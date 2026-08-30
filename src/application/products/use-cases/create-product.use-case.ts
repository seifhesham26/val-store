import {
  ProductEntity,
  Gender,
} from "@/domain/products/entities/product.entity";
import {
  ProductRepositoryInterface,
  NewProductRelations,
} from "@/domain/products/interfaces/repositories/product.repository.interface";
import { DuplicateSKUException } from "@/domain/products/exceptions/duplicate-sku.exception";
import { InvalidPriceException } from "@/domain/products/exceptions/invalid-price.exception";

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
  gender?: Gender | null;
  material?: string | null;
  careInstructions?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  /**
   * Images and variants to store alongside the product, in one transaction.
   * Omitted entirely when the admin adds them later from the edit page.
   */
  images?: NewProductRelations["images"];
  variants?: NewProductRelations["variants"];
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
    this.validateVariantSkus(input.variants);

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
      input.sku,
      input.description,
      input.basePrice,
      input.salePrice || null,
      input.categoryId,
      0, // Initial stock
      [], // No images initially
      input.isActive ?? true,
      input.isFeatured ?? false,
      new Date(),
      new Date(),
      // Matches the `gender` column default so a new product is not created
      // outside every gendered collection.
      input.gender ?? "unisex",
      input.material ?? null,
      input.careInstructions ?? null,
      input.metaTitle ?? null,
      input.metaDescription ?? null
    );

    // 4. Save via repository — product, images and variants in one transaction
    const created = await this.productRepository.create(product, {
      images: input.images,
      variants: input.variants,
    });

    // 5. Return DTO
    return {
      id: created.id,
      name: created.name,
      slug: created.slug,
      message: "Product created successfully",
    };
  }

  /**
   * Reject duplicate SKUs within the submitted batch.
   *
   * The column constraint would catch this too, but only as a Postgres error
   * after the product row has been built — and the admin would see the raw
   * message rather than which variant is at fault.
   */
  private validateVariantSkus(
    variants?: NewProductRelations["variants"]
  ): void {
    if (!variants || variants.length === 0) return;

    const seen = new Set<string>();
    for (const variant of variants) {
      const sku = variant.sku.trim();
      if (seen.has(sku)) {
        throw new DuplicateSKUException(sku);
      }
      seen.add(sku);
    }
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
