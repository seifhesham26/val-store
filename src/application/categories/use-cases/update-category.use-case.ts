/**
 * Update Category Use Case
 *
 * Updates an existing category with partial data.
 * Validates category exists before updating.
 */

import { CategoryRepositoryInterface } from "@/domain/interfaces/repositories/category.repository.interface";
import { CategoryEntity } from "@/domain/entities/category.entity";
import { CategoryNotFoundException } from "@/domain/exceptions/category-not-found.exception";

export interface UpdateCategoryInput {
  id: string;
  data: {
    name?: string;
    slug?: string;
    description?: string | null;
    parentId?: string | null;
    imageUrl?: string | null;
    displayOrder?: number;
    isActive?: boolean;
  };
}

export interface UpdateCategoryOutput {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  updatedAt: Date;
}

export class UpdateCategoryUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepositoryInterface
  ) {}

  async execute(input: UpdateCategoryInput): Promise<UpdateCategoryOutput> {
    // Find existing category
    const existing = await this.categoryRepository.findById(input.id);
    if (!existing) {
      throw new CategoryNotFoundException(input.id);
    }

    // Prevent circular parent reference
    if (input.data.parentId === input.id) {
      throw new Error("Category cannot be its own parent");
    }

    // Generate slug from name if name changed but slug not provided
    const slug =
      input.data.slug ??
      (input.data.name
        ? input.data.name.toLowerCase().replace(/\s+/g, "-")
        : existing.slug);

    // Merge existing data with updates
    const updatedCategory = new CategoryEntity(
      existing.id,
      input.data.name ?? existing.name,
      slug,
      input.data.description !== undefined
        ? input.data.description
        : existing.description,
      input.data.parentId !== undefined
        ? input.data.parentId
        : existing.parentId,
      input.data.imageUrl !== undefined
        ? input.data.imageUrl
        : existing.imageUrl,
      input.data.displayOrder ?? existing.displayOrder,
      input.data.isActive ?? existing.isActive,
      existing.createdAt,
      new Date()
    );

    // Persist the update
    const saved = await this.categoryRepository.update(updatedCategory);

    return {
      id: saved.id,
      name: saved.name,
      slug: saved.slug,
      description: saved.description,
      parentId: saved.parentId,
      imageUrl: saved.imageUrl,
      displayOrder: saved.displayOrder,
      isActive: saved.isActive,
      updatedAt: saved.updatedAt,
    };
  }
}
