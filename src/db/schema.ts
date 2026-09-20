import {
  check,
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  date,
  foreignKey,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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

export const inventoryAdjustmentCategoryEnum = pgEnum(
  "inventory_adjustment_category",
  ["damaged", "missing", "extra"]
);
export const inventoryAdjustmentStatusEnum = pgEnum(
  "inventory_adjustment_status",
  ["pending", "approved", "rejected"]
);
export const inventoryInspectionStatusEnum = pgEnum(
  "inventory_inspection_status",
  ["pending", "all_fine", "flaw_reported"]
);

// Admin notification type enum
export const notificationTypeEnum = pgEnum("notification_type", [
  "new_order",
  "low_stock",
  "new_review",
  "failed_payment",
  "new_customer",
  "inventory_request",
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
  "return_update",
]);

export const returnRequestStatusEnum = pgEnum("return_request_status", [
  "requested",
  "awaiting_customer_evidence",
  "pickup_authorized",
  "pickup_pending",
  "in_transit",
  "received",
  "count_disputed",
  "inspection_pending",
  "awaiting_customer_confirmation",
  "disputed",
  "customer_action_required",
  "confirmed",
  "recorded",
  "rejected",
  "evidence_exception",
]);

export const returnReasonEnum = pgEnum("return_reason", [
  "change_of_mind",
  "defective",
  "wrong_item",
  "not_as_described",
  "late_delivery",
]);

export const returnInspectionOutcomeEnum = pgEnum("return_inspection_outcome", [
  "unworn",
  "worn_resellable",
  "defective",
  "customer_damage",
  "damaged_quarantine",
  "missing_not_received",
]);

export const returnPhysicalStatusEnum = pgEnum("return_physical_status", [
  "pending",
  "in_transit",
  "received",
  "resellable",
  "quarantined",
  "missing",
  "mixed",
]);

export const returnPayoutStatusEnum = pgEnum("return_payout_status", [
  "pending",
  "succeeded",
  "failed",
  "unknown",
]);

export const returnEvidenceStatusEnum = pgEnum("return_evidence_status", [
  "pending",
  "complete",
  "exception",
]);

export const returnEvidenceKindEnum = pgEnum("return_evidence_kind", [
  "customer_product_photo",
  "customer_package_photo",
  "courier_handoff_video",
  "receiving_inspection_video",
  "payout_proof",
  "cash_receipt",
]);

export const returnEvidenceValidationEnum = pgEnum(
  "return_evidence_validation",
  ["pending", "valid", "invalid", "missing", "corrupt", "exception"]
);

export const returnPackageEventKindEnum = pgEnum("return_package_event_kind", [
  "customer_declaration",
  "courier_handoff",
  "receiving_count",
  "second_count",
  "correction",
]);

export const returnFaultEnum = pgEnum("return_fault", [
  "customer",
  "carrier",
  "valkyrie",
  "unresolved",
]);

export const returnCarrierClaimStatusEnum = pgEnum(
  "return_carrier_claim_status",
  ["open", "resolved", "refunded_after_deadline"]
);

export const returnPayoutProviderEnum = pgEnum("return_payout_provider", [
  "opay",
  "cash",
  "e_wallet",
]);

export const returnPickupMethodEnum = pgEnum("return_pickup_method", [
  "courier",
  "in_store",
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
// CUSTOMER-DATA ACCESS AUDIT
// ============================================

/**
 * Append-only record of staff access to customer data.
 *
 * Actor identity is snapshotted so a later account rename or deletion cannot
 * make an investigation unreadable. Customer values are deliberately absent:
 * this table records access to a field group, never the phone/address itself.
 */
export const customerDataAccessAudits = pgTable(
  "customer_data_access_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").notNull(),
    actorName: varchar("actor_name", { length: 255 }),
    actorEmail: varchar("actor_email", { length: 255 }).notNull(),
    actorRole: userRoleEnum("actor_role").notNull(),
    subjectUserId: text("subject_user_id"),
    orderId: uuid("order_id"),
    action: varchar("action", {
      length: 32,
      enum: [
        "order_view",
        "delivery_reveal",
        "customer_lookup",
        "customer_reveal",
        "order_export",
      ],
    }).notNull(),
    fieldGroup: varchar("field_group", {
      length: 32,
      enum: [
        "order_summary",
        "shipping_contact",
        "customer_history",
        "customer_contact",
        "bulk_order_data",
      ],
    }).notNull(),
    reason: varchar("reason", {
      length: 32,
      enum: [
        "order_fulfillment",
        "customer_support",
        "delivery_issue",
        "account_correction",
        "order_status",
        "delivery_problem",
        "return_exchange",
        "operations_export",
        "other",
      ],
    }).notNull(),
    reasonNote: text("reason_note"),
    confirmedCustomerRequest: boolean("confirmed_customer_request")
      .default(false)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    actorCreatedIdx: index("idx_customer_access_actor_created").on(
      table.actorUserId,
      table.createdAt
    ),
    subjectCreatedIdx: index("idx_customer_access_subject_created").on(
      table.subjectUserId,
      table.createdAt
    ),
    orderCreatedIdx: index("idx_customer_access_order_created").on(
      table.orderId,
      table.createdAt
    ),
    createdAtIdx: index("idx_customer_access_created_at").on(table.createdAt),
  })
);

