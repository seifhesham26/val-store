"use client";

/**
 * Order Detail Component
 *
 * Displays full order information with status management.
 * Uses tRPC queries and mutations for data fetching and updates.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

import { SummaryCard } from "./detail/SummaryCard";
import { PaymentCard } from "./detail/PaymentCard";
import { TimelineCard } from "./detail/TimelineCard";
import { ItemsCard } from "./detail/ItemsCard";
import { AddressesCard } from "./detail/AddressesCard";
import { UpdateStatusCard } from "./detail/UpdateStatusCard";
import { CloseOrderDialog, type CloseAction } from "./detail/CloseOrderDialog";
import { ORDER_STATUSES } from "@/domain/orders/value-objects/order-status.value-object";
import { formatCurrency } from "@/lib/currency";
import type { OrderAddress } from "@/domain/orders/entities/order.entity";

interface OrderDetailProps {
  orderId: string;
  supportAccessId?: string;
}

export function OrderDetail({ orderId, supportAccessId }: OrderDetailProps) {
  const utils = trpc.useUtils();
  // Cancelling and refunding both close the order and move stock, so they go
  // through a confirmation that captures the reason and the restock split.
  const [closeAction, setCloseAction] = useState<CloseAction | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<
    OrderAddress | null | undefined
  >();

  const {
    data: order,
    isLoading,
    error: orderError,
  } = trpc.admin.orders.getById.useQuery({ id: orderId, supportAccessId });

  const revealDeliveryMutation = trpc.admin.orders.revealDelivery.useMutation({
    onSuccess: (address) => setDeliveryAddress(address),
    onError: (error) =>
      toast.error(error.message || "Failed to reveal delivery details"),
  });

  const updateStatusMutation = trpc.admin.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Order status updated");
      setCloseAction(null);
      utils.admin.orders.getById.invalidate({ id: orderId, supportAccessId });
      utils.admin.orders.list.invalidate();
      // Stock may have moved, so drop the cached figures the storefront reads.
      utils.admin.inventory.invalidate();
      utils.public.products.getStock.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  const refundMutation = trpc.admin.orders.refund.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.fullyRefunded
          ? `Order fully refunded (${formatCurrency(result.refundedTotal)})`
          : `Refunded ${formatCurrency(result.amount)} — order stays open`
      );
      setCloseAction(null);
      utils.admin.orders.getById.invalidate({ id: orderId, supportAccessId });
      utils.admin.orders.list.invalidate();
      utils.admin.inventory.invalidate();
      utils.public.products.getStock.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to record the return");
    },
  });

  const handleStatusChange = (newStatus: string) => {
    // Closing an order needs the reason/restock dialog first.
    if (newStatus === "cancelled" || newStatus === "refunded") {
      setCloseAction(newStatus);
      return;
    }

    updateStatusMutation.mutate({
      id: orderId,
      status: newStatus as (typeof ORDER_STATUSES)[number],
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orderError || !order) {
    return (
      <Card>
        <CardContent className="space-y-3 p-8 text-center">
          <p
            className={
              orderError ? "text-destructive" : "text-muted-foreground"
            }
          >
            {orderError?.message ?? "Order not found"}
          </p>
          {orderError && (
            <Link
              href="/admin/customers"
              className="text-sm font-medium underline underline-offset-4"
            >
              Return to customer support
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Order Summary & Payment Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <SummaryCard order={order} />
        <PaymentCard order={order} />
      </div>

      {/* Status Timeline */}
      <TimelineCard order={order} />

      {/* Order Items */}
      <ItemsCard order={order} />

      {/* Addresses */}
      <AddressesCard
        hasShippingAddress={order.hasShippingAddress}
        address={deliveryAddress}
        isRevealing={revealDeliveryMutation.isPending}
        onReveal={() =>
          revealDeliveryMutation.mutate({ id: orderId, supportAccessId })
        }
      />

      {/* Actions */}
      <UpdateStatusCard
        order={order}
        isPending={updateStatusMutation.isPending}
        onStatusChange={handleStatusChange}
      />

      <CloseOrderDialog
        order={order}
        action={closeAction}
        isPending={updateStatusMutation.isPending || refundMutation.isPending}
        onOpenChange={(open) => !open && setCloseAction(null)}
        onConfirm={(input) => {
          // A return is recorded per line rather than as a status change: it may
          // only cover part of the order, in which case the order stays open.
          if (input.action === "refunded") {
            refundMutation.mutate({
              id: orderId,
              reason: input.reason,
              lines: input.lines,
            });
            return;
          }

          updateStatusMutation.mutate({
            id: orderId,
            status: "cancelled",
            reason: input.reason,
            restock: input.restock,
          });
        }}
      />
    </div>
  );
}
