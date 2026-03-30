/**
 * Category Repository Interface
 *
 * Defines the contract for Category data operations.
 * Implementation will be in the infrastructure layer.
 */

import { CategoryEntity } from "@/domain/categories/entities/category.entity";

export interface CategoryRepositoryInterface {
  /**
   * Find a category by ID
   */
  findById(categoryId: string): Promise<CategoryEntity | null>;

  /**
   * Find a category by slug
   */
  findBySlug(slug: string): Promise<CategoryEntity | null>;

  /**
   * Find all categories
   */
  findAll(): Promise<CategoryEntity[]>;

  /**
   * Find top-level categories (no parent)
   */
  findTopLevel(): Promise<CategoryEntity[]>;

  /**
   * Find subcategories by parent ID
   */
  findByParentId(parentId: string): Promise<CategoryEntity[]>;

  /**
   * Find active categories only
   */
  findActive(): Promise<CategoryEntity[]>;

  /**
   * Create a new category
   */
  create(category: CategoryEntity): Promise<CategoryEntity>;

  /**
   * Update an existing category
   */
  update(category: CategoryEntity): Promise<CategoryEntity>;

  /**
   * Delete a category
   */
  delete(categoryId: string): Promise<void>;

  /**
   * Check if a category slug exists
   */
  existsBySlug(slug: string): Promise<boolean>;

  /**
   * Get category hierarchy (category with all its children)
   */
  getHierarchy(categoryId: string): Promise<CategoryEntity[]>;

  /**
   * Get category count
   */
  count(): Promise<number>;
}