// ============================================
// CUSTOMERS TABLE (Real Human Identity)
// ============================================

/**
 * Customer represents a real human, identified by normalized phone number.
 * The approved launch identity rule is one normalized phone per account.
 */
export const customers = pgTable("customers", {
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
});

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
    refundedShippingAmount: decimal("refunded_shipping_amount", {
      precision: 10,
      scale: 2,
    })
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
    statusIdx: index("idx_orders_status").on(table.status),
    createdAtIdx: index("idx_orders_created_at").on(table.createdAt),
    couponIdIdx: index("idx_orders_coupon_id").on(table.couponId),
    shippingAddressIdIdx: index("idx_orders_shipping_address_id").on(
      table.shippingAddressId
    ),
    billingAddressIdIdx: index("idx_orders_billing_address_id").on(
      table.billingAddressId
    ),
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
    variantIdIdx: index("idx_order_items_variant_id").on(table.variantId),
  })
);

// ============================================
// RETURNS, EVIDENCE, AND PAYOUTS
// ============================================

export const returnRequests = pgTable(
  "return_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    reviewerId: text("reviewer_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: returnRequestStatusEnum("status").default("requested").notNull(),
    reason: returnReasonEnum("reason").notNull(),
    customerNote: text("customer_note"),
    reviewNote: text("review_note"),
    pickupMethod: returnPickupMethodEnum("pickup_method"),
    physicalStatus: returnPhysicalStatusEnum("physical_status")
      .default("pending")
      .notNull(),
    evidenceStatus: returnEvidenceStatusEnum("evidence_status")
      .default("pending")
      .notNull(),
    payoutStatus: returnPayoutStatusEnum("payout_status"),
    carrierClaimStatus: returnCarrierClaimStatusEnum("carrier_claim_status"),
    proposalVersion: integer("proposal_version").default(0).notNull(),
    packageCount: integer("package_count"),
    packageSealed: boolean("package_sealed"),
    evidenceDueAt: timestamp("evidence_due_at"),
    handoffDueAt: timestamp("handoff_due_at"),
    pickupAuthorizedAt: timestamp("pickup_authorized_at"),
    proposalOpenedAt: timestamp("proposal_opened_at"),
    acknowledgedAt: timestamp("acknowledged_at"),
    confirmedAt: timestamp("confirmed_at"),
    recordedAt: timestamp("recorded_at"),
    rejectedAt: timestamp("rejected_at"),
    disputedAt: timestamp("disputed_at"),
    disputeReason: text("dispute_reason"),
    disputeLevel: integer("dispute_level").default(0).notNull(),
    customerActionRequiredAt: timestamp("customer_action_required_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("idx_return_requests_order_id").on(table.orderId),
    customerIdIdx: index("idx_return_requests_customer_id").on(
      table.customerId
    ),
    reviewerIdIdx: index("idx_return_requests_reviewer_id").on(
      table.reviewerId
    ),
    statusCreatedIdx: index("idx_return_requests_status_created").on(
      table.status,
      table.createdAt
    ),
  })
);

export const returnRequestItems = pgTable(
  "return_request_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),
    requestedQuantity: integer("requested_quantity").notNull(),
    receivedQuantity: integer("received_quantity").default(0).notNull(),
    inspectedQuantity: integer("inspected_quantity").default(0).notNull(),
    approvedQuantity: integer("approved_quantity").default(0).notNull(),
    returnedQuantity: integer("returned_quantity").default(0).notNull(),
    restockedQuantity: integer("restocked_quantity").default(0).notNull(),
    refundedQuantity: integer("refunded_quantity").default(0).notNull(),
    outcome: returnInspectionOutcomeEnum("outcome"),
    fault: returnFaultEnum("fault"),
    itemRefund: decimal("item_refund", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    requestIdIdx: index("idx_return_request_items_request_id").on(
      table.requestId
    ),
    orderItemIdIdx: index("idx_return_request_items_order_item_id").on(
      table.orderItemId
    ),
    requestOrderItemUnique: uniqueIndex(
      "uq_return_request_items_request_order_item"
    ).on(table.requestId, table.orderItemId),
  })
);

