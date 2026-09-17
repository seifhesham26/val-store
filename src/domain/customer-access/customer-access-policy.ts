import type { UserRole } from "@/domain/customers/value-objects/user-role";

export const ACTIVE_FULFILLMENT_STATUSES = [
  "pending",
  "processing",
  "paid",
  "shipped",
] as const;

export const HISTORICAL_ORDER_STATUSES = [
  "delivered",
  "cancelled",
  "refunded",
] as const;

const activeFulfillmentStatuses = new Set<string>(ACTIVE_FULFILLMENT_STATUSES);
const historicalOrderStatuses = new Set<string>(HISTORICAL_ORDER_STATUSES);

export const ACCESS_REASONS = [
  "order_fulfillment",
  "customer_support",
  "delivery_issue",
  "account_correction",
  "order_status",
  "delivery_problem",
  "return_exchange",
  "operations_export",
  "other",
] as const;

export type AccessReason = (typeof ACCESS_REASONS)[number];

export type AccessAction =
  | "order_view"
  | "delivery_reveal"
  | "customer_lookup"
  | "customer_reveal"
  | "order_export";

export type AccessFieldGroup =
  | "order_summary"
  | "shipping_contact"
  | "customer_history"
  | "customer_contact"
  | "bulk_order_data";

export function isActiveFulfillmentStatus(status: string): boolean {
  return activeFulfillmentStatuses.has(status);
}

export function isHistoricalOrderStatus(status: string): boolean {
  return historicalOrderStatuses.has(status);
}

export function canBrowseCustomerDirectory(role: UserRole): boolean {
  return role === "admin" || role === "super_admin";
}

export function canExportOrders(role: UserRole): boolean {
  return role === "admin" || role === "super_admin";
}

export function canReviewAccessFor(
  viewerRole: UserRole,
  actorRole: UserRole,
  isSameUser = false
): boolean {
  if (viewerRole === "super_admin") return true;
  if (viewerRole === "admin") return actorRole !== "customer";
  if (viewerRole === "worker") return isSameUser;
  return false;
}
