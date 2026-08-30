import { CategoryRepositoryInterface } from "@/domain/categories/interfaces/repositories/category.repository.interface";
import { CategoryNotFoundException } from "@/domain/categories/exceptions/category-not-found.exception";

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

    // Category deletion is a hard delete and `categories.parent_id` carries no
    // foreign key, so deleting a parent used to leave its children pointing at a
    // row that no longer exists. Refuse instead, and say what is in the way.
    const children = await this.categoryRepository.findByParentId(input.id);
    if (children.length > 0) {
      throw new Error(
        `"${category.name}" has ${children.length} subcategor${
          children.length === 1 ? "y" : "ies"
        }. Move or delete ${children.length === 1 ? "it" : "them"} first.`
      );
    }

    // Products would survive with `category_id` set to null — technically valid,
    // but it silently drops them out of every category listing.
    const productCount = await this.categoryRepository.countProducts(input.id);
    if (productCount > 0) {
      throw new Error(
        `"${category.name}" still has ${productCount} product${
          productCount === 1 ? "" : "s"
        }. Reassign ${productCount === 1 ? "it" : "them"} to another category first.`
      );
    }

    // Delete from repository
    await this.categoryRepository.delete(input.id);

    return {
      message: "Category deleted successfully",
    };
  }
}
