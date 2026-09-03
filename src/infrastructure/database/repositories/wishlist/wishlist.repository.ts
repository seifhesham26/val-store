/**
 * Drizzle Wishlist Repository
 *
 * Implementation of WishlistRepositoryInterface using Drizzle ORM.
 */

import { db } from "@/db";
import {
  wishlist,
  products,
  productImages,
  productVariants,
} from "@/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
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

    // Real stock, in one grouped query rather than one per row. `isActive` was
    // standing in for this, which offered "Move to cart" on sold-out products.
    const stockByProduct = await this.loadStock(
      result.map((row) => row.products.id)
    );

    // Map result to entity
    return result.map(
      ({ wishlist, products, product_images }) =>
        new WishlistItemEntity(
          wishlist.id,
          wishlist.userId,
          wishlist.productId,
          products.name,
          parseFloat(products.basePrice),
          products.salePrice ? parseFloat(products.salePrice) : null,
          product_images?.imageUrl ?? null,
          product_images?.altText ?? products.name,
          products.slug,
          products.isActive && (stockByProduct.get(products.id) ?? 0) > 0,
          wishlist.createdAt
        )
    );
  }

  /**
   * Total sellable units per product, summed across its variants.
   *
   * Matches how `ProductEntity.stock` is derived, so the wishlist and the product
   * page cannot disagree about whether something is buyable.
   */
  private async loadStock(productIds: string[]): Promise<Map<string, number>> {
    const ids = [...new Set(productIds)];
    if (ids.length === 0) return new Map();

    const rows = await db
      .select({
        productId: productVariants.productId,
        stock: sql<number>`COALESCE(SUM(${productVariants.stockQuantity}), 0)::int`,
      })
      .from(productVariants)
      .where(
        and(
          inArray(productVariants.productId, ids),
          eq(productVariants.isAvailable, true)
        )
      )
      .groupBy(productVariants.productId);

    return new Map(rows.map((row) => [row.productId, Number(row.stock)]));
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
