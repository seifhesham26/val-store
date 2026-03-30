/**
 * Auth Router
 *
 * Public routes for authentication-related lookups.
 */

import { publicProcedure, router } from "../trpc";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PhoneValueObject } from "@/domain/customers/value-objects/phone.value-object";

export const authRouter = router({
  /**
   * Get email by phone number
   * Used for phone-based login - looks up the email associated with a phone
   */
  getEmailByPhone: publicProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ input }) => {
      // Convert phone to E.164 format
      const formattedPhone = PhoneValueObject.toE164(input.phone);
      if (!formattedPhone) {
        return { email: null };
      }

      // Look up user by phone
      const [foundUser] = await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.phone, formattedPhone))
        .limit(1);

      return { email: foundUser?.email ?? null };
    }),
});
