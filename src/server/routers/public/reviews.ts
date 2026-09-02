/**
 * Public Reviews Router
 *
 * Get reviews for products, submit new reviews.
 */

import { router, publicProcedure, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { DrizzleReviewRepository } from "@/infrastructure/database/repositories/reviews/review.repository";
import { container } from "@/application/container";
import { TRPCError } from "@trpc/server";
import { apiRateLimiter, enforceRateLimit } from "@/server/utils/rate-limiter";

const reviewRepo = new DrizzleReviewRepository();

export const publicReviewsRouter = router({
  /**
   * Get reviews for a product
   */
  getByProduct: publicProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        // Bounded. This returned every approved review a product had ever
        // received, which is fine for a product with four and a problem for a
        // product with four thousand — and the caller only renders a list.
        limit: z.number().int().min(1).max(50).optional().default(20),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ input }) => {
      const [reviews, stats] = await Promise.all([
        reviewRepo.findByProductId(input.productId, true, {
          limit: input.limit,
          offset: input.offset,
        }),
        reviewRepo.getAverageRating(input.productId),
      ]);
      // `stats.count` is the true total, so a caller can tell whether there is
      // another page without a second query.
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
      // One review per product per user is enforced below, but that leaves an
      // account free to review every product in the catalogue as fast as it can
      // send requests — and each one emits an admin notification. Keyed by user
      // rather than IP: this is authenticated, so the account is the thing
      // worth budgeting.
      await enforceRateLimit(apiRateLimiter, `review:${ctx.user.id}`);

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

      // A verified badge has to be earned by an actual paid order, so it is
      // resolved here rather than taken from the client.
      const orderId = await reviewRepo.findPurchaseOrderId(
        input.productId,
        ctx.user.id
      );

      const review = await reviewRepo.create({
        productId: input.productId,
        userId: ctx.user.id,
        orderId,
        rating: input.rating,
        title: input.title,
        comment: input.comment,
        isVerifiedPurchase: orderId !== null,
        isApproved: false, // Requires admin approval
      });

      // Reviews sit unapproved until an admin acts, so this is the only thing
      // that tells them there is something in the queue.
      const product = await container
        .getProductRepository()
        .findById(input.productId);

      await container.getNotificationService().reviewSubmitted({
        reviewId: review.id,
        productName: product?.name ?? "a product",
        rating: input.rating,
        isVerifiedPurchase: orderId !== null,
      });

      return review;
    }),
});
