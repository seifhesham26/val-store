/**
 * Category Entity
 *
 * Represents a product category with support for hierarchical structure.
 * Can have parent categories for nested categorization.
 */

export class CategoryEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly description: string | null,
    public readonly parentId: string | null,
    public readonly imageUrl: string | null,
    public readonly displayOrder: number,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  /**
   * Check if this is a top-level category (no parent)
   */
  isTopLevel(): boolean {
    return this.parentId === null;
  }

  /**
   * Check if this is a subcategory
   */
  isSubcategory(): boolean {
    return !this.isTopLevel();
  }

  /**
   * Check if category is visible to customers
   */
  isVisible(): boolean {
    return this.isActive;
  }
}
