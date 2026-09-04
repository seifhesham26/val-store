import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

// ============================================
// ENUMS
// ============================================

// User role enum for UserProfile table (extends Better Auth)
export const userRoleEnum = pgEnum("user_role", [
  "customer",
  "worker",
  "admin",
  "super_admin",
]);

// Address type enum
export const addressTypeEnum = pgEnum("address_type", ["shipping", "billing"]);

// Gender enum for products
export const genderEnum = pgEnum("gender", ["men", "women", "unisex", "kids"]);

// Order status enum
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "processing",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

// Payment method enum
export const paymentMethodEnum = pgEnum("payment_method", [
  "credit_card",
  "debit_card",
  "paypal",
  "stripe",
  "cash_on_delivery",
]);

// Payment status enum
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "completed",
  "failed",
  "refunded",
]);

// Discount type enum
export const discountTypeEnum = pgEnum("discount_type", [
  "percentage",
  "fixed",
]);

// Inventory change type enum
export const inventoryChangeTypeEnum = pgEnum("inventory_change_type", [
  "restock",
  "sale",
  "adjustment",
  "damaged",
  "return",
]);

// Admin notification type enum
export const notificationTypeEnum = pgEnum("notification_type", [
  "new_order",
  "low_stock",
  "new_review",
  "failed_payment",
  "new_customer",
]);

// User notification type enum
export const userNotificationTypeEnum = pgEnum("user_notification_type", [
  "wishlist_sale",
  "item_available",
  "order_update",
  "price_drop",
  "order_confirmed",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  "refund_processed",
]);

// ============================================
// BETTER AUTH TABLES
// ============================================

// Import Better Auth generated schema
import {
  user,
  session,
  account,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
} from "../../auth-schema";

// Re-export for use in the app
export {
  user,
  session,
  account,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
};

// ============================================
// USER PROFILE TABLE (Extends Better Auth)
// ============================================

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  role: userRoleEnum("role").default("customer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// CUSTOMERS TABLE (Real Human Identity)
// ============================================

/**
 * Customer represents a real human, identified by phone number.
 * Multiple user accounts can belong to the same customer.
 */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: varchar("phone", { length: 20 }).notNull().unique(),
    preferredName: varchar("preferred_name", { length: 100 }),
    isPhoneVerified: boolean("is_phone_verified").default(false).notNull(),
    totalOrders: integer("total_orders").default(0).notNull(),
    totalSpent: decimal("total_spent", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    loyaltyPoints: integer("loyalty_points").default(0).notNull(),
    notes: text("notes"), // Admin notes
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    phoneIdx: uniqueIndex("idx_customers_phone").on(table.phone),
  })
);

// ============================================
// ADDRESSES TABLE
// ============================================

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    addressType: addressTypeEnum("address_type").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    addressLine1: varchar("address_line1", { length: 255 }).notNull(),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 100 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    country: varchar("country", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_addresses_user_id").on(table.userId),
    isDefaultIdx: index("idx_addresses_is_default").on(table.isDefault),
  })
);

// ============================================
// CATEGORIES TABLE (Self-referencing)
// ============================================

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    description: text("description"),
    // Parent category ID for hierarchical structure (relation defined below)
    parentId: uuid("parent_id"),
    imageUrl: varchar("image_url", { length: 500 }),
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("idx_categories_slug").on(table.slug),
    parentIdIdx: index("idx_categories_parent_id").on(table.parentId),
    isActiveIdx: index("idx_categories_is_active").on(table.isActive),
  })
);

// ============================================
// PRODUCTS TABLE
// ============================================

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    sku: varchar("sku", { length: 100 }).notNull().unique(),
    basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
    salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
    costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
    isActive: boolean("is_active").default(true).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    gender: genderEnum("gender").default("unisex"),
    material: varchar("material", { length: 255 }),
    careInstructions: text("care_instructions"),
    metaTitle: varchar("meta_title", { length: 255 }),
    metaDescription: text("meta_description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("idx_products_slug").on(table.slug),
    skuIdx: index("idx_products_sku").on(table.sku),
    categoryIdIdx: index("idx_products_category_id").on(table.categoryId),
    isActiveIdx: index("idx_products_is_active").on(table.isActive),
    isFeaturedIdx: index("idx_products_is_featured").on(table.isFeatured),
    // Every storefront listing is `WHERE is_active = true ORDER BY created_at
    // DESC LIMIT n`. On `is_active` alone Postgres has to sort every active
    // product to find one page; this composite lets it walk the index backwards
    // and stop at the limit. Ascending on purpose — a btree scans either way,
    // and an equality predicate on the leading column makes it usable for both
    // sort directions.
    activeCreatedIdx: index("idx_products_active_created").on(
      table.isActive,
      table.createdAt
    ),
  })
);

