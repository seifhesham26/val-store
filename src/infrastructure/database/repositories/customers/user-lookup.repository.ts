/**
 * Drizzle User Lookup Repository
 *
 * Read-only repository for querying Better Auth's user table.
 * Used by the auth router for phone-based email lookup.
 */

import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { UserLookupRepositoryInterface } from "@/domain/customers/interfaces/repositories/user-lookup.repository.interface";

export class DrizzleUserLookupRepository implements UserLookupRepositoryInterface {
  async findEmailByPhone(phone: string): Promise<string | null> {
    const [foundUser] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.phone, phone))
      .limit(1);

    return foundUser?.email ?? null;
  }
}
