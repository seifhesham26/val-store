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

import { Clock, MapPin } from "lucide-react";
import { usePaymentWindow } from "@/hooks/use-payment-window";
import { OrderDetailHeader } from "@/components/account/order-detail/OrderDetailHeader";
import { OrderTimeline } from "@/components/account/order-detail/OrderTimeline";
import { OrderItems } from "@/components/account/order-detail/OrderItems";
import { OrderSummaryCard } from "@/components/account/order-detail/OrderSummaryCard";
import type { AppRouter } from "@/server";
import type { inferRouterOutputs } from "@trpc/server";

type OrderDetail = NonNullable<
  inferRouterOutputs<AppRouter>["public"]["orders"]["getOrderById"]
>;

/**
 * The same countdown the orders list shows.
 *
 * This is the screen a customer would actually sit on while paying, and it
 * was the one place the payment window never reached.
 */
function PaymentCountdown({
  deadline,
}: {
  deadline: string | Date | null | undefined;
}) {
  const { open, label } = usePaymentWindow(deadline);
  if (!open) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
      <Clock className="h-4 w-4 shrink-0" />
      <span>
        Waiting for payment — <span className="tabular-nums">{label}</span> left
        before this order is released.
      </span>
    </div>
  );
}

/**
 * The shipping address was already in this payload and simply never rendered.
 */
function ShippingAddressCard({
  address,
}: {
  address: OrderDetail["shippingAddress"];
}) {
  if (!address) return null;

  const cityLine = [
    [address.city, address.state].filter((part) => part?.trim()).join(", "),
    address.postalCode,
  ]
    .filter((part) => part?.trim())
    .join(" ");

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-lg">
      <div className="p-5 border-b border-white/10">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <MapPin className="h-4 w-4 text-gray-500" />
          Shipping Address
        </h3>
      </div>
      <address className="p-5 text-sm not-italic leading-relaxed text-gray-400">
        <span className="block text-white">{address.fullName}</span>
        <span className="block">{address.addressLine1}</span>
        {address.addressLine2 && (
          <span className="block">{address.addressLine2}</span>
        )}
        <span className="block">{cityLine}</span>
        <span className="block">{address.country}</span>
        {address.phone && <span className="block pt-1">{address.phone}</span>}
      </address>
    </div>
  );
}

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
        orderNumber={order.orderNumber}
        status={order.status}
        createdAt={new Date(order.createdAt)}
      />

      <PaymentCountdown deadline={order.paymentDeadline} />

      <OrderTimeline
        createdAt={new Date(order.createdAt)}
        shippedAt={order.shippedAt ? new Date(order.shippedAt) : null}
        deliveredAt={order.deliveredAt ? new Date(order.deliveredAt) : null}
      />

      <OrderItems items={order.items} />

      <ShippingAddressCard address={order.shippingAddress} />

      <OrderSummaryCard
        subtotal={order.subtotal}
        shippingCost={order.shippingCost}
        tax={order.tax}
        discount={order.discount}
        total={order.total}
        refundedAmount={order.refundedAmount}
        fullyRefunded={order.fullyRefunded}
      />
    </div>
  );
}
