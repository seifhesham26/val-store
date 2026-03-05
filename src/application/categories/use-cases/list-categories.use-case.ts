import { CategoryEntity } from "@/domain/entities/category.entity";
import { CategoryRepositoryInterface } from "@/domain/interfaces/repositories/category.repository.interface";

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
  isActive: boolean;
  isTopLevel: boolean;
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

    // Map to DTOs
    const categoryDTOs = categories.map((category) => this.mapToDTO(category));

    return {
      categories: categoryDTOs,
      total,
    };
  }

  private mapToDTO(category: CategoryEntity): CategoryListItem {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      imageUrl: category.imageUrl,
      isActive: category.isActive,
      isTopLevel: category.isTopLevel(),
    };
  }
}