// ============================================
// PRODUCT VARIANTS TABLE
// ============================================

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 100 }).notNull().unique(),
    size: varchar("size", { length: 50 }),
    color: varchar("color", { length: 50 }),
    stockQuantity: integer("stock_quantity").default(0).notNull(),
    priceAdjustment: decimal("price_adjustment", {
      precision: 10,
      scale: 2,
    }).default("0"),
    isAvailable: boolean("is_available").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("idx_variants_product_id").on(table.productId),
    skuIdx: index("idx_variants_sku").on(table.sku),
    isAvailableIdx: index("idx_variants_is_available").on(table.isAvailable),
  })
);

// ============================================
// PRODUCT IMAGES TABLE
// ============================================

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    imageUrl: varchar("image_url", { length: 500 }).notNull(),
    altText: varchar("alt_text", { length: 255 }),
    displayOrder: integer("display_order").default(0).notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("idx_images_product_id").on(table.productId),
    isPrimaryIdx: index("idx_images_is_primary").on(table.isPrimary),
  })
);

// ============================================
// ORDERS TABLE
// ============================================

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    status: orderStatusEnum("status").default("pending").notNull(),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    shippingAmount: decimal("shipping_amount", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    // EGP, not USD. A literal rather than STORE_CURRENCY because a column
    // default has to be stable across environments — if it read the env var,
    // `db:push` would propose a schema change whenever the var differed.
    // Rows written before this default was corrected say USD though they were
    // charged in EGP; drizzle/0003_backfill_currency.sql fixes them.
    currency: varchar("currency", { length: 3 }).default("EGP").notNull(),
    // Which coupon produced `discountAmount`. Previously only `coupon_usages`
    // knew, which made it impossible to record the redemption *after* payment
    // — the order had no idea what to credit.
    couponId: uuid("coupon_id").references(() => coupons.id, {
      onDelete: "set null",
    }),
    /**
     * The address rows this order was placed against.
     *
     * `ON DELETE SET NULL`, not the default `NO ACTION` they used to carry. A
     * customer could not delete a saved address once any order referenced it —
     * the delete raised a foreign key violation that the account page did not
     * even surface, so the button simply did nothing. And because
     * `addresses.user_id` cascades from `user`, the same constraint made
     * deleting a customer who had ever ordered impossible, while
     * `orders.user_id` is `SET NULL` precisely so that orders outlive the
     * account.
     *
     * The ids are now a convenience link, not the record. The record is the
     * snapshot below.
     */
    shippingAddressId: uuid("shipping_address_id").references(
      () => addresses.id,
      { onDelete: "set null" }
    ),
    billingAddressId: uuid("billing_address_id").references(
      () => addresses.id,
      { onDelete: "set null" }
    ),
    /**
     * Where this order was actually sent and billed, copied at checkout.
     *
     * An order has to keep its address even when the address row is gone —
     * deleted by the customer, or cascaded away with their account. It is also
     * the more correct record regardless: editing a saved address must not
     * retroactively change where a shipped order says it went.
     *
     * Shaped exactly like the `OrderAddress` DTO the entity carries, so the
     * repository reads it straight through. Null on rows written before this
     * existed, which fall back to the joined address.
     */
    shippingAddressSnapshot: jsonb("shipping_address_snapshot"),
    billingAddressSnapshot: jsonb("billing_address_snapshot"),
    customerNotes: text("customer_notes"),
    adminNotes: text("admin_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    shippedAt: timestamp("shipped_at"),
    deliveredAt: timestamp("delivered_at"),
  },
  (table) => ({
    userIdIdx: index("idx_orders_user_id").on(table.userId),
    orderNumberIdx: index("idx_orders_order_number").on(table.orderNumber),
    statusIdx: index("idx_orders_status").on(table.status),
    createdAtIdx: index("idx_orders_created_at").on(table.createdAt),
    // "My orders" pages `WHERE user_id = ? ORDER BY created_at DESC`, which the
    // single-column user_id index cannot satisfy without a sort.
    userCreatedIdx: index("idx_orders_user_created").on(
      table.userId,
      table.createdAt
    ),
  })
);

