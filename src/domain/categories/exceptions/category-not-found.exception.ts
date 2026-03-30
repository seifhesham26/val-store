/**
 * CategoryNotFoundException
 *
 * Thrown when a category is not found in the repository.
 */

export class CategoryNotFoundException extends Error {
  constructor(identifier: string) {
    super(`Category not found: ${identifier}`);
    this.name = "CategoryNotFoundException";
  }
}
