import { ProductEntity } from "@/domain/products/entities/product.entity";
import { ProductRepositoryInterface } from "@/domain/products/interfaces/repositories/product.repository.interface";
import { pageWindow, pageCount } from "@/domain/shared/pagination";

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
  sku: string;
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
    const { limit, offset } = pageWindow(page, input.limit ?? 10);

    const filters = {
      isActive: input.isActive,
      isFeatured: input.isFeatured,
      categoryId: input.categoryId,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
    };

    // One bounded page and one count, in parallel. This used to load every
    // matching product — each with its variants and images joined — and throw
    // all but `limit` of them away, so an admin opening page 1 of the catalogue
    // paid for the whole catalogue.
    const [pageProducts, total] = await Promise.all([
      this.productRepository.findAll({ ...filters, limit, offset }),
      this.productRepository.count(filters),
    ]);

    const totalPages = pageCount(total, limit);

    const productDTOs = pageProducts.map((product) => this.mapToDTO(product));

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
      sku: product.sku,
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