export const returnProposals = pgTable(
  "return_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    itemRefund: decimal("item_refund", { precision: 10, scale: 2 }).notNull(),
    deliveryRefund: decimal("delivery_refund", {
      precision: 10,
      scale: 2,
    }).notNull(),
    collectionDue: decimal("collection_due", {
      precision: 10,
      scale: 2,
    }).notNull(),
    totalRefund: decimal("total_refund", { precision: 10, scale: 2 }).notNull(),
    payoutDestination: varchar("payout_destination", { length: 64 }),
    customerCopy: text("customer_copy").notNull(),
    calculation: jsonb("calculation").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    requestIdIdx: index("idx_return_proposals_request_id").on(table.requestId),
    createdByIdx: index("idx_return_proposals_created_by").on(table.createdBy),
    requestVersionUnique: uniqueIndex("uq_return_proposals_request_version").on(
      table.requestId,
      table.version
    ),
  })
);

export const returnEvidence = pgTable(
  "return_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "cascade" }),
    kind: returnEvidenceKindEnum("kind").notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull().unique(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    contentHash: varchar("content_hash", { length: 128 }),
    originalMetadata: jsonb("original_metadata"),
    uploaderId: text("uploader_id").references(() => user.id, {
      onDelete: "set null",
    }),
    uploaderRole: userRoleEnum("uploader_role").notNull(),
    validationState: returnEvidenceValidationEnum("validation_state")
      .default("pending")
      .notNull(),
    validationNote: text("validation_note"),
    validatedBy: text("validated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    validatedAt: timestamp("validated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    requestIdIdx: index("idx_return_evidence_request_id").on(table.requestId),
    uploaderIdIdx: index("idx_return_evidence_uploader_id").on(
      table.uploaderId
    ),
    validatedByIdx: index("idx_return_evidence_validated_by").on(
      table.validatedBy
    ),
  })
);

export const returnPackageEvents = pgTable(
  "return_package_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "cascade" }),
    kind: returnPackageEventKindEnum("kind").notNull(),
    packageCount: integer("package_count").notNull(),
    itemCount: integer("item_count"),
    sealIntact: boolean("seal_intact"),
    note: text("note"),
    recordedBy: text("recorded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    correctionOfId: uuid("correction_of_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    requestIdIdx: index("idx_return_package_events_request_id").on(
      table.requestId
    ),
    recordedByIdx: index("idx_return_package_events_recorded_by").on(
      table.recordedBy
    ),
    correctionOfIdx: index("idx_return_package_events_correction_of").on(
      table.correctionOfId
    ),
    correctionOfFk: foreignKey({
      columns: [table.correctionOfId],
      foreignColumns: [table.id],
      name: "return_package_events_correction_of_fk",
    }).onDelete("restrict"),
  })
);

export const returnPayouts = pgTable(
  "return_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "restrict" }),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => returnProposals.id, { onDelete: "restrict" }),
    provider: returnPayoutProviderEnum("provider").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 })
      .notNull()
      .unique(),
    originalPaymentReference: varchar("original_payment_reference", {
      length: 255,
    }),
    providerReference: varchar("provider_reference", { length: 255 }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    status: returnPayoutStatusEnum("status").default("pending").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    fallbackMethod: returnPayoutProviderEnum("fallback_method"),
    proofStorageKey: varchar("proof_storage_key", { length: 500 }),
    lastAttemptAt: timestamp("last_attempt_at"),
    succeededAt: timestamp("succeeded_at"),
    failedAt: timestamp("failed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    requestIdIdx: index("idx_return_payouts_request_id").on(table.requestId),
    proposalIdIdx: index("idx_return_payouts_proposal_id").on(table.proposalId),
    statusIdx: index("idx_return_payouts_status").on(table.status),
  })
);

