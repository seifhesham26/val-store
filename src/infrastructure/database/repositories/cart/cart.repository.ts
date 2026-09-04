/**
 * Cart Repository Implementation
 *
 * Implements CartRepositoryInterface using Drizzle ORM.
 * Manages shopping cart items with product details.
 */

import { db } from "@/db";
import {
  carts,
  cartItems,
  products,
  productVariants,
  productImages,
  coupons,
} from "@/db/schema";
import type { Cart } from "@/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import {
  CartRepositoryInterface,
  AppliedCoupon,
} from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import { CartItemEntity } from "@/domain/cart/entities/cart-item.entity";

export class DrizzleCartRepository implements CartRepositoryInterface {
  /**
   * The cart row for a user, or null.
   *
   * Reads use this: a customer who has never added anything has no cart row,
   * and reading their cart must not create one. Only writes create.
   */
  private async findCartByUserId(userId: string): Promise<Cart | null> {
    const [cart] = await db
      .select()
      .from(carts)
      .where(eq(carts.userId, userId))
      .limit(1);
    return cart ?? null;
  }

  /**
   * The cart row for a user, creating it if this is their first write.
   *
   * `onConflictDoNothing` plus a re-read rather than a read-then-insert: two
   * concurrent first adds would both see no row and both try to insert, and
   * `carts.user_id` is unique, so the loser would throw. This lets the loser
   * fall through to the re-read and find the winner's row.
   */
  private async getOrCreateCart(userId: string): Promise<Cart> {
    const existing = await this.findCartByUserId(userId);
    if (existing) return existing;

    await db.insert(carts).values({ userId }).onConflictDoNothing();

    const created = await this.findCartByUserId(userId);
    if (!created) {
      throw new Error("Failed to create cart");
    }
    return created;
  }

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
        userId: carts.userId,
        // Fallback stock for products that have no variants at all, so an
        // unvariated product is not treated as permanently out of stock.
        productStock: sql<number>`(
          SELECT COALESCE(SUM(pv.stock_quantity), 0)
          FROM product_variants pv
          WHERE pv.product_id = ${cartItems.productId}
        )`,
      })
      .from(cartItems)
      .innerJoin(carts, eq(cartItems.cartId, carts.id))
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
    const cart = await this.findCartByUserId(userId);
    if (!cart) return [];

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
      .where(eq(cartItems.cartId, cart.id));

    return results
      .filter((r) => r.product)
      .map((r) => this.mapToEntity({ ...r, userId }));
  }

  /**
   * Find cart item by user and product
   */
  async findByUserAndProduct(
    userId: string,
    productId: string,
    variantId: string | null = null
  ): Promise<CartItemEntity | null> {
    const cart = await this.findCartByUserId(userId);
    if (!cart) return null;

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
          eq(cartItems.cartId, cart.id),
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

    return this.mapToEntity({ ...result[0], userId });
  }

  /**
   * Add item to cart
   */
  async addItem(cartItem: CartItemEntity): Promise<CartItemEntity> {
    // The variant id arrives from the client, so verify it actually belongs to
    // this product before storing it. Without this a crafted request could pair
    // product A with product B's variant, and checkout would then decrement the
    // wrong product's stock.
    // `stockQuantity` is selected here even though the ownership check does not
    // need it: `assertWithinStock` below reads the same row for the same
    // variant, so taking both columns in one statement removes a whole round
    // trip (~58ms against Neon) from every add-to-cart of a variant product,
    // which is most of the catalogue.
    let variantStock: number | undefined;

    if (cartItem.variantId) {
      const [variant] = await db
        .select({
          productId: productVariants.productId,
          isAvailable: productVariants.isAvailable,
          stockQuantity: productVariants.stockQuantity,
        })
        .from(productVariants)
        .where(eq(productVariants.id, cartItem.variantId))
        .limit(1);

      if (!variant || variant.productId !== cartItem.productId) {
        throw new Error("Selected option is not available for this product");
      }

      if (!variant.isAvailable) {
        throw new Error("Selected option is no longer available");
      }

      variantStock = variant.stockQuantity;
    }

    // Check if item already exists
    const existing = await this.findByUserAndProduct(
      cartItem.userId,
      cartItem.productId,
      cartItem.variantId
    );

    const requestedQuantity = existing
      ? existing.quantity + cartItem.quantity
      : cartItem.quantity;

    // Enforce the stock ceiling on the way in, not just when the quantity is
    // changed later. Previously only the cart drawer's +/- path checked stock,
    // so "Add to cart" could put 50 of a 2-stock variant straight in the cart
    // and the customer only found out at checkout.
    await this.assertWithinStock(
      cartItem.productId,
      cartItem.variantId,
      requestedQuantity,
      variantStock
    );

    if (existing) {
      // Update quantity instead
      return this.updateQuantity(existing.id, requestedQuantity);
    }

    // Insert new item
    const cart = await this.getOrCreateCart(cartItem.userId);

    const [newItem] = await db
      .insert(cartItems)
      .values({
        cartId: cart.id,
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
   * Clear all cart items for a user, and drop any applied coupon with them —
   * an emptied cart must not keep a coupon applied to nothing.
   *
   * Nulls the coupon columns directly with the cart id already in hand,
   * rather than calling `clearAppliedCoupon` (which would re-resolve the
   * same cart via its own `findCartByUserId`). The delete and the update are
   * fired without an `await` between them so postgres.js pipelines both
   * statements onto the connection in one round trip.
   */
  async clearCart(userId: string): Promise<void> {
    const cart = await this.findCartByUserId(userId);
    if (!cart) return;

    const deleteItems = db
      .delete(cartItems)
      .where(eq(cartItems.cartId, cart.id));
    const clearCoupon = db
      .update(carts)
      .set({
        couponId: null,
        couponAppliedAt: null,
        couponCheckedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cart.id));

    await Promise.all([deleteItems, clearCoupon]);
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
    const cart = await this.findCartByUserId(userId);
    if (!cart) return 0;

    const result = await db
      .select({ count: sql<number>`COALESCE(SUM(${cartItems.quantity}), 0)` })
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Check if product is in user's cart
   */
  async isProductInCart(userId: string, productId: string): Promise<boolean> {
    const cart = await this.findCartByUserId(userId);
    if (!cart) return false;

    const [row] = await db
      .select({ id: cartItems.id })
      .from(cartItems)
      .where(
        and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId))
      )
      .limit(1);
    return !!row;
  }

  /**
   * The coupon currently applied to this user's cart, or null.
   */
  async getAppliedCoupon(userId: string): Promise<AppliedCoupon | null> {
    const cart = await this.findCartByUserId(userId);

    // The three columns move together, so any null means no coupon. Checked
    // explicitly rather than trusting `couponId` alone: a partially written
    // row is a bug, and reading it as "applied" would hide that.
    if (!cart?.couponId || !cart.couponAppliedAt || !cart.couponCheckedAt) {
      return null;
    }

    // Joined rather than exposed as a second method: the caller always wants
    // the code, and `coupon_id` alone would force a round trip per read.
    const [coupon] = await db
      .select({ code: coupons.code })
      .from(coupons)
      .where(eq(coupons.id, cart.couponId))
      .limit(1);

    // The coupon was deleted out from under the cart. `ON DELETE SET NULL`
    // should prevent this, so treat it as no coupon rather than guessing.
    if (!coupon) return null;

    return {
      couponId: cart.couponId,
      code: coupon.code,
      appliedAt: cart.couponAppliedAt,
      checkedAt: cart.couponCheckedAt,
    };
  }

  /**
   * Apply a coupon, replacing any already applied. Sets all three columns.
   */
  async setAppliedCoupon(userId: string, couponId: string): Promise<void> {
    const cart = await this.getOrCreateCart(userId);
    const now = new Date();

    await db
      .update(carts)
      .set({
        couponId,
        couponAppliedAt: now,
        couponCheckedAt: now,
        updatedAt: now,
      })
      .where(eq(carts.id, cart.id));
  }

  /**
   * Remove the applied coupon. Nulls all three columns.
   */
  async clearAppliedCoupon(userId: string): Promise<void> {
    const cart = await this.findCartByUserId(userId);
    if (!cart) return;

    await db
      .update(carts)
      .set({
        couponId: null,
        couponAppliedAt: null,
        couponCheckedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cart.id));
  }

  /**
   * Record that the applied coupon was just re-validated successfully.
   */
  async touchCouponCheckedAt(userId: string): Promise<void> {
    const cart = await this.findCartByUserId(userId);
    if (!cart) return;

    const now = new Date();
    await db
      .update(carts)
      .set({ couponCheckedAt: now, updatedAt: now })
      .where(eq(carts.id, cart.id));
  }

  /**
   * Throw if the requested quantity exceeds what is actually in stock.
   *
   * Uses the chosen variant's stock, falling back to the product's total stock
   * for products that have no variants.
   *
   * `knownVariantStock` lets a caller that has already read the variant row
   * hand the level over rather than paying for a second read of it. Passing
   * `undefined` reads it here, which is the behaviour every caller had before.
   */
  private async assertWithinStock(
    productId: string,
    variantId: string | null,
    requestedQuantity: number,
    knownVariantStock?: number
  ): Promise<void> {
    let available: number;

    if (variantId) {
      if (knownVariantStock !== undefined) {
        available = knownVariantStock;
      } else {
        const [variant] = await db
          .select({ stockQuantity: productVariants.stockQuantity })
          .from(productVariants)
          .where(eq(productVariants.id, variantId))
          .limit(1);
        available = variant?.stockQuantity ?? 0;
      }
    } else {
      const [row] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${productVariants.stockQuantity}), 0)`,
        })
        .from(productVariants)
        .where(eq(productVariants.productId, productId));
      available = Number(row?.total ?? 0);
    }

    if (requestedQuantity > available) {
      throw new Error(
        available === 0
          ? "This item is out of stock"
          : `Only ${available} left in stock`
      );
    }
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
    userId: string;
  }): CartItemEntity {
    const { cartItem, product, variant, image, productStock, userId } = result;

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
      userId,
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
