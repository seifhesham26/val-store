/**
 * Public Reviews Router
 *
 * Get reviews for products, submit new reviews.
 */

import { router, publicProcedure, protectedProcedure } from "@/server/trpc";
import { z } from "zod/v4";
import { DrizzleReviewRepository } from "@/infrastructure/database/repositories/reviews/review.repository";
import { TRPCError } from "@trpc/server";

const reviewRepo = new DrizzleReviewRepository();

export const publicReviewsRouter = router({
  /**
   * Get reviews for a product
   */
  getByProduct: publicProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [reviews, stats] = await Promise.all([
        reviewRepo.findByProductId(input.productId, true),
        reviewRepo.getAverageRating(input.productId),
      ]);
      return { reviews, ...stats };
    }),

  /**
   * Check if user has already reviewed a product
   */
  hasReviewed: protectedProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return reviewRepo.hasUserReviewed(input.productId, ctx.user.id);
    }),

  /**
   * Submit a new review
   */
  create: protectedProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        title: z.string().max(255).optional(),
        comment: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if user already reviewed
      const hasReviewed = await reviewRepo.hasUserReviewed(
        input.productId,
        ctx.user.id
      );
      if (hasReviewed) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already reviewed this product",
        });
      }

      return reviewRepo.create({
        productId: input.productId,
        userId: ctx.user.id,
        rating: input.rating,
        title: input.title,
        comment: input.comment,
        isVerifiedPurchase: false, // TODO: Check if user purchased
        isApproved: false, // Requires admin approval
      });
    }),
});
