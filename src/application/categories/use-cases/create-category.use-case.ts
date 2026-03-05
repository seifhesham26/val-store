import { CategoryEntity } from "@/domain/entities/category.entity";
import { CategoryRepositoryInterface } from "@/domain/interfaces/repositories/category.repository.interface";
import { CategorySlug } from "@/domain/value-objects/category-slug.value-object";

/**
 * Create Category Use Case
 */

export interface CreateCategoryInput {
  name: string;
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
    // Generate slug from name
    const slug = CategorySlug.fromName(input.name);

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
