import { CategoryEntity } from "@/domain/categories/entities/category.entity";
import { CategoryRepositoryInterface } from "@/domain/categories/interfaces/repositories/category.repository.interface";
import { CategorySlug } from "@/domain/categories/value-objects/category-slug.value-object";
import {
  isReservedCollectionSlug,
  reservedCollectionSlugMessage,
} from "@/domain/categories/reserved-slugs";

/**
 * Create Category Use Case
 */

export interface CreateCategoryInput {
  name: string;
  /** Omit to derive it from the name. Sent only when an admin typed one. */
  slug?: string;
  description?: string;
  parentId?: string;
  imageUrl?: string;
  displayOrder?: number;
}

export interface CreateCategoryOutput {
  id: string;
  name: string;
  slug: string;
  message: string;
}

export class CreateCategoryUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepositoryInterface
  ) {}

  async execute(input: CreateCategoryInput): Promise<CreateCategoryOutput> {
    // An admin-typed slug is validated rather than regenerated — the whole
    // point of typing one is that it is not what the name would produce.
    const slug = input.slug
      ? CategorySlug.create(input.slug)
      : CategorySlug.fromName(input.name);

    // A static `/collections/<slug>` route would shadow this category
    // entirely — it would exist, accept products, and never be reachable.
    if (isReservedCollectionSlug(slug.getValue())) {
      throw new Error(reservedCollectionSlugMessage(slug.getValue()));
    }

    // Check if slug already exists
    const existingCategory = await this.categoryRepository.findBySlug(
      slug.getValue()
    );
    if (existingCategory) {
      throw new Error(`Category with slug "${slug.getValue()}" already exists`);
    }

    // Create category entity
    const category = new CategoryEntity(
      crypto.randomUUID(),
      input.name,
      slug.getValue(),
      input.description || null,
      input.parentId || null,
      input.imageUrl || null,
      input.displayOrder || 0,
      true, // Active by default
      new Date(),
      new Date()
    );

    // Save to repository
    const created = await this.categoryRepository.create(category);

    return {
      id: created.id,
      name: created.name,
      slug: created.slug,
      message: "Category created successfully",
    };
  }
}