export const returnCarrierClaims = pgTable(
  "return_carrier_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .unique()
      .references(() => returnRequests.id, { onDelete: "restrict" }),
    status: returnCarrierClaimStatusEnum("status").default("open").notNull(),
    fault: returnFaultEnum("fault").default("unresolved").notNull(),
    missingQuantity: integer("missing_quantity").notNull(),
    openedAt: timestamp("opened_at").defaultNow().notNull(),
    deadlineAt: timestamp("deadline_at").notNull(),
    resolvedAt: timestamp("resolved_at"),
    refundedAt: timestamp("refunded_at"),
    outcomeNote: text("outcome_note"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    requestIdIdx: index("idx_return_carrier_claims_request_id").on(
      table.requestId
    ),
    createdByIdx: index("idx_return_carrier_claims_created_by").on(
      table.createdBy
    ),
  })
);

export const returnOtpChallenges = pgTable(
  "return_otp_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "cascade" }),
    proposalVersion: integer("proposal_version").notNull(),
    codeHash: varchar("code_hash", { length: 128 }).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    invalidatedAt: timestamp("invalidated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    requestIdIdx: index("idx_return_otp_challenges_request_id").on(
      table.requestId
    ),
    activeChallengeIdx: index("idx_return_otp_challenges_active").on(
      table.requestId,
      table.expiresAt
    ),
  })
);

// ============================================
// SHOPPING CART TABLE
// ============================================

// No explicit index on `user_id`: the `.unique()` on the column already
// creates a unique btree, and every lookup in the cart repository is
// keyed on it. A second index would be the same tree maintained twice on
// every write.
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
    couponIdIdx: index("idx_carts_coupon_id").on(table.couponId),
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
    variantIdIdx: index("idx_cart_items_variant_id").on(table.variantId),
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
    orderIdIdx: index("idx_coupon_usages_order_id").on(table.orderId),
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
    createdByIdx: index("idx_inventory_created_by").on(table.createdBy),
    createdAtIdx: index("idx_inventory_created_at").on(table.createdAt),
  })
);

// ============================================
// INVENTORY INSPECTIONS TABLE
// ============================================

export const inventoryInspections = pgTable(
  "inventory_inspections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    productName: varchar("product_name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 100 }).notNull(),
    size: varchar("size", { length: 50 }),
    color: varchar("color", { length: 50 }),
    triggerStock: integer("trigger_stock").notNull(),
    status: inventoryInspectionStatusEnum("status")
      .default("pending")
      .notNull(),
    completedBy: text("completed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    completedByName: varchar("completed_by_name", { length: 255 }),
    completedAt: timestamp("completed_at"),
    cycleEndedAt: timestamp("cycle_ended_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    variantIdx: index("idx_inventory_inspections_variant").on(table.variantId),
    completedByIdx: index("idx_inventory_inspections_completed_by").on(
      table.completedBy
    ),
    openVariantIdx: uniqueIndex("idx_inventory_inspections_open_variant")
      .on(table.variantId)
      .where(
        sql`${table.cycleEndedAt} IS NULL AND ${table.variantId} IS NOT NULL`
      ),
  })
);

// ============================================
// INVENTORY ADJUSTMENT REQUESTS TABLE
// ============================================

