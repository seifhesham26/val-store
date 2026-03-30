/**
 * Get or Create Customer Use Case
 *
 * Finds existing customer by phone or creates a new one.
 * This is the main entry point for linking users to customers.
 */

import { Customer } from "@/domain/customers/entities/customer.entity";
import { CustomerRepositoryInterface } from "@/domain/customers/interfaces/repositories/customer.repository.interface";

export interface GetOrCreateCustomerInput {
  phone: string;
  preferredName?: string;
}

export class GetOrCreateCustomerUseCase {
  constructor(
    private readonly customerRepository: CustomerRepositoryInterface
  ) {}

  async execute(input: GetOrCreateCustomerInput): Promise<Customer> {
    return this.customerRepository.getOrCreate(
      input.phone,
      input.preferredName
    );
  }
}
