/**
 * DuplicateSKUException
 *
 * Thrown when attempting to create a product with a SKU that already exists.
 */

export class DuplicateSKUException extends Error {
  constructor(sku: string) {
    super(`Product with SKU "${sku}" already exists`);
    this.name = "DuplicateSKUException";
  }
}
