"use client";

/**
 * Order Detail Page
 *
 * Display full order details.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

import { OrderDetailHeader } from "@/components/account/order-detail/OrderDetailHeader";
import { OrderTimeline } from "@/components/account/order-detail/OrderTimeline";
import { OrderItems } from "@/components/account/order-detail/OrderItems";
import { OrderSummaryCard } from "@/components/account/order-detail/OrderSummaryCard";

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const { data: order, isLoading } = trpc.public.orders.getOrderById.useQuery({
    orderId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-white/[0.06] rounded w-48 animate-pulse" />
        <div className="h-64 bg-white/[0.06] rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-lg py-12 text-center">
        <p className="text-gray-400 mb-4">Order not found.</p>
        <Button
          asChild
          className="bg-val-accent hover:bg-val-accent/90 text-black font-medium"
        >
          <Link href="/account/orders">View All Orders</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OrderDetailHeader
        orderId={orderId}
        status={order.status}
        createdAt={new Date(order.createdAt)}
      />

      <OrderTimeline
        createdAt={new Date(order.createdAt)}
        shippedAt={order.shippedAt ? new Date(order.shippedAt) : null}
        deliveredAt={order.deliveredAt ? new Date(order.deliveredAt) : null}
      />

      <OrderItems items={order.items} />

      <OrderSummaryCard
        subtotal={order.subtotal}
        shippingCost={order.shippingCost}
        tax={order.tax}
        discount={order.discount}
        total={order.total}
      />
    </div>
  );
}
