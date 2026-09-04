/**
 * Review Repository Interface
 */

import { Review, NewReview } from "@/db/schema";

export interface ReviewWithUser extends Review {
  userName: string | null;
  userImage: string | null;
}

/** A bounded window over a review listing. */
export interface ReviewPage {
  limit: number;
  offset?: number;
}

export interface ReviewRepositoryInterface {
  findById(id: string): Promise<Review | null>;
  /**
   * Approved reviews for a product.
   *
   * `page` is optional so existing callers keep working, but every caller that
   * renders a list should pass one — without it this returns every review the
   * product has ever received.
   */
  findByProductId(
    productId: string,
    onlyApproved?: boolean,
    page?: ReviewPage
  ): Promise<ReviewWithUser[]>;
  findByUserId(userId: string): Promise<Review[]>;
  findAll(onlyPending?: boolean): Promise<ReviewWithUser[]>;
  /**
   * How many reviews match, ignoring any page window.
   *
   * Pairs with `findAll` so the admin moderation table can say it is showing
   * the first N of M rather than truncating in silence. Reviews are the one
   * admin table that grows without any bound an admin controls.
   */
  countAll(onlyPending?: boolean): Promise<number>;
  create(review: NewReview): Promise<Review>;
  update(id: string, review: Partial<NewReview>): Promise<Review | null>;
  delete(id: string): Promise<void>;
  getAverageRating(
    productId: string
  ): Promise<{ average: number; count: number }>;
  hasUserReviewed(productId: string, userId: string): Promise<boolean>;
  /**
   * The order that entitles this user to review this product, if there is one.
   *
   * Returns the most recent qualifying order id, or null when the user has never
   * actually bought the product.
   */
  findPurchaseOrderId(
    productId: string,
    userId: string
  ): Promise<string | null>;
}
