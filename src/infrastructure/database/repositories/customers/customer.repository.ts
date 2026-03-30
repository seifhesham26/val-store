/**
 * Drizzle Customer Repository
 *
 * PostgreSQL implementation of CustomerRepositoryInterface.
 */

import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, ilike, or, count } from "drizzle-orm";
import { Customer } from "@/domain/customers/entities/customer.entity";
import { CustomerRepositoryInterface } from "@/domain/customers/interfaces/repositories/customer.repository.interface";

export class DrizzleCustomerRepository implements CustomerRepositoryInterface {
  async findById(id: string): Promise<Customer | null> {
    const [result] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    if (!result) return null;

    return this.toDomain(result);
  }

  async findByPhone(phone: string): Promise<Customer | null> {
    // Normalize phone number (remove spaces, dashes)
    const normalizedPhone = phone.replace(/[\s-]/g, "");

    const [result] = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, normalizedPhone))
      .limit(1);

    if (!result) return null;

    return this.toDomain(result);
  }

  async getOrCreate(phone: string, preferredName?: string): Promise<Customer> {
    // Normalize phone
    const normalizedPhone = phone.replace(/[\s-]/g, "");

    // Try to find existing customer
    const existing = await this.findByPhone(normalizedPhone);
    if (existing) {
      return existing;
    }

    // Create new customer
    const newCustomer = Customer.createNew(normalizedPhone, preferredName);
    return this.create(newCustomer);
  }

  async create(customer: Customer): Promise<Customer> {
    const props = customer.toProps();

    const [result] = await db
      .insert(customers)
      .values({
        id: props.id,
        phone: props.phone,
        preferredName: props.preferredName,
        isPhoneVerified: props.isPhoneVerified,
        totalOrders: props.totalOrders,
        totalSpent: props.totalSpent.toString(),
        loyaltyPoints: props.loyaltyPoints,
        notes: props.notes,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      })
      .returning();

    return this.toDomain(result);
  }

  async update(customer: Customer): Promise<Customer> {
    const props = customer.toProps();

    const [result] = await db
      .update(customers)
      .set({
        preferredName: props.preferredName,
        isPhoneVerified: props.isPhoneVerified,
        totalOrders: props.totalOrders,
        totalSpent: props.totalSpent.toString(),
        loyaltyPoints: props.loyaltyPoints,
        notes: props.notes,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, props.id))
      .returning();

    return this.toDomain(result);
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{ customers: Customer[]; total: number }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const search = options?.search;

    let query = db.select().from(customers);

    if (search) {
      query = query.where(
        or(
          ilike(customers.phone, `%${search}%`),
          ilike(customers.preferredName, `%${search}%`)
        )
      ) as typeof query;
    }

    const results = await query
      .orderBy(customers.createdAt)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db.select({ count: count() }).from(customers);

    return {
      customers: results.map((r) => this.toDomain(r)),
      total: countResult?.count ?? 0,
    };
  }

  async findByVerificationStatus(verified: boolean): Promise<Customer[]> {
    const results = await db
      .select()
      .from(customers)
      .where(eq(customers.isPhoneVerified, verified));

    return results.map((r) => this.toDomain(r));
  }

  // Map database row to domain entity
  private toDomain(row: typeof customers.$inferSelect): Customer {
    return Customer.create({
      id: row.id,
      phone: row.phone,
      preferredName: row.preferredName,
      isPhoneVerified: row.isPhoneVerified,
      totalOrders: row.totalOrders,
      totalSpent: parseFloat(row.totalSpent),
      loyaltyPoints: row.loyaltyPoints,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
