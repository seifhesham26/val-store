"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle,
  Package,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useCartStore } from "@/lib/stores/cart-store";
import {
  resolveCheckoutOutcome,
  shouldClearCartOnArrival,
  type CheckoutOutcome,
} from "@/lib/checkout-outcome";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const orderId = searchParams.get("order_id");
  const utils = trpc.useUtils();
  const hasConfirmed = useRef(false);

  const clearLocalCart = useCartStore((state) => state.clearCart);

  // The webhook is the primary path for marking a Stripe order paid, but it can
  // be delayed, fail, or (in local development) never arrive at all. Confirming
  // here as well means the order is never left stranded at "pending" after a
  // successful payment. The mutation is idempotent.
  const confirmSession = trpc.public.checkout.confirmSession.useMutation({
    onSuccess: (result) => {
      // Empty the local cart the moment payment is confirmed, rather than
      // waiting for the refetch below to report it — otherwise the navbar badge
      // keeps showing the old count until that lands.
      //
      // Guarded on `paid`: an abandoned checkout must keep the customer's cart,
      // which is also why the unpaid outcome below sends them back to it.
      if (result.paid) clearLocalCart();
    },
    onSettled: () => {
      utils.public.cart.get.invalidate();
      utils.public.cart.stockStatus.invalidate();
      utils.public.orders.getOrderNumberByStripeSession.invalidate();
    },
  });

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

  useEffect(() => {
    if (hasConfirmed.current) return;
    hasConfirmed.current = true;

    if (sessionId) {
      confirmSession.mutate({ sessionId });
    } else if (shouldClearCartOnArrival({ sessionId, orderId })) {
      // Cash on delivery already emptied the cart server-side. Mirror that
      // locally straight away, then re-sync to confirm.
      //
      // Gated on `orderId`: without it, simply opening /checkout/success —
      // a stale bookmark, a shared link, a back-navigation that dropped the
      // query string — cleared the cart of someone who had not ordered
      // anything.
      clearLocalCart();
      utils.public.cart.get.invalidate();
      utils.public.cart.stockStatus.invalidate();
    }
    // Runs once on mount; the ref guards against re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, orderId]);

  const outcome = resolveCheckoutOutcome({
    sessionId,
    orderId,
    confirmFailed: confirmSession.isError,
    confirmResult: confirmSession.data,
  });

  if (outcome === "confirming") {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <Loader2 className="mb-6 h-10 w-10 animate-spin text-val-accent" />
          <h1 className="mb-2 text-2xl font-bold">Confirming your payment</h1>
          <p className="text-muted-foreground">
            This only takes a moment. Please don&apos;t close this page.
          </p>
        </div>
      </div>
    );
  }

  if (outcome !== "placed") {
    return <UnplacedOrder outcome={outcome} />;
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

/**
 * Everything that is not a placed order.
 *
 * Each case says what is true, what it means for the customer's money, and
 * exactly one thing to do next. None of them claims the order succeeded, and
 * none of them claims it definitely failed either — `unconfirmed` in particular
 * is genuinely unknown from here, because the Stripe webhook may still mark the
 * order paid a moment later, so telling the customer it failed would be its own
 * kind of lie.
 */
function UnplacedOrder({
  outcome,
}: {
  outcome: Exclude<CheckoutOutcome, "placed" | "confirming">;
}) {
  const copy = {
    unpaid: {
      icon: Clock,
      title: "Payment wasn't completed",
      body: "Stripe hasn't recorded a payment for this checkout, so no order has been placed and you haven't been charged. Your cart is exactly as you left it.",
      primary: { href: "/cart", label: "Back to cart" },
      secondary: { href: "/account/orders", label: "View orders" },
    },
    unconfirmed: {
      icon: AlertTriangle,
      title: "We couldn't confirm your payment",
      body: "Something went wrong while checking with the payment provider. If you were charged, your order is safe and will appear in your orders shortly — please check there before trying again, so you don't pay twice.",
      primary: { href: "/account/orders", label: "Check my orders" },
      secondary: { href: "/cart", label: "Back to cart" },
    },
    nothing: {
      icon: Package,
      title: "There's no order to show here",
      body: "This page confirms an order once you've checked out. It looks like you arrived without one — an old link or a refreshed page will do it.",
      primary: { href: "/account/orders", label: "View orders" },
      secondary: { href: "/", label: "Continue shopping" },
    },
  }[outcome];

  const Icon = copy.icon;

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full border border-white/10 bg-[#111] p-4">
            <Icon className="h-10 w-10 text-val-accent" />
          </div>
        </div>

        <h1 className="mb-4 text-2xl font-bold">{copy.title}</h1>
        <p className="mb-8 text-muted-foreground">{copy.body}</p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href={copy.primary.href}>
              {copy.primary.label}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={copy.secondary.href}>{copy.secondary.label}</Link>
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
