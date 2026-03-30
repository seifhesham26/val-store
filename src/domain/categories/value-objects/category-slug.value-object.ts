/**
 * CategorySlug Value Object
 *
 * Generates and validates URL-friendly category slugs.
 */

export class CategorySlug {
  private constructor(private readonly value: string) {}

  /**
   * Create from category name
   */
  static fromName(name: string): CategorySlug {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!slug) {
      throw new Error("Cannot create slug from empty string");
    }

    return new CategorySlug(slug);
  }

  /**
   * Create from existing slug (with validation)
   */
  static create(slug: string): CategorySlug {
    const normalized = slug.toLowerCase().trim();

    if (!CategorySlug.isValid(normalized)) {
      throw new Error(
        `Invalid category slug: ${slug}. Must contain only lowercase letters, numbers, and hyphens.`
      );
    }

    return new CategorySlug(normalized);
  }

  /**
   * Get slug value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check equality
   */
  equals(other: CategorySlug): boolean {
    return this.value === other.value;
  }

  /**
   * Validate slug format
   */
  private static isValid(slug: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  }

  /**
   * Convert to string
   */
  toString(): string {
    return this.value;
  }
}
