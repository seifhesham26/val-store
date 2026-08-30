import { CategoryEntity } from "@/domain/categories/entities/category.entity";
import { CategoryRepositoryInterface } from "@/domain/categories/interfaces/repositories/category.repository.interface";

/**
 * List Categories Use Case
 */

export interface ListCategoriesInput {
  activeOnly?: boolean;
}

export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  isTopLevel: boolean;
  /** Products in this category. Drives the delete guard's warning. */
  productCount: number;
  /** Direct children. A category with children cannot be deleted. */
  childCount: number;
}

export interface ListCategoriesOutput {
  categories: CategoryListItem[];
  total: number;
}

export class ListCategoriesUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepositoryInterface
  ) {}

  async execute(
    input: ListCategoriesInput = {}
  ): Promise<ListCategoriesOutput> {
    // Fetch categories
    const categories = input.activeOnly
      ? await this.categoryRepository.findActive()
      : await this.categoryRepository.findAll();

    // Get total count
    const total = await this.categoryRepository.count();

    // Two aggregates, both computed once for the whole list rather than per row.
    const productCounts =
      await this.categoryRepository.countProductsByCategory();
    const childCounts = new Map<string, number>();
    for (const category of categories) {
      if (category.parentId) {
        childCounts.set(
          category.parentId,
          (childCounts.get(category.parentId) ?? 0) + 1
        );
      }
    }

    // Map to DTOs
    const categoryDTOs = categories
      .map((category) =>
        this.mapToDTO(
          category,
          productCounts.get(category.id) ?? 0,
          childCounts.get(category.id) ?? 0
        )
      )
      .sort(
        (a, b) =>
          a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)
      );

    return {
      categories: categoryDTOs,
      total,
    };
  }

  private mapToDTO(
    category: CategoryEntity,
    productCount: number,
    childCount: number
  ): CategoryListItem {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      imageUrl: category.imageUrl,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      isTopLevel: category.isTopLevel(),
      productCount,
      childCount,
    };
  }
}
