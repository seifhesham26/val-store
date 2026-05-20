/**
 * Auth Router
 *
 * Public routes for authentication-related lookups.
 * Rate-limited to prevent phone number enumeration.
 */

import { publicProcedure, router } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { container } from "@/application/container";
import { PhoneValueObject } from "@/domain/customers/value-objects/phone.value-object";
import {
  authRateLimiter,
  checkRateLimit,
  getClientIp,
} from "../utils/rate-limiter";
import { headers } from "next/headers";

export const authRouter = router({
  /**
   * Get email by phone number
   * Used for phone-based login - looks up the email associated with a phone
   */
  getEmailByPhone: publicProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ input }) => {
      // Rate limit by IP to prevent phone enumeration
      const reqHeaders = await headers();
      const ip = getClientIp(reqHeaders);
      const { allowed } = await checkRateLimit(authRateLimiter, `phone:${ip}`);
      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please try again later.",
        });
      }

      // Convert phone to E.164 format
      const formattedPhone = PhoneValueObject.toE164(input.phone);
      if (!formattedPhone) {
        return { email: null };
      }

      // Look up user by phone via repository
      const userLookupRepo = container.getUserLookupRepository();
      const email = await userLookupRepo.findEmailByPhone(formattedPhone);

      return { email };
    }),
});