// ============================================
// ORDER ITEMS TABLE
// ============================================

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    productName: varchar("product_name", { length: 255 }).notNull(),
    variantDetails: varchar("variant_details", { length: 255 }),
    quantity: integer("quantity").notNull(),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
    // Units of this line the customer has sent back and been refunded for.
    // Tracked per line so a partial return can be recorded — and so the same
    // unit cannot be refunded twice. The order's refunded total is derived
    // from these rather than stored separately, which cannot drift.
    refundedQuantity: integer("refunded_quantity").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("idx_order_items_order_id").on(table.orderId),
    productIdIdx: index("idx_order_items_product_id").on(table.productId),
  })
);

// ============================================
// SHOPPING CART TABLE
// ============================================

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Unique for now, which preserves exactly the current "one cart per
    // user" behaviour. Dropping this constraint is what would later allow
    // saved or multiple carts; nothing else needs to change for that.
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    // SET NULL, deliberately not cascade: deleting a coupon must not delete
    // the carts that referenced it.
    couponId: uuid("coupon_id").references(() => coupons.id, {
      onDelete: "set null",
    }),
    // These three move together. Either all are set or all are null.
    couponAppliedAt: timestamp("coupon_applied_at"),
    couponCheckedAt: timestamp("coupon_checked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_carts_user_id").on(table.userId),
  })
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    quantity: integer("quantity").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    cartIdIdx: index("idx_cart_items_cart_id").on(table.cartId),
    productIdIdx: index("idx_cart_product_id").on(table.productId),
  })
);

// ============================================
// WISHLIST TABLE
// ============================================

export const wishlist = pgTable(
  "wishlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_wishlist_user_id").on(table.userId),
    productIdIdx: index("idx_wishlist_product_id").on(table.productId),
    uniqueWishlistIdx: uniqueIndex("idx_wishlist_unique").on(
      table.userId,
      table.productId
    ),
  })
);

// ============================================
// REVIEWS TABLE
// ============================================

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    rating: integer("rating").notNull(),
    title: varchar("title", { length: 255 }),
    comment: text("comment"),
    isVerifiedPurchase: boolean("is_verified_purchase")
      .default(false)
      .notNull(),
    isApproved: boolean("is_approved").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("idx_reviews_product_id").on(table.productId),
    userIdIdx: index("idx_reviews_user_id").on(table.userId),
    isApprovedIdx: index("idx_reviews_is_approved").on(table.isApproved),
  })
);

// ============================================
// COUPONS TABLE
// ============================================

export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    description: text("description"),
    discountType: discountTypeEnum("discount_type").notNull(),
    discountValue: decimal("discount_value", {
      precision: 10,
      scale: 2,
    }).notNull(),
    minPurchaseAmount: decimal("min_purchase_amount", {
      precision: 10,
      scale: 2,
    }),
    maxDiscountAmount: decimal("max_discount_amount", {
      precision: 10,
      scale: 2,
    }),
    usageLimit: integer("usage_limit"),
    usageCount: integer("usage_count").default(0).notNull(),
    perUserLimit: integer("per_user_limit").default(1).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    startsAt: timestamp("starts_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index("idx_coupons_code").on(table.code),
    isActiveIdx: index("idx_coupons_is_active").on(table.isActive),
  })
);

// ============================================
// COUPON USAGES TABLE (Per-user tracking)
// ============================================

export const couponUsages = pgTable(
  "coupon_usages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    couponIdIdx: index("idx_coupon_usages_coupon_id").on(table.couponId),
    userIdIdx: index("idx_coupon_usages_user_id").on(table.userId),
    uniqueUsageIdx: uniqueIndex("idx_coupon_usages_unique").on(
      table.couponId,
      table.userId,
      table.orderId
    ),
  })
);

