/**
 * Drizzle Review Repository
 */

import { db } from "@/db";
import { reviews, user, Review, NewReview } from "@/db/schema";
import { eq, and, desc, avg, count } from "drizzle-orm";
import {
  ReviewRepositoryInterface,
  ReviewWithUser,
} from "@/domain/reviews/interfaces/repositories/review.repository.interface";

export class DrizzleReviewRepository implements ReviewRepositoryInterface {
  async findById(id: string): Promise<Review | null> {
    const result = await db.query.reviews.findFirst({
      where: eq(reviews.id, id),
    });
    return result ?? null;
  }

  async findByProductId(
    productId: string,
    onlyApproved = true
  ): Promise<ReviewWithUser[]> {
    const conditions = onlyApproved
      ? and(eq(reviews.productId, productId), eq(reviews.isApproved, true))
      : eq(reviews.productId, productId);

    const results = await db
      .select({
        id: reviews.id,
        productId: reviews.productId,
        userId: reviews.userId,
        orderId: reviews.orderId,
        rating: reviews.rating,
        title: reviews.title,
        comment: reviews.comment,
        isVerifiedPurchase: reviews.isVerifiedPurchase,
        isApproved: reviews.isApproved,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        userName: user.name,
        userImage: user.image,
      })
      .from(reviews)
      .leftJoin(user, eq(reviews.userId, user.id))
      .where(conditions)
      .orderBy(desc(reviews.createdAt));

    return results;
  }

  async findByUserId(userId: string): Promise<Review[]> {
    return db.query.reviews.findMany({
      where: eq(reviews.userId, userId),
      orderBy: [desc(reviews.createdAt)],
    });
  }

  async findAll(onlyPending = false): Promise<ReviewWithUser[]> {
    const conditions = onlyPending ? eq(reviews.isApproved, false) : undefined;

    const results = await db
      .select({
        id: reviews.id,
        productId: reviews.productId,
        userId: reviews.userId,
        orderId: reviews.orderId,
        rating: reviews.rating,
        title: reviews.title,
        comment: reviews.comment,
        isVerifiedPurchase: reviews.isVerifiedPurchase,
        isApproved: reviews.isApproved,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        userName: user.name,
        userImage: user.image,
      })
      .from(reviews)
      .leftJoin(user, eq(reviews.userId, user.id))
      .where(conditions)
      .orderBy(desc(reviews.createdAt));

    return results;
  }

  async create(review: NewReview): Promise<Review> {
    const [result] = await db.insert(reviews).values(review).returning();
    return result;
  }

  async update(id: string, review: Partial<NewReview>): Promise<Review | null> {
    const [result] = await db
      .update(reviews)
      .set({ ...review, updatedAt: new Date() })
      .where(eq(reviews.id, id))
      .returning();
    return result ?? null;
  }

  async delete(id: string): Promise<void> {
    await db.delete(reviews).where(eq(reviews.id, id));
  }

  async getAverageRating(
    productId: string
  ): Promise<{ average: number; count: number }> {
    const result = await db
      .select({
        average: avg(reviews.rating),
        count: count(),
      })
      .from(reviews)
      .where(
        and(eq(reviews.productId, productId), eq(reviews.isApproved, true))
      );

    return {
      average: result[0]?.average ? parseFloat(result[0].average) : 0,
      count: result[0]?.count ?? 0,
    };
  }

  async hasUserReviewed(productId: string, userId: string): Promise<boolean> {
    const result = await db.query.reviews.findFirst({
      where: and(eq(reviews.productId, productId), eq(reviews.userId, userId)),
    });
    return result !== undefined;
  }
}
