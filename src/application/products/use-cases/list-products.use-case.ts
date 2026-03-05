import { ProductEntity } from "@/domain/entities/product.entity";
import { ProductRepositoryInterface } from "@/domain/interfaces/repositories/product.repository.interface";

/**
 * List Products Use Case
 *
 * Retrieves a list of products with optional filtering.
 */

export interface ListProductsInput {
  isActive?: boolean;
  isFeatured?: boolean;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  salePrice: number | null;
  currentPrice: number;
  stock: number;
  isActive: boolean;
  isFeatured: boolean;
  isOnSale: boolean;
  discountPercentage: number;
  primaryImage: string | null;
}

export interface ListProductsOutput {
  products: ProductListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListProductsUseCase {
  constructor(private readonly productRepository: ProductRepositoryInterface) {}

  async execute(input: ListProductsInput = {}): Promise<ListProductsOutput> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 10;
    const offset = (page - 1) * limit;

    // 1. Fetch products from repository (filter only, no pagination in repo yet)
    const allProducts = await this.productRepository.findAll({
      isActive: input.isActive,
      isFeatured: input.isFeatured,
      categoryId: input.categoryId,
    });

    // 2. Get total count
    const total = allProducts.length;
    const totalPages = Math.ceil(total / limit);

    // 3. Apply pagination (slice for now - could be DB-level later)
    const paginatedProducts = allProducts.slice(offset, offset + limit);

    // 4. Map to DTOs
    const productDTOs = paginatedProducts.map((product) =>
      this.mapToDTO(product)
    );

    return {
      products: productDTOs,
      total,
      page,
      limit,
      totalPages,
    };
  }

  private mapToDTO(product: ProductEntity): ProductListItem {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      basePrice: product.basePrice,
      salePrice: product.salePrice,
      currentPrice: product.getCurrentPrice(),
      stock: product.stock,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      isOnSale: product.isOnSale(),
      discountPercentage: product.getDiscountPercentage(),
      primaryImage: product.getPrimaryImage(),
    };
  }
}