// ============================================
// PAYMENTS TABLE
// ============================================

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentStatus: paymentStatusEnum("payment_status")
      .default("pending")
      .notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    // EGP, not USD. A literal rather than STORE_CURRENCY because a column
    // default has to be stable across environments — if it read the env var,
    // `db:push` would propose a schema change whenever the var differed.
    // Rows written before this default was corrected say USD though they were
    // charged in EGP; drizzle/0003_backfill_currency.sql fixes them.
    currency: varchar("currency", { length: 3 }).default("EGP").notNull(),
    transactionId: varchar("transaction_id", { length: 255 }),
    paymentGatewayResponse: text("payment_gateway_response"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("idx_payments_order_id").on(table.orderId),
    paymentStatusIdx: index("idx_payments_status").on(table.paymentStatus),
    transactionIdIdx: index("idx_payments_transaction_id").on(
      table.transactionId
    ),
  })
);

// ============================================
// INVENTORY LOGS TABLE
// ============================================

export const inventoryLogs = pgTable(
  "inventory_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    changeType: inventoryChangeTypeEnum("change_type").notNull(),
    quantityChange: integer("quantity_change").notNull(),
    previousQuantity: integer("previous_quantity").notNull(),
    newQuantity: integer("new_quantity").notNull(),
    reason: text("reason"),
    /**
     * `SET NULL` rather than the default `NO ACTION`.
     *
     * The audit row must outlive the account that caused it — an inventory
     * movement is a fact about stock, not about a user — but the constraint as
     * written made it outlive the account by *preventing the deletion*, which
     * is the one outcome nobody wants. Losing the attribution is the intended
     * trade; losing the row, or being unable to delete a customer at all, is
     * not. Note this fires for customers too: `createdBy` is set to the buyer
     * on every `sale` row written during checkout.
     */
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    variantIdIdx: index("idx_inventory_variant_id").on(table.variantId),
    createdAtIdx: index("idx_inventory_created_at").on(table.createdAt),
  })
);

// ============================================
// ADMIN NOTIFICATIONS TABLE
// ============================================

export const adminNotifications = pgTable(
  "admin_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    notificationType: notificationTypeEnum("notification_type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    relatedEntityId: uuid("related_entity_id"),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    adminUserIdIdx: index("idx_notifications_admin_user_id").on(
      table.adminUserId
    ),
    isReadIdx: index("idx_notifications_is_read").on(table.isRead),
    createdAtIdx: index("idx_notifications_created_at").on(table.createdAt),
  })
);

// ============================================
// USER NOTIFICATIONS TABLE
// ============================================

export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    notificationType: userNotificationTypeEnum("notification_type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_user_notifications_user_id").on(table.userId),
    isReadIdx: index("idx_user_notifications_is_read").on(table.isRead),
    createdAtIdx: index("idx_user_notifications_created_at").on(
      table.createdAt
    ),
  })
);

// ============================================
// CMS: SITE SETTINGS TABLE
// ============================================

/**
 * Core site settings - strongly typed fields for store configuration.
 * Single row table (singleton pattern).
 */
export const siteSettings = pgTable("site_settings", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Store Identity
  storeName: varchar("store_name", { length: 255 })
    .notNull()
    .default("Valkyrie"),
  storeTagline: varchar("store_tagline", { length: 255 }),
  logoUrl: varchar("logo_url", { length: 500 }),
  faviconUrl: varchar("favicon_url", { length: 500 }),

  // Contact
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),

  // Social Links
  instagramUrl: varchar("instagram_url", { length: 255 }),
  facebookUrl: varchar("facebook_url", { length: 255 }),
  twitterUrl: varchar("twitter_url", { length: 255 }),
  tiktokUrl: varchar("tiktok_url", { length: 255 }),

  // Store Settings
  //
  // Read by nothing: currency is deployment config in `src/lib/currency.ts`,
  // because a Stripe account is bound to the currency it charges in and every
  // stored price is denominated in it — switching is a migration, not a
  // dropdown. The defaults are corrected anyway so this row stops contradicting
  // what the store actually does.
  currency: varchar("currency", { length: 3 }).notNull().default("EGP"),
  locale: varchar("locale", { length: 10 }).notNull().default("en-EG"),
  timezone: varchar("timezone", { length: 50 })
    .notNull()
    .default("Africa/Cairo"),

  // SEO Defaults
  defaultMetaTitle: varchar("default_meta_title", { length: 255 }),
  defaultMetaDescription: text("default_meta_description"),

  // Timestamps
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
});

