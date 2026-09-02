import { z } from "zod";
import { publicProcedure, router } from "../../trpc";
import { newsletterSubscribers } from "@/db/schema";
import { db } from "@/db";
import { headers } from "next/headers";
import { TRPCError } from "@trpc/server";
import {
  apiRateLimiter,
  enforceRateLimit,
  getClientIp,
} from "@/server/utils/rate-limiter";

export const newsletterRouter = router({
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email("Please enter a valid email address"),
      })
    )
    .mutation(async ({ input }) => {
      // An unauthenticated insert into a table anyone can reach, previously
      // with no throttle at all. `apiRateLimiter` was defined for exactly this
      // and had no consumer anywhere in the codebase.
      //
      // No-ops silently when UPSTASH_* is absent, so local development is
      // unaffected.
      const ip = getClientIp(await headers());
      await enforceRateLimit(apiRateLimiter, `newsletter:${ip}`);

      try {
        await db
          .insert(newsletterSubscribers)
          .values({
            email: input.email,
            isActive: true,
          })
          .onConflictDoNothing({ target: newsletterSubscribers.email });

        return { success: true, message: "Successfully subscribed" };
      } catch (error) {
        console.error("Failed to subscribe to newsletter:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to subscribe to newsletter",
        });
      }
    }),
});
