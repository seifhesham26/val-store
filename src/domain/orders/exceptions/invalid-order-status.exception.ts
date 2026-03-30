/**
 * InvalidOrderStatusException
 *
 * Thrown when attempting an invalid order status transition.
 */

export class InvalidOrderStatusException extends Error {
  constructor(currentStatus: string, attemptedStatus: string) {
    super(
      `Invalid status transition from "${currentStatus}" to "${attemptedStatus}"`
    );
    this.name = "InvalidOrderStatusException";
  }
}
