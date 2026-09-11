"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Package, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ValkyrieLoader } from "@/components/ui/valkyrie-loader";
import { trpc } from "@/lib/trpc";
import { useCartStore } from "@/lib/stores/cart-store";
import {
  resolveCheckoutOutcome,
  shouldClearCartOnArrival,
} from "@/lib/checkout-outcome";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const utils = trpc.useUtils();
  const hasCleared = useRef(false);

  const clearLocalCart = useCartStore((state) => state.clearCart);

  const orderNumberQuery = trpc.public.orders.getOrderNumberById.useQuery(
    { orderId: orderId ?? "" },
    { enabled: Boolean(orderId) }
  );

  useEffect(() => {
    if (hasCleared.current) return;
    hasCleared.current = true;

    if (shouldClearCartOnArrival({ orderId })) {
      // The order was already emptied server-side. Mirror that locally
      // straight away, then re-sync to confirm.
      clearLocalCart();
      utils.public.cart.get.invalidate();
      utils.public.cart.stockStatus.invalidate();
    }
    // Runs once on mount; the ref guards against re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const outcome = resolveCheckoutOutcome({ orderId });

  if (outcome !== "placed") {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full border border-white/10 bg-[#111] p-4">
              <Package className="h-10 w-10 text-val-accent" />
            </div>
          </div>

          <h1 className="mb-4 text-2xl font-bold">
            There&apos;s no order to show here
          </h1>
          <p className="mb-8 text-muted-foreground">
            This page confirms an order once you&apos;ve checked out. It looks
            like you arrived without one — an old link or a refreshed page will
            do it.
          </p>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/account/orders">
                View orders
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Continue shopping</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-green-100 p-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
        </div>

        <h1 className="mb-4 text-3xl font-bold">Thank you for your order!</h1>

        <p className="mb-6 text-muted-foreground">
          Your order has been placed successfully. You&apos;ll receive a
          confirmation email shortly.
        </p>

        {orderNumberQuery.data?.orderNumber ? (
          <p className="mb-6 text-sm text-muted-foreground">
            Order number: {orderNumberQuery.data.orderNumber}
          </p>
        ) : null}

        <div className="mb-8 rounded-lg bg-[#111] border border-white/10 p-6 text-white">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Package className="h-5 w-5 text-val-accent" />
            <span className="font-medium text-white">What happens next?</span>
          </div>
          <ul className="space-y-2 text-left text-sm text-gray-400">
            <li>• You&apos;ll receive an order confirmation email</li>
            <li>• We&apos;ll prepare your items for shipping</li>
            <li>• You&apos;ll get tracking info when shipped</li>
          </ul>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/">
              Continue Shopping
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/account/orders">View Orders</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <ValkyrieLoader size="md" label="Loading" />
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
