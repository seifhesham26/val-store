import { db } from "@/db";
import { customers, user } from "@/db/schema";
import { and, eq } from "drizzle-orm";

import type { VerifiedAccountPhoneSource } from "@/application/refunds/use-cases/request-return-otp.use-case";

/**
 * An OTP destination is read from the authenticated account and accepted only
 * when the matching customer identity is phone-verified. It deliberately has
 * no write method and never accepts a phone supplied by a caller.
 */
export class DrizzleVerifiedAccountPhoneRepository implements VerifiedAccountPhoneSource {
  async findVerifiedPhone(userId: string): Promise<string | null> {
    const [row] = await db
      .select({ phone: user.phone })
      .from(user)
      .innerJoin(
        customers,
        and(
          eq(customers.phone, user.phone),
          eq(customers.isPhoneVerified, true)
        )
      )
      .where(eq(user.id, userId))
      .limit(1);

    return row?.phone ?? null;
  }
}