export const inventoryAdjustmentRequests = pgTable(
  "inventory_adjustment_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    inspectionId: uuid("inspection_id"),
    requesterId: text("requester_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewerId: text("reviewer_id").references(() => user.id, {
      onDelete: "set null",
    }),
    inventoryLogId: uuid("inventory_log_id"),
    productName: varchar("product_name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 100 }).notNull(),
    size: varchar("size", { length: 50 }),
    color: varchar("color", { length: 50 }),
    category: inventoryAdjustmentCategoryEnum("category").notNull(),
    requestedQuantity: integer("requested_quantity").notNull(),
    explanation: text("explanation").notNull(),
    stockAtRequest: integer("stock_at_request").notNull(),
    status: inventoryAdjustmentStatusEnum("status")
      .default("pending")
      .notNull(),
    approvedQuantity: integer("approved_quantity"),
    decisionExplanation: text("decision_explanation"),
    requesterName: varchar("requester_name", { length: 255 }).notNull(),
    reviewerName: varchar("reviewer_name", { length: 255 }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    inspectionReference: foreignKey({
      name: "inventory_requests_inspection_id_fk",
      columns: [table.inspectionId],
      foreignColumns: [inventoryInspections.id],
    }).onDelete("set null"),
    inventoryLogReference: foreignKey({
      name: "inventory_requests_inventory_log_id_fk",
      columns: [table.inventoryLogId],
      foreignColumns: [inventoryLogs.id],
    }).onDelete("set null"),
    statusCreatedIdx: index(
      "idx_inventory_adjustment_requests_status_created"
    ).on(table.status, table.createdAt),
    variantStatusIdx: index(
      "idx_inventory_adjustment_requests_variant_status"
    ).on(table.variantId, table.status),
    requesterIdx: index("idx_inventory_adjustment_requests_requester").on(
      table.requesterId
    ),
    reviewerIdx: index("idx_inventory_adjustment_requests_reviewer").on(
      table.reviewerId
    ),
    inspectionIdx: index("idx_inventory_adjustment_requests_inspection").on(
      table.inspectionId
    ),
    inventoryLogIdx: index(
      "idx_inventory_adjustment_requests_inventory_log"
    ).on(table.inventoryLogId),
    requestedQuantityPositive: check(
      "inventory_adjustment_requests_requested_quantity_positive",
      sql`${table.requestedQuantity} > 0`
    ),
    approvedQuantityPositive: check(
      "inventory_adjustment_requests_approved_quantity_positive",
      sql`${table.approvedQuantity} IS NULL OR ${table.approvedQuantity} > 0`
    ),
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

  // Shipping
  //
  // Order value at or above which delivery is free. Store-wide, so it lives on
  // the settings singleton rather than earning a table of its own. Zero means
  // no threshold — never "everything qualifies", which is the reading that
  // would give away every delivery the moment someone cleared the field.
  freeShippingThreshold: decimal("free_shipping_threshold", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("0"),

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
// LEGAL PAGES TABLE
// ============================================

/**
 * Legal pages (returns, terms, privacy, shipping, faq).
 * Slugs come from the closed set in `src/domain/legal/legal-slugs.ts`.
 */
export const legalPages = pgTable("legal_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  bodyMarkdown: text("body_markdown").notNull(),
  effectiveDate: date("effective_date").notNull(),
  version: integer("version").default(1).notNull(),
  isPublished: boolean("is_published").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
});

// ============================================
// LEGAL PAGES HISTORY TABLE
// ============================================

/**
 * Version history for legal pages.
 * Written in the same transaction as the update.
 */
export const legalPagesHistory = pgTable(
  "legal_pages_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => legalPages.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 64 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    bodyMarkdown: text("body_markdown").notNull(),
    effectiveDate: date("effective_date").notNull(),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    pageIdIdx: index("idx_legal_history_page_id").on(table.pageId),
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

export type CustomerDataAccessAudit =
  typeof customerDataAccessAudits.$inferSelect;
export type NewCustomerDataAccessAudit =
  typeof customerDataAccessAudits.$inferInsert;

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

export type InventoryInspection = typeof inventoryInspections.$inferSelect;
export type NewInventoryInspection = typeof inventoryInspections.$inferInsert;

export type InventoryAdjustmentRequest =
  typeof inventoryAdjustmentRequests.$inferSelect;
export type NewInventoryAdjustmentRequest =
  typeof inventoryAdjustmentRequests.$inferInsert;

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
// SHIPPING RATES TABLE
// ============================================

/**
 * Delivery fee per governorate.
 *
 * One row per Egyptian governorate, keyed on the code from
 * `@/domain/shipping/egypt-governorates`. Rates were briefly environment
 * variables, which meant changing a courier price required a deploy and put the
 * numbers somewhere the person who knows them could not reach.
 *
 * `is_deliverable` is separate from a zero fee on purpose: zero means "we
 * deliver here for free", false means "we do not deliver here at all". Charging
 * nothing and refusing to go are different answers and the checkout needs to
 * tell them apart.
 */
export const shippingRates = pgTable("shipping_rates", {
  governorate: varchar("governorate", { length: 64 }).primaryKey(),
  fee: decimal("fee", { precision: 10, scale: 2 }).notNull().default("0"),
  isDeliverable: boolean("is_deliverable").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
});

export type LegalPage = typeof legalPages.$inferSelect;
export type NewLegalPage = typeof legalPages.$inferInsert;

export type LegalPageHistory = typeof legalPagesHistory.$inferSelect;

export type ShippingRate = typeof shippingRates.$inferSelect;
export type NewShippingRate = typeof shippingRates.$inferInsert;

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
    isActiveIdx: index("idx_newsletter_is_active").on(table.isActive),
  })
);

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type NewNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert;

// ============================================
// RELATIONS (for self-referencing and complex joins)
// ============================================

// Moved to src/db/relations.ts to avoid circular initialization issues
