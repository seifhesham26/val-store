/**
 * Cart Repository Implementation
 *
 * Implements CartRepositoryInterface using Drizzle ORM.
 * Manages shopping cart items with product details.
 */

import { db } from "@/db";
import {
  cartItems,
  products,
  productVariants,
  productImages,
} from "@/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import { CartItemEntity } from "@/domain/cart/entities/cart-item.entity";

export class DrizzleCartRepository implements CartRepositoryInterface {
  /**
   * Find cart item by ID
   */
  async findById(cartItemId: string): Promise<CartItemEntity | null> {
    const result = await db
      .select({
        cartItem: cartItems,
        product: products,
        variant: productVariants,
        image: productImages,
        // Fallback stock for products that have no variants at all, so an
        // unvariated product is not treated as permanently out of stock.
        productStock: sql<number>`(
          SELECT COALESCE(SUM(pv.stock_quantity), 0)
          FROM product_variants pv
          WHERE pv.product_id = ${cartItems.productId}
        )`,
      })
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .leftJoin(
        productImages,
        and(
          eq(cartItems.productId, productImages.productId),
          eq(productImages.isPrimary, true)
        )
      )
      .where(eq(cartItems.id, cartItemId))
      .limit(1);

    if (!result[0] || !result[0].product) {
      return null;
    }

    return this.mapToEntity(result[0]);
  }

  /**
   * Find all cart items for a user
   */
  async findByUserId(userId: string): Promise<CartItemEntity[]> {
    const results = await db
      .select({
        cartItem: cartItems,
        product: products,
        variant: productVariants,
        image: productImages,
        // Fallback stock for products that have no variants at all, so an
        // unvariated product is not treated as permanently out of stock.
        productStock: sql<number>`(
          SELECT COALESCE(SUM(pv.stock_quantity), 0)
          FROM product_variants pv
          WHERE pv.product_id = ${cartItems.productId}
        )`,
      })
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .leftJoin(
        productImages,
        and(
          eq(cartItems.productId, productImages.productId),
          eq(productImages.isPrimary, true)
        )
      )
      .where(eq(cartItems.userId, userId));

    return results.filter((r) => r.product).map((r) => this.mapToEntity(r));
  }

  /**
   * Find cart item by user and product
   */
  async findByUserAndProduct(
    userId: string,
    productId: string,
    variantId: string | null = null
  ): Promise<CartItemEntity | null> {
    const result = await db
      .select({
        cartItem: cartItems,
        product: products,
        variant: productVariants,
        image: productImages,
        // Fallback stock for products that have no variants at all, so an
        // unvariated product is not treated as permanently out of stock.
        productStock: sql<number>`(
          SELECT COALESCE(SUM(pv.stock_quantity), 0)
          FROM product_variants pv
          WHERE pv.product_id = ${cartItems.productId}
        )`,
      })
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .leftJoin(
        productImages,
        and(
          eq(cartItems.productId, productImages.productId),
          eq(productImages.isPrimary, true)
        )
      )
      .where(
        and(
          eq(cartItems.userId, userId),
          eq(cartItems.productId, productId),
          variantId === null
            ? isNull(cartItems.variantId)
            : eq(cartItems.variantId, variantId)
        )
      )
      .limit(1);

    if (!result[0] || !result[0].product) {
      return null;
    }

    return this.mapToEntity(result[0]);
  }

  /**
   * Add item to cart
   */
  async addItem(cartItem: CartItemEntity): Promise<CartItemEntity> {
    // Check if item already exists
    const existing = await this.findByUserAndProduct(
      cartItem.userId,
      cartItem.productId,
      cartItem.variantId
    );

    if (existing) {
      // Update quantity instead
      return this.updateQuantity(
        existing.id,
        existing.quantity + cartItem.quantity
      );
    }

    // Insert new item
    const [newItem] = await db
      .insert(cartItems)
      .values({
        userId: cartItem.userId,
        productId: cartItem.productId,
        variantId: cartItem.variantId,
        quantity: cartItem.quantity,
      })
      .returning();

    const created = await this.findById(newItem.id);
    if (!created) {
      throw new Error("Failed to create cart item");
    }
    return created;
  }

  /**
   * Update cart item quantity
   */
  async updateQuantity(
    cartItemId: string,
    newQuantity: number
  ): Promise<CartItemEntity> {
    if (newQuantity < 1) {
      throw new Error("Quantity must be at least 1");
    }

    await db
      .update(cartItems)
      .set({
        quantity: newQuantity,
        updatedAt: new Date(),
      })
      .where(eq(cartItems.id, cartItemId));

    const updated = await this.findById(cartItemId);
    if (!updated) {
      throw new Error("Cart item not found");
    }
    return updated;
  }

  /**
   * Remove item from cart
   */
  async removeItem(cartItemId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
  }

  /**
   * Clear all cart items for a user
   */
  async clearCart(userId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
  }

  /**
   * Get cart total for a user
   */
  async getCartTotal(userId: string): Promise<number> {
    const items = await this.findByUserId(userId);
    return items.reduce((total, item) => total + item.calculateSubtotal(), 0);
  }

  /**
   * Get cart item count for a user
   */
  async getCartItemCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COALESCE(SUM(${cartItems.quantity}), 0)` })
      .from(cartItems)
      .where(eq(cartItems.userId, userId));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Check if product is in user's cart
   */
  async isProductInCart(userId: string, productId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: cartItems.id })
      .from(cartItems)
      .where(
        and(eq(cartItems.userId, userId), eq(cartItems.productId, productId))
      )
      .limit(1);
    return !!row;
  }

  /**
   * Map database result to entity
   */
  private mapToEntity(result: {
    cartItem: typeof cartItems.$inferSelect;
    product: typeof products.$inferSelect | null;
    variant: typeof productVariants.$inferSelect | null;
    image?: typeof productImages.$inferSelect | null;
    productStock?: number | null;
  }): CartItemEntity {
    const { cartItem, product, variant, image, productStock } = result;

    // Stock ceiling: the chosen variant's stock, or — for a product with no
    // variants — the product's total stock. Previously this always resolved to
    // 0 because variantId was never persisted.
    const maxStock = variant
      ? variant.stockQuantity
      : Number(productStock ?? 0);

    // Get price - prefer sale price from product
    const price = product?.salePrice
      ? parseFloat(product.salePrice)
      : parseFloat(product?.basePrice ?? "0");

    return new CartItemEntity(
      cartItem.id,
      cartItem.userId,
      cartItem.productId,
      product?.name ?? "Unknown Product",
      price,
      image?.imageUrl ?? null,
      cartItem.quantity,
      maxStock,
      new Date(cartItem.createdAt),
      new Date(cartItem.updatedAt),
      cartItem.variantId,
      variant?.size ?? null,
      variant?.color ?? null
    );
  }
}
