/**
 * OrderNotFoundException
 *
 * Thrown when an order is not found in the repository.
 */

export class OrderNotFoundException extends Error {
  constructor(identifier: string) {
    super(`Order not found: ${identifier}`);
    this.name = "OrderNotFoundException";
  }
}
