export class CustomerAccessDeniedError extends Error {
  constructor(message = "Customer-data access is not allowed") {
    super(message);
    this.name = "CustomerAccessDeniedError";
  }
}
