"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Package, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/providers/cart-provider";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const orderId = searchParams.get("order_id");
  const { clearCart } = useCart();
  const { isPending } = useSession();
  const hasCleared = useRef(false);

  const orderNumberByIdQuery = trpc.public.orders.getOrderNumberById.useQuery(
    { orderId: orderId ?? "" },
    { enabled: Boolean(orderId) }
  );

  const orderNumberBySessionQuery =
    trpc.public.orders.getOrderNumberByStripeSession.useQuery(
      { sessionId: sessionId ?? "" },
      { enabled: Boolean(sessionId) && !orderId }
    );

  const orderNumber =
    orderNumberByIdQuery.data?.orderNumber ??
    orderNumberBySessionQuery.data?.orderNumber ??
    null;

  // Clear local cart on success
  useEffect(() => {
    if (!isPending && !hasCleared.current) {
      clearCart();
      hasCleared.current = true;
    }
  }, [clearCart, isPending]);

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

        {orderNumber ? (
          <p className="mb-6 text-sm text-muted-foreground">
            Order number: {orderNumber}
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
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