// ============================================
// CMS: CONTENT SECTIONS TABLE
// ============================================

/**
 * Flexible content sections with JSON content.
 * Each section type has one active configuration.
 * Content is validated via Zod schemas in application layer.
 */
export const contentSections = pgTable(
  "content_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionType: varchar("section_type", { length: 50 }).notNull().unique(),
    content: text("content").notNull(), // JSON stringified, validated by Zod
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    version: integer("version").default(1).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    sectionTypeIdx: uniqueIndex("idx_content_sections_type").on(
      table.sectionType
    ),
    isActiveIdx: index("idx_content_sections_is_active").on(table.isActive),
  })
);

// ============================================
// CMS: CONTENT SECTIONS HISTORY TABLE
// ============================================

/**
 * Version history for content sections.
 * Automatically populated when content is updated.
 * Enables one-click revert to previous versions.
 */
export const contentSectionsHistory = pgTable(
  "content_sections_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => contentSections.id, { onDelete: "cascade" }),
    sectionType: varchar("section_type", { length: 50 }).notNull(),
    content: text("content").notNull(), // JSON stringified
    version: integer("version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    sectionIdIdx: index("idx_content_history_section_id").on(table.sectionId),
    versionIdx: index("idx_content_history_version").on(table.version),
  })
);

// ============================================
// CMS: FEATURED ITEMS TABLE
// ============================================

/**
 * Featured products and categories for homepage sections.
 * Managed by admin, displayed on storefront.
 */
export const featuredItems = pgTable(
  "featured_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemType: varchar("item_type", { length: 20 }).notNull(), // 'product' | 'category'
    itemId: uuid("item_id").notNull(), // References products.id or categories.id
    section: varchar("section", { length: 50 }).notNull(), // 'homepage_featured', 'homepage_new_arrivals', etc.
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    sectionIdx: index("idx_featured_section").on(
      table.section,
      table.isActive,
      table.displayOrder
    ),
    itemIdx: index("idx_featured_item").on(table.itemType, table.itemId),
  })
);

// ============================================
// TYPE EXPORTS
// ============================================

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;

export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;

export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;

export type Wishlist = typeof wishlist.$inferSelect;
export type NewWishlist = typeof wishlist.$inferInsert;

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;

export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;

export type CouponUsage = typeof couponUsages.$inferSelect;
export type NewCouponUsage = typeof couponUsages.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type InventoryLog = typeof inventoryLogs.$inferSelect;
export type NewInventoryLog = typeof inventoryLogs.$inferInsert;

export type AdminNotification = typeof adminNotifications.$inferSelect;
export type NewAdminNotification = typeof adminNotifications.$inferInsert;

export type UserNotification = typeof userNotifications.$inferSelect;
export type NewUserNotification = typeof userNotifications.$inferInsert;

// CMS Types
export type SiteSettings = typeof siteSettings.$inferSelect;
export type NewSiteSettings = typeof siteSettings.$inferInsert;

export type ContentSection = typeof contentSections.$inferSelect;
export type NewContentSection = typeof contentSections.$inferInsert;

export type ContentSectionHistory = typeof contentSectionsHistory.$inferSelect;
export type NewContentSectionHistory =
  typeof contentSectionsHistory.$inferInsert;

export type FeaturedItem = typeof featuredItems.$inferSelect;
export type NewFeaturedItem = typeof featuredItems.$inferInsert;

// ============================================
// NEWSLETTER SUBSCRIBERS TABLE
// ============================================

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("idx_newsletter_email").on(table.email),
    isActiveIdx: index("idx_newsletter_is_active").on(table.isActive),
  })
);

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type NewNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert;

// ============================================
// RELATIONS (for self-referencing and complex joins)
// ============================================

// Moved to src/db/relations.ts to avoid circular initialization issues
