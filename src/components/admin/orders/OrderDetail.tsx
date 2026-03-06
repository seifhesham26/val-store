"use client";

/**
 * Order Detail Component
 *
 * Displays full order information with status management.
 * Uses tRPC queries and mutations for data fetching and updates.
 */

import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

import { SummaryCard } from "./detail/SummaryCard";
import { PaymentCard } from "./detail/PaymentCard";
import { TimelineCard } from "./detail/TimelineCard";
import { ItemsCard } from "./detail/ItemsCard";
import { AddressesCard } from "./detail/AddressesCard";
import { UpdateStatusCard, STATUS_OPTIONS } from "./detail/UpdateStatusCard";

interface OrderDetailProps {
  orderId: string;
}

export function OrderDetail({ orderId }: OrderDetailProps) {
  const utils = trpc.useUtils();

  const { data: order, isLoading } = trpc.admin.orders.getById.useQuery({
    id: orderId,
  });

  const updateStatusMutation = trpc.admin.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Order status updated");
      utils.admin.orders.getById.invalidate({ id: orderId });
      utils.admin.orders.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  const handleStatusChange = (newStatus: string) => {
    updateStatusMutation.mutate({
      id: orderId,
      status: newStatus as (typeof STATUS_OPTIONS)[number],
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Order not found</p>
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
      <AddressesCard order={order} />

      {/* Actions */}
      <UpdateStatusCard
        order={order}
        isPending={updateStatusMutation.isPending}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
