/**
 * InsufficientStockException
 *
 * Thrown when attempting to purchase more items than available in stock.
 */

export class InsufficientStockException extends Error {
  constructor(productId: string, requested: number, available: number) {
    super(
      `Insufficient stock for product ${productId}. Requested: ${requested}, Available: ${available}`
    );
    this.name = "InsufficientStockException";
  }
}
