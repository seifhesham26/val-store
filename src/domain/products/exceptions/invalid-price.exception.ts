/**
 * InvalidPriceException
 *
 * Thrown when a product price is invalid (negative, zero when required, etc.)
 */

export class InvalidPriceException extends Error {
  constructor(message: string) {
    super(`Invalid price: ${message}`);
    this.name = "InvalidPriceException";
  }
}
