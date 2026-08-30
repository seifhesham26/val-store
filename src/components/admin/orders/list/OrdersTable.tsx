"use client";

import { trpc } from "@/lib/trpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { useImperativeHandle } from "react";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import type { OrderFilters } from "./OrdersListHeader";
import type { AppRouter } from "@/server";
import type { inferRouterOutputs } from "@trpc/server";

type OrderRow =
  inferRouterOutputs<AppRouter>["admin"]["orders"]["list"]["orders"][number];

type OrderStatus =
  | "pending"
  | "processing"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

const statusStyles: Record<OrderStatus, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  processing:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  shipped:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  delivered:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  cancelled:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  refunded:
    "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

const ITEMS_PER_PAGE = 10;

export interface OrdersTableHandle {
  getOrders: () => OrderRow[];
}

export function OrdersTable({
  filters,
  tableRef,
}: {
  filters: OrderFilters;
  tableRef?: React.RefObject<OrdersTableHandle | null>;
}) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.admin.orders.list.useInfiniteQuery(
      {
        limit: ITEMS_PER_PAGE,
        status: filters.status === "all" ? undefined : filters.status,
        refundableOnly: filters.refundableOnly || undefined,
        returnedOnly: filters.returnedOnly || undefined,
      },
      {
        getNextPageParam: (lastPage) => {
          if (lastPage.page < lastPage.totalPages) {
            return lastPage.page + 1;
          }
          return undefined;
        },
        initialCursor: 1,
      }
    );

  // Flatten all pages
  const allOrders = data?.pages.flatMap((page) => page.orders) || [];

  // Client-side because the list endpoint has no search argument. Matches
  // everything the row displays, so what you type finds what you can see.
  const search = filters.search.trim().toLowerCase();
  const orders = search
    ? allOrders.filter((order) =>
        [
          order.orderNumber,
          order.customerName,
          order.customerEmail,
          order.id,
        ].some((field) => field?.toLowerCase().includes(search))
      )
    : allOrders;

  const total = search ? orders.length : (data?.pages[0]?.total ?? 0);

  useImperativeHandle(tableRef, () => ({ getOrders: () => orders }), [orders]);

  // Infinite scroll
  const { ref: sentinelRef } = useInfiniteScroll({
    onLoadMore: () => fetchNextPage(),
    enabled: hasNextPage && !isFetchingNextPage,
  });

  if (isLoading) {
    return (
      <div className="rounded-md border p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Orders count */}
      <p className="text-sm text-muted-foreground">
        Showing {orders.length} of {total} orders
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Returned</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders && orders.length > 0 ? (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {/* Pre-`orderNumber` rows fall back to the id so the cell is
                        never blank. */}
                    {order.orderNumber ?? order.id.slice(0, 8).toUpperCase()}
                  </TableCell>
                  <TableCell>
                    {order.customerName ? (
                      <div className="leading-tight">
                        <div className="font-medium">{order.customerName}</div>
                        {order.customerEmail && (
                          <div className="text-xs text-muted-foreground">
                            {order.customerEmail}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        Deleted account
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{order.totalItems}</TableCell>
                  <TableCell>
                    {/* Once something has come back, the order total is no
                        longer what the store kept — show both. */}
                    {order.refundedAmount > 0 ? (
                      <div className="leading-tight">
                        <span className="text-muted-foreground line-through">
                          ${order.totalAmount.toFixed(2)}
                        </span>
                        <div className="font-medium">
                          ${order.netAmount.toFixed(2)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            net
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>${order.totalAmount.toFixed(2)}</>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.refundedItems > 0 ? (
                      <div className="leading-tight">
                        <Badge
                          variant="outline"
                          className={
                            order.fullyRefunded
                              ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                          }
                        >
                          {order.fullyRefunded ? "Full" : "Partial"}
                        </Badge>
                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                          -${order.refundedAmount.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {order.refundedItems} of {order.totalItems}{" "}
                          {order.totalItems === 1 ? "unit" : "units"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        order.isPaid
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                      }
                    >
                      {order.isPaid ? "Paid" : "Unpaid"}
                    </Badge>
                    {order.isRefundable && (
                      <Badge
                        variant="outline"
                        className="ml-1 bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800"
                      >
                        Refundable
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusStyles[order.status as OrderStatus]}
                    >
                      <span className="capitalize">{order.status}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/orders/${order.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <p className="text-muted-foreground">No orders found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Infinite scroll sentinel */}
      {hasNextPage && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-4"
        >
          {isFetchingNextPage ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-sm text-muted-foreground">
              Scroll for more...
            </span>
          )}
        </div>
      )}

      {/* End of list */}
      {!hasNextPage && orders.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          You&apos;ve reached the end of the list
        </p>
      )}
    </div>
  );
}
