/**
 * Update Category Use Case
 *
 * Updates an existing category with partial data.
 * Validates category exists before updating.
 */

import { CategoryRepositoryInterface } from "@/domain/categories/interfaces/repositories/category.repository.interface";
import { CategoryEntity } from "@/domain/categories/entities/category.entity";
import { CategoryNotFoundException } from "@/domain/categories/exceptions/category-not-found.exception";
import { CategorySlug } from "@/domain/categories/value-objects/category-slug.value-object";

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

    // Slugs go through the value object in both directions. The old inline
    // `replace(/\s+/g, "-")` left punctuation intact, so "Men's Tees" produced
    // "men's-tees" here and "mens-tees" at creation — two spellings of one name.
    const slug = input.data.slug
      ? CategorySlug.create(input.data.slug).getValue()
      : input.data.name
        ? CategorySlug.fromName(input.data.name).getValue()
        : existing.slug;

    // Slugs are unique and address a public URL, so a collision has to be caught
    // before the constraint does.
    if (slug !== existing.slug) {
      const taken = await this.categoryRepository.findBySlug(slug);
      if (taken) {
        throw new Error(`Category with slug "${slug}" already exists`);
      }
    }

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
