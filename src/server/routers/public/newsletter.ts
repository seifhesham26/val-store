import { z } from "zod";
import { publicProcedure, router } from "../../trpc";
import { newsletterSubscribers } from "@/db/schema";
import { db } from "@/db";

export const newsletterRouter = router({
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email("Please enter a valid email address"),
      })
    )
    .mutation(async ({ input }) => {
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
        throw new Error("Failed to subscribe to newsletter");
      }
    }),
});
