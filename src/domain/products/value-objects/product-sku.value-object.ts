/**
 * ProductSKU Value Object
 *
 * Represents a Stock Keeping Unit (SKU) for products.
 * Ensures SKUs follow a consistent format and are unique.
 */

export class ProductSKU {
  private readonly value: string;

  private constructor(sku: string) {
    this.value = sku.toUpperCase().trim();
  }

  /**
   * Create ProductSKU from string
   * @param sku - SKU string to validate
   * @throws Error if SKU is invalid
   */
  static create(sku: string): ProductSKU {
    const trimmed = sku.trim();

    if (!trimmed) {
      throw new Error("SKU cannot be empty");
    }

    if (!this.isValid(trimmed)) {
      throw new Error(
        "Invalid SKU format. Must be 3-50 alphanumeric characters and hyphens"
      );
    }

    return new ProductSKU(trimmed);
  }

  /**
   * Generate a SKU from product name and variant
   * Example: "Blue T-Shirt Large" -> "BLU-TSHIRT-LRG"
   */
  static generate(productName: string, variant?: string): ProductSKU {
    let sku = productName
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "") // Remove special chars
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .substring(0, 20); // Limit length

    if (variant) {
      const variantPart = variant
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 10);
      sku = `${sku}-${variantPart}`;
    }

    // Add timestamp suffix for uniqueness
    const timestamp = Date.now().toString().slice(-6);
    sku = `${sku}-${timestamp}`;

    return new ProductSKU(sku);
  }

  /**
   * Get SKU value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check equality with another SKU
   */
  equals(other: ProductSKU): boolean {
    return this.value === other.value;
  }

  /**
   * Validate SKU format
   */
  private static isValid(sku: string): boolean {
    // Must be 3-50 characters, alphanumeric and hyphens only
    const skuRegex = /^[A-Z0-9-]{3,50}$/i;

    if (!skuRegex.test(sku)) {
      return false;
    }

    // Should not start or end with hyphen
    if (sku.startsWith("-") || sku.endsWith("-")) {
      return false;
    }

    // Should not have consecutive hyphens
    if (sku.includes("--")) {
      return false;
    }

    return true;
  }

  /**
   * Convert to string for serialization
   */
  toString(): string {
    return this.value;
  }
}
