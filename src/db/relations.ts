/**
 * Drizzle ORM Relations
 *
 * Defines relationships between tables for use with db.query API.
 * Required for relational queries like: db.query.products.findFirst({ with: { variants: true } })
 */

import { relations } from "drizzle-orm";
import {
  products,
  productVariants,
  productImages,
  categories,
  orders,
  orderItems,
  carts,
  cartItems,
  coupons,
  wishlist,
  reviews,
  user,
  userProfiles,
  addresses,
  payments,
  inventoryLogs,
  contentSections,
  contentSectionsHistory,
} from "./schema";

// ============================================
// PRODUCT RELATIONS
// ============================================

/**
 * Product has:
 * - one category (optional)
 * - many variants
 * - many images
 * - many reviews
 * - many order items
 * - many cart items
 * - many wishlist items
 */
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
  images: many(productImages),
  reviews: many(reviews),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
  wishlistItems: many(wishlist),
}));

// ============================================
// PRODUCT VARIANT RELATIONS
// ============================================

/**
 * ProductVariant belongs to a product
 */
export const productVariantsRelations = relations(
  productVariants,
  ({ one }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
  })
);

// ============================================
// PRODUCT IMAGE RELATIONS
// ============================================

/**
 * ProductImage belongs to a product
 */
export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

// ============================================
// CATEGORY RELATIONS (Self-referencing)
// ============================================

/**
 * Category has:
 * - one parent category (optional, self-reference)
 * - many child categories (self-reference)
 * - many products
 */
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "parentChild",
  }),
  children: many(categories, { relationName: "parentChild" }),
  products: many(products),
}));

// ============================================
// ORDER RELATIONS
// ============================================

/**
 * Order has:
 * - many order items
 * - many payments
 * - one shipping address (optional)
 * - one billing address (optional)
 */
export const ordersRelations = relations(orders, ({ one, many }) => ({
  items: many(orderItems),
  payments: many(payments),
  shippingAddress: one(addresses, {
    fields: [orders.shippingAddressId],
    references: [addresses.id],
  }),
  billingAddress: one(addresses, {
    fields: [orders.billingAddressId],
    references: [addresses.id],
  }),
}));

// ============================================
// ORDER ITEM RELATIONS
// ============================================

/**
 * OrderItem belongs to order and product
 */
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
}));

// ============================================
// CART RELATIONS
// ============================================

/**
 * Cart belongs to a user, optionally has an applied coupon, and has
 * many cart items.
 */
export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(user, {
    fields: [carts.userId],
    references: [user.id],
  }),
  coupon: one(coupons, {
    fields: [carts.couponId],
    references: [coupons.id],
  }),
  items: many(cartItems),
}));

// ============================================
// CART ITEM RELATIONS
// ============================================

/**
 * CartItem belongs to a cart and a product
 */
export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
}));

// ============================================
// WISHLIST RELATIONS
// ============================================

/**
 * Wishlist item belongs to user and product
 */
export const wishlistRelations = relations(wishlist, ({ one }) => ({
  user: one(user, {
    fields: [wishlist.userId],
    references: [user.id],
  }),
  product: one(products, {
    fields: [wishlist.productId],
    references: [products.id],
  }),
}));

// ============================================
// REVIEW RELATIONS
// ============================================

/**
 * Review belongs to product, user, and optionally order
 */
export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  user: one(user, {
    fields: [reviews.userId],
    references: [user.id],
  }),
  order: one(orders, {
    fields: [reviews.orderId],
    references: [orders.id],
  }),
}));

// ============================================
// USER PROFILE RELATIONS
// ============================================

/**
 * UserProfile belongs to a user
 */
export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(user, {
    fields: [userProfiles.userId],
    references: [user.id],
  }),
}));

// ============================================
// ADDRESS RELATIONS
// ============================================

/**
 * Address belongs to a user
 */
export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(user, {
    fields: [addresses.userId],
    references: [user.id],
  }),
}));

// ============================================
// PAYMENT RELATIONS
// ============================================

/**
 * Payment belongs to an order
 */
export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

// ============================================
// INVENTORY LOG RELATIONS
// ============================================

/**
 * InventoryLog belongs to a variant
 */
export const inventoryLogsRelations = relations(inventoryLogs, ({ one }) => ({
  variant: one(productVariants, {
    fields: [inventoryLogs.variantId],
    references: [productVariants.id],
  }),
}));

// ============================================
// CONTENT SECTION HISTORY RELATIONS
// ============================================

/**
 * ContentSectionHistory belongs to a content section
 */
export const contentSectionsHistoryRelations = relations(
  contentSectionsHistory,
  ({ one }) => ({
    section: one(contentSections, {
      fields: [contentSectionsHistory.sectionId],
      references: [contentSections.id],
    }),
  })
);
