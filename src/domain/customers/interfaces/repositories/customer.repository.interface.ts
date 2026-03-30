/**
 * Customer Repository Interface
 *
 * Defines data access methods for Customer entity.
 */

import { Customer } from "@/domain/customers/entities/customer.entity";

export interface CustomerRepositoryInterface {
  /**
   * Find customer by ID
   */
  findById(id: string): Promise<Customer | null>;

  /**
   * Find customer by phone number
   */
  findByPhone(phone: string): Promise<Customer | null>;

  /**
   * Get or create customer by phone
   * Returns existing customer if phone exists, otherwise creates new one
   */
  getOrCreate(phone: string, preferredName?: string): Promise<Customer>;

  /**
   * Create new customer
   */
  create(customer: Customer): Promise<Customer>;

  /**
   * Update existing customer
   */
  update(customer: Customer): Promise<Customer>;

  /**
   * List all customers with pagination
   */
  findAll(options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{ customers: Customer[]; total: number }>;

  /**
   * Get customers by verification status
   */
  findByVerificationStatus(verified: boolean): Promise<Customer[]>;
}
