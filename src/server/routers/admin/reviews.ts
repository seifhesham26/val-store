/**
 * Admin Reviews Router
 *
 * Moderation: list all, approve, delete reviews.
 */

import { router, adminProcedure, adminWriteProcedure } from "@/server/trpc";
import { z } from "zod";
import {
  DrizzleReviewRepository,
  DEFAULT_ADMIN_REVIEW_LIMIT,
} from "@/infrastructure/database/repositories/reviews/review.repository";
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
      const onlyPending = input?.onlyPending ?? false;

      // `total` alongside the rows: `findAll` is capped at
      // `DEFAULT_ADMIN_REVIEW_LIMIT` and this table does not paginate, so
      // without the total it silently stops showing reviews. Reviews are the
      // one admin table that grows without an admin doing anything.
      const [items, total] = await Promise.all([
        reviewRepo.findAll(onlyPending),
        reviewRepo.countAll(onlyPending),
      ]);

      return { items, total, limit: DEFAULT_ADMIN_REVIEW_LIMIT };
    }),

  /**
   * Approve a review
   */
  approve: adminWriteProcedure
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
  reject: adminWriteProcedure
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
  delete: adminWriteProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await reviewRepo.delete(input.id);
      return { success: true };
    }),
});
