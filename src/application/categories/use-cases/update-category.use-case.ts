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
import {
  isReservedCollectionSlug,
  reservedCollectionSlugMessage,
} from "@/domain/categories/reserved-slugs";

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

    // Direct self-parenting isn't the only way to create a cycle: with
    // A -> B -> C, setting A's parent to C is invalid too, and each edit
    // looks fine in isolation. Walk the new parent's ancestor chain and
    // reject if this category would appear in its own lineage.
    if (
      input.data.parentId !== undefined &&
      input.data.parentId !== null &&
      input.data.parentId !== existing.parentId
    ) {
      await this.assertNoCycle(input.id, input.data.parentId);
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
      // Renaming into a static route's slug hides the category as surely as
      // creating it there would, and is easier to do by accident.
      if (isReservedCollectionSlug(slug)) {
        throw new Error(reservedCollectionSlugMessage(slug));
      }

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

  /**
   * Reject a `parentId` that would make `categoryId` its own ancestor.
   *
   * `categories.parentId` has no FK constraint, so a walk here can meet data
   * that is already cyclic (a previous edit that slipped past this guard, or
   * a row written by hand). The `visited` set bounds the traversal at one
   * pass over the tree either way — the same technique `collectCategoryTree`
   * uses for descendants.
   */
  private async assertNoCycle(
    categoryId: string,
    newParentId: string
  ): Promise<void> {
    const all = await this.categoryRepository.findAll();
    const parentById = new Map(all.map((c) => [c.id, c.parentId]));

    const visited = new Set<string>();
    let currentId: string | null = newParentId;

    while (currentId) {
      if (currentId === categoryId) {
        throw new Error(
          "That would make this category a descendant of itself. Choose a " +
            "parent outside its current subtree."
        );
      }

      if (visited.has(currentId)) break;
      visited.add(currentId);

      currentId = parentById.get(currentId) ?? null;
    }
  }
}
