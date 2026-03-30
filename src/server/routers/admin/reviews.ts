/**
 * Admin Reviews Router
 *
 * Moderation: list all, approve, delete reviews.
 */

import { router, adminProcedure } from "@/server/trpc";
import { z } from "zod/v4";
import { DrizzleReviewRepository } from "@/infrastructure/database/repositories/reviews/review.repository";
import { TRPCError } from "@trpc/server";

const reviewRepo = new DrizzleReviewRepository();

export const adminReviewsRouter = router({
  /**
   * List all reviews (optionally only pending)
   */
  list: adminProcedure
    .input(
      z
        .object({
          onlyPending: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return reviewRepo.findAll(input?.onlyPending ?? false);
    }),

  /**
   * Approve a review
   */
  approve: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const review = await reviewRepo.update(input.id, { isApproved: true });
      if (!review) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }
      return review;
    }),

  /**
   * Reject/unapprove a review
   */
  reject: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const review = await reviewRepo.update(input.id, { isApproved: false });
      if (!review) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }
      return review;
    }),

  /**
   * Delete a review
   */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await reviewRepo.delete(input.id);
      return { success: true };
    }),
});
