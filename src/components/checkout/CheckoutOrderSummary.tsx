"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CouponField } from "@/components/cart/CouponField";
import { trpc, vanillaTrpc } from "@/lib/trpc";
import { useCartStore } from "@/lib/stores/cart-store";
import { formatCurrency } from "@/lib/currency";
import { unoptimizedFor } from "@/lib/image-hosts";

/**
 * Price the coupon the *cart* is holding.
 *
 * The cart records a code and computes no money — that is what keeps the two
 * from disagreeing — so checkout is where the discount becomes a number. This
 * is the only place in the storefront that turns the held code into one, and
 * it is display state: `CreateOrderUseCase` re-derives the discount server-side
 * from the same code, so a stale figure here can never become the charge.
 *
 * `coupons.validate` is a mutation rather than a query, so it is driven from an
 * effect keyed on the code and the subtotal — the two inputs that can change
 * what the code is worth.
 */
function useHeldCouponDiscount(subtotal: number) {
  const { data: cart } = trpc.public.cart.get.useQuery(undefined, {
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

  const code = cart?.appliedCoupon?.code ?? null;

  // The key is the pair the price depends on, and it is stored *with* the
  // amount. A figure priced for a different code or a different subtotal is
  // then discarded during render rather than lingering on the total, and the
  // "nothing applied" case needs no setState in the effect body at all.
  const pricedFor = code && subtotal > 0 ? `${code}|${subtotal}` : null;
  const [priced, setPriced] = useState<{ key: string; amount: number } | null>(
    null
  );

  // `vanillaTrpc` rather than the mutation hook: this runs from an effect, and
  // a module-scope client is a stable reference, so it cannot become a
  // dependency that refires the request it just made.
  useEffect(() => {
    if (!pricedFor || !code) return;

    // A slower earlier response must not overwrite a newer one — the subtotal
    // changes while the cart store hydrates, so two can be in flight.
    let cancelled = false;

    vanillaTrpc.public.coupons.validate
      .mutate({ code, subtotal })
      .then((result) => {
        if (cancelled) return;
        setPriced({
          key: pricedFor,
          amount:
            result.valid && "discountAmount" in result
              ? (result.discountAmount ?? 0)
              : 0,
        });
      })
      .catch(() => {
        // Showing no discount is the safe failure: the total then matches what
        // an order with no working coupon would actually cost.
        if (!cancelled) setPriced({ key: pricedFor, amount: 0 });
      });

    return () => {
      cancelled = true;
    };
  }, [pricedFor, code, subtotal]);

  const discount = priced && priced.key === pricedFor ? priced.amount : 0;

  return { code, discount };
}

export function CheckoutOrderSummary() {
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const itemCount = useCartStore((state) => state.getItemCount());

  const { code, discount } = useHeldCouponDiscount(subtotal);
  const total = Math.max(0, subtotal - discount);

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Your cart is empty</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/collections/all">Continue Shopping</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#111] border-white/10 shadow-2xl rounded-xl overflow-hidden">
      <CardHeader>
        <CardTitle className="text-white">Order Summary</CardTitle>
        <CardDescription className="text-gray-400">
          {itemCount} item{itemCount !== 1 ? "s" : ""} in your cart
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a]">
              {item.productImage ? (
                <Image
                  src={item.productImage}
                  alt={item.productName}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized={unoptimizedFor(item.productImage)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/[0.06]">
                  <ShoppingBag className="h-6 w-6 text-gray-500" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-center">
              <p className="font-medium text-sm line-clamp-1 text-white">
                {item.productName}
              </p>
              {item.variantLabel && (
                <p className="text-xs text-gray-500">{item.variantLabel}</p>
              )}
              <p className="text-sm text-gray-400 mt-1">
                Qty: {item.quantity} × {formatCurrency(item.productPrice)}
              </p>
            </div>
            <div className="flex items-center font-bold text-white">
              {formatCurrency(item.quantity * item.productPrice)}
            </div>
          </div>
        ))}

        {/* Coupon. The same field the cart uses, writing to the same place —
            a second bespoke input here is what let the two disagree. */}
        <div className="border-t border-white/10 pt-4 mt-2">
          <p className="text-sm font-medium text-white mb-2">Coupon Code</p>
          <CouponField />
        </div>

        <div className="border-t border-white/10 pt-4 space-y-3 mt-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Subtotal</span>
            <span className="text-white">{formatCurrency(subtotal)}</span>
          </div>
          {code && discount > 0 && (
            <div className="flex justify-between text-sm text-green-400">
              <span>Discount</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Shipping</span>
            <span className="text-green-500 font-medium">Free</span>
          </div>
          <div className="flex justify-between font-bold text-xl pt-4 border-t border-white/10 mt-4">
            <span className="text-white">Total</span>
            <span className="text-white">{formatCurrency(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
