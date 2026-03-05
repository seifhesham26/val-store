import { CategoryRepositoryInterface } from "@/domain/interfaces/repositories/category.repository.interface";
import { CategoryNotFoundException } from "@/domain/exceptions/category-not-found.exception";

/**
 * Delete Category Use Case
 */

export interface DeleteCategoryInput {
  id: string;
}

export interface DeleteCategoryOutput {
  message: string;
}

export class DeleteCategoryUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepositoryInterface
  ) {}

  async execute(input: DeleteCategoryInput): Promise<DeleteCategoryOutput> {
    // Check if category exists
    const category = await this.categoryRepository.findById(input.id);
    if (!category) {
      throw new CategoryNotFoundException(input.id);
    }

    // Delete from repository
    await this.categoryRepository.delete(input.id);

    return {
      message: "Category deleted successfully",
    };
  }
}
