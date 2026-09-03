/**
 * Drizzle User Lookup Repository
 *
 * Read-only repository for querying Better Auth's user table.
 * Used by the auth router for phone-based email lookup.
 */

import { db } from "@/db";
import { user } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { UserLookupRepositoryInterface } from "@/domain/customers/interfaces/repositories/user-lookup.repository.interface";

export class DrizzleUserLookupRepository implements UserLookupRepositoryInterface {
  async findAccountsByPhone(
    phone: string,
    limit: number
  ): Promise<{ email: string }[]> {
    return (
      db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.phone, phone))
        // Ordered, where the previous `limit(1)` was not. Without an ORDER BY,
        // Postgres may return either matching row and may return a different one
        // next time — so which account a phone number signed into was arbitrary
        // and unstable. Oldest first is stable and is the account a customer
        // most likely thinks of as theirs.
        .orderBy(asc(user.createdAt), asc(user.id))
        .limit(limit)
    );
  }
}
