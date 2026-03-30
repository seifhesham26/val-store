import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { CategoryRepositoryInterface } from "@/domain/categories/interfaces/repositories/category.repository.interface";
import { CategoryEntity } from "@/domain/categories/entities/category.entity";
import { CategoryNotFoundException } from "@/domain/categories/exceptions/category-not-found.exception";

/**
 * Category Repository Implementation using Drizzle ORM
 */
export class DrizzleCategoryRepository implements CategoryRepositoryInterface {
  /**
   * Find category by ID
   */
  async findById(categoryId: string): Promise<CategoryEntity | null> {
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!category) {
      return null;
    }

    return this.mapToEntity(category);
  }

  /**
   * Find category by slug
   */
  async findBySlug(slug: string): Promise<CategoryEntity | null> {
    const category = await db.query.categories.findFirst({
      where: eq(categories.slug, slug),
    });

    if (!category) {
      return null;
    }

    return this.mapToEntity(category);
  }

  /**
   * Find all categories
   */
  async findAll(): Promise<CategoryEntity[]> {
    const categoriesList = await db.query.categories.findMany({
      orderBy: [desc(categories.displayOrder), desc(categories.name)],
    });

    return categoriesList.map((c) => this.mapToEntity(c));
  }

  /**
   * Find active categories only
   */
  async findActive(): Promise<CategoryEntity[]> {
    const categoriesList = await db.query.categories.findMany({
      where: eq(categories.isActive, true),
      orderBy: [desc(categories.displayOrder), desc(categories.name)],
    });

    return categoriesList.map((c) => this.mapToEntity(c));
  }

  /**
   * Create a new category
   */
  async create(category: CategoryEntity): Promise<CategoryEntity> {
    const [newCategory] = await db
      .insert(categories)
      .values({
        name: category.name,
        slug: category.slug,
        description: category.description,
        parentId: category.parentId,
        imageUrl: category.imageUrl,
        displayOrder: category.displayOrder,
        isActive: category.isActive,
      })
      .returning();

    return this.mapToEntity(newCategory);
  }

  /**
   * Update an existing category
   */
  async update(category: CategoryEntity): Promise<CategoryEntity> {
    const existing = await this.findById(category.id);
    if (!existing) {
      throw new CategoryNotFoundException(category.id);
    }

    const [updated] = await db
      .update(categories)
      .set({
        name: category.name,
        slug: category.slug,
        description: category.description,
        parentId: category.parentId,
        imageUrl: category.imageUrl,
        displayOrder: category.displayOrder,
        isActive: category.isActive,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, category.id))
      .returning();

    return this.mapToEntity(updated);
  }

  /**
   * Delete a category
   */
  async delete(categoryId: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, categoryId));
  }

  /**
   * Check if slug exists
   */
  async existsBySlug(slug: string): Promise<boolean> {
    const category = await db.query.categories.findFirst({
      where: eq(categories.slug, slug),
      columns: { id: true },
    });
    return !!category;
  }

  /**
   * Get category count
   */
  async count(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(categories);

    return result[0]?.count || 0;
  }

  /**
   * Find top-level categories
   */
  async findTopLevel(): Promise<CategoryEntity[]> {
    const categoriesList = await db.query.categories.findMany({
      where: sql`${categories.parentId} IS NULL`,
      orderBy: [desc(categories.displayOrder), desc(categories.name)],
    });

    return categoriesList.map((c) => this.mapToEntity(c));
  }

  /**
   * Find subcategories by parent ID
   */
  async findByParentId(parentId: string): Promise<CategoryEntity[]> {
    const categoriesList = await db.query.categories.findMany({
      where: eq(categories.parentId, parentId),
      orderBy: [desc(categories.displayOrder), desc(categories.name)],
    });

    return categoriesList.map((c) => this.mapToEntity(c));
  }

  /**
   * Get category hierarchy
   */
  async getHierarchy(categoryId: string): Promise<CategoryEntity[]> {
    // For now, just return the category and its immediate children
    // A full recursive implementation would be more complex
    const category = await this.findById(categoryId);
    if (!category) {
      return [];
    }

    const children = await this.findByParentId(categoryId);
    return [category, ...children];
  }

  /**
   * Map database result to CategoryEntity
   */
  private mapToEntity(dbCategory: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
    imageUrl: string | null;
    displayOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): CategoryEntity {
    return new CategoryEntity(
      dbCategory.id,
      dbCategory.name,
      dbCategory.slug,
      dbCategory.description,
      dbCategory.parentId,
      dbCategory.imageUrl,
      dbCategory.displayOrder,
      dbCategory.isActive,
      new Date(dbCategory.createdAt),
      new Date(dbCategory.updatedAt)
    );
  }
}
