/**
 * Notification icon and colour mapping
 *
 * Shared by the navbar bell and the /account/notifications page so a new
 * notification type cannot end up with a bell in one place and its real icon in
 * the other. Add a type here once and both pick it up.
 */

import {
  Bell,
  Tag,
  Package,
  Percent,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";

export const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  wishlist_sale: Tag,
  item_available: Package,
  order_update: Clock,
  price_drop: Percent,
  order_confirmed: ShoppingBag,
  order_shipped: Truck,
  order_delivered: CheckCircle,
  order_cancelled: XCircle,
  refund_processed: RefreshCw,
};

export const NOTIFICATION_COLORS: Record<string, string> = {
  wishlist_sale: "text-green-400 bg-green-500/10",
  item_available: "text-blue-400 bg-blue-500/10",
  order_update: "text-orange-400 bg-orange-500/10",
  price_drop: "text-purple-400 bg-purple-500/10",
  order_confirmed: "text-blue-400 bg-blue-500/10",
  order_shipped: "text-indigo-400 bg-indigo-500/10",
  order_delivered: "text-green-400 bg-green-500/10",
  order_cancelled: "text-red-400 bg-red-500/10",
  refund_processed: "text-amber-400 bg-amber-500/10",
};

/** Icon for a type, falling back to a plain bell for anything unmapped. */
export function notificationIcon(type: string) {
  return NOTIFICATION_ICONS[type] ?? Bell;
}

/** Colour pair for a type, falling back to neutral grey. */
export function notificationColor(type: string) {
  return NOTIFICATION_COLORS[type] ?? "text-gray-400 bg-white/[0.06]";
}
