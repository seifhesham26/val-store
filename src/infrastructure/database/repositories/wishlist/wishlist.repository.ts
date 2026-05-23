/**
 * Drizzle Wishlist Repository
 *
 * Implementation of WishlistRepositoryInterface using Drizzle ORM.
 */

import { db } from "@/db";
import { wishlist, products, productImages } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { WishlistRepositoryInterface } from "@/domain/wishlist/interfaces/repositories/wishlist.repository.interface";
import { WishlistItemEntity } from "@/domain/wishlist/entities/wishlist-item.entity";

export class DrizzleWishlistRepository implements WishlistRepositoryInterface {
  async add(userId: string, productId: string): Promise<void> {
    await db
      .insert(wishlist)
      .values({
        userId,
        productId,
      })
      .onConflictDoNothing(); // Ignore if already exists
  }

  async remove(userId: string, productId: string): Promise<void> {
    await db
      .delete(wishlist)
      .where(
        and(eq(wishlist.userId, userId), eq(wishlist.productId, productId))
      );
  }

  async findByUserId(userId: string): Promise<WishlistItemEntity[]> {
    // Join with products and productImages (primary) to get product details + primary image
    const result = await db
      .select()
      .from(wishlist)
      .innerJoin(products, eq(wishlist.productId, products.id))
      .leftJoin(
        productImages,
        and(
          eq(productImages.productId, products.id),
          eq(productImages.isPrimary, true)
        )
      )
      .where(eq(wishlist.userId, userId))
      .orderBy(desc(wishlist.createdAt));

    // Map result to entity
    return result.map(
      ({ wishlist, products, product_images }) =>
        new WishlistItemEntity(
          wishlist.id,
          wishlist.userId,
          wishlist.productId,
          products.name,
          parseFloat(products.basePrice as unknown as string),
          products.salePrice
            ? parseFloat(products.salePrice as unknown as string)
            : null,
          product_images?.imageUrl ?? null,
          product_images?.altText ?? products.name,
          products.slug,
          products.isActive, // Basic stock flag based on active status for now
          wishlist.createdAt
        )
    );
  }

  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const item = await db.query.wishlist.findFirst({
      where: and(
        eq(wishlist.userId, userId),
        eq(wishlist.productId, productId)
      ),
    });

    return !!item;
  }
}
