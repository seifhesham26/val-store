"use client";

import Link from "next/link";
import { ChevronRight, Clock, Loader2, RotateCcw } from "lucide-react";
import { usePaymentWindow } from "@/hooks/use-payment-window";
import { AppRouter } from "@/server";
import { inferRouterOutputs } from "@trpc/server";
import { formatCurrency } from "@/lib/currency";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type OrdersListType =
  RouterOutputs["public"]["orders"]["getMyOrders"]["orders"];
type Order = OrdersListType[number];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
  processing: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  paid: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
  shipped: "bg-purple-500/15 text-purple-400 border border-purple-500/20",
  delivered: "bg-green-500/15 text-green-400 border border-green-500/20",
  cancelled: "bg-red-500/15 text-red-400 border border-red-500/20",
  refunded: "bg-orange-500/15 text-orange-400 border border-orange-500/20",
};

/**
 * An unpaid card order is held for a short window and then released. Saying so
 * — with the time left — is kinder than letting it turn into "cancelled" with
 * no explanation.
 */
function PaymentCountdown({
  deadline,
}: {
  deadline: string | Date | null | undefined;
}) {
  const { open, label } = usePaymentWindow(deadline);
  if (!open) return null;

  return (
    <p className="flex items-center gap-1.5 text-xs text-amber-400">
      <Clock className="h-3 w-3 shrink-0" />
      Waiting for payment — <span className="tabular-nums">{label}</span> left
      before this order is released.
    </p>
  );
}

/**
 * What the order actually contains, in one line.
 *
 * The list previously said only "3 items", which is true of every order and
 * identifies none of them.
 */
function ItemSummary({ order }: { order: Order }) {
  const units = `${order.itemCount} item${order.itemCount === 1 ? "" : "s"}`;
  const hidden = order.lineCount - order.itemNames.length;
  const names = order.itemNames.join(", ");

  return (
    <p className="truncate text-sm text-gray-400">
      <span className="text-gray-500">{units}</span>
      {names && " · "}
      {names}
      {hidden > 0 && ` +${hidden} more`}
    </p>
  );
}

/**
 * The refund line.
 *
 * A return is partial and derived — `refundedQuantity` per line is the only
 * stored fact — so an order can carry money back without its status ever
 * becoming "refunded". That state had no visible representation at all: it
 * showed as a bare orange number under the total and nothing else.
 */
function RefundBadge({ order }: { order: Order }) {
  if (order.refundedAmount <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-400">
      <RotateCcw className="h-3 w-3 shrink-0" />
      {order.fullyRefunded ? "Fully refunded" : "Partly returned"}
      <span className="text-orange-300/80">
        · {formatCurrency(order.refundedAmount)}
      </span>
    </span>
  );
}

interface OrdersListProps {
  orders: OrdersListType;
  total: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  sentinelRef: (node: HTMLElement | null) => void;
}

export function OrdersList({
  orders,
  total,
  hasNextPage,
  isFetchingNextPage,
  sentinelRef,
}: OrdersListProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Order History</h2>
        <p className="text-gray-400">
          View and track your past orders. Showing {orders.length} of {total}.
        </p>
      </div>

      {/* `block` is load-bearing: a Link renders an inline <a>, and vertical
          margins do nothing on an inline box — so `space-y-3` collapsed and the
          cards sat flush against each other with no gap at all. */}
      <div className="space-y-3">
        {orders.map((order) => {
          const refundedItems = order.refundedItems;

          return (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="block"
            >
              <div className="cursor-pointer rounded-lg border border-white/10 bg-zinc-900 p-5 transition-colors hover:border-white/20">
                {/* Identity row: the real order number, its date, its status. */}
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-mono text-sm font-semibold tracking-tight text-white">
                      {order.orderNumber ?? `#${order.id.slice(-8)}`}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                      statusColors[order.status] || "bg-white/10 text-gray-400"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Contents and money. */}
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <ItemSummary order={order} />
                    {order.awaitingPayment && (
                      <PaymentCountdown deadline={order.paymentDeadline} />
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          order.fullyRefunded
                            ? "text-gray-500 line-through"
                            : "text-white"
                        }`}
                      >
                        {formatCurrency(order.total)}
                      </p>
                      {refundedItems > 0 && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {refundedItems} of {order.itemCount} returned
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-600" />
                  </div>
                </div>

                {order.refundedAmount > 0 && (
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <RefundBadge order={order} />
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Infinite scroll sentinel */}
      {hasNextPage && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          {isFetchingNextPage ? (
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          ) : (
            <span className="text-sm text-gray-500">Scroll for more...</span>
          )}
        </div>
      )}

      {/* End of list */}
      {!hasNextPage && orders.length > 0 && (
        <p className="py-4 text-center text-sm text-gray-500">
          You&apos;ve reached the end
        </p>
      )}
    </div>
  );
}
