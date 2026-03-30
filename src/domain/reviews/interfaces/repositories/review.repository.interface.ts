/**
 * Review Repository Interface
 */

import { Review, NewReview } from "@/db/schema";

export interface ReviewWithUser extends Review {
  userName: string | null;
  userImage: string | null;
}

export interface ReviewRepositoryInterface {
  findById(id: string): Promise<Review | null>;
  findByProductId(
    productId: string,
    onlyApproved?: boolean
  ): Promise<ReviewWithUser[]>;
  findByUserId(userId: string): Promise<Review[]>;
  findAll(onlyPending?: boolean): Promise<ReviewWithUser[]>;
  create(review: NewReview): Promise<Review>;
  update(id: string, review: Partial<NewReview>): Promise<Review | null>;
  delete(id: string): Promise<void>;
  getAverageRating(
    productId: string
  ): Promise<{ average: number; count: number }>;
  hasUserReviewed(productId: string, userId: string): Promise<boolean>;
}
