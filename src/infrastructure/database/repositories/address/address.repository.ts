/**
 * Drizzle Address Repository
 */

import { db } from "@/db";
import { addresses } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { AddressRepositoryInterface } from "@/domain/address/interfaces/repositories/address.repository.interface";
import { Address, NewAddress } from "@/db/schema";

export class DrizzleAddressRepository implements AddressRepositoryInterface {
  async findByUserId(userId: string): Promise<Address[]> {
    return db.query.addresses.findMany({
      where: eq(addresses.userId, userId),
      orderBy: [desc(addresses.isDefault), desc(addresses.createdAt)],
    });
  }

  async findById(id: string): Promise<Address | undefined> {
    return db.query.addresses.findFirst({
      where: eq(addresses.id, id),
    });
  }

  async create(address: NewAddress): Promise<Address> {
    const [created] = await db.insert(addresses).values(address).returning();
    return created;
  }

  async update(id: string, data: Partial<NewAddress>): Promise<Address> {
    const [updated] = await db
      .update(addresses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(addresses.id, id))
      .returning();
    return updated;
  }

  async delete(id: string): Promise<void> {
    await db.delete(addresses).where(eq(addresses.id, id));
  }

  async setDefault(userId: string, addressId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Unset all defaults for user
      await tx
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, userId));

      // 2. Set new default
      await tx
        .update(addresses)
        .set({ isDefault: true })
        .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)));
    });
  }
}
