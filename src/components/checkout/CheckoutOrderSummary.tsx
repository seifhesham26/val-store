"use client";

import Link from "next/link";
import Image from "next/image";
import { Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useCartStore } from "@/lib/stores/cart-store";

export function CheckoutOrderSummary({
  couponCode,
  setCouponCode,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  isValidating,
  couponError,
}: {
  couponCode: string;
  setCouponCode: (code: string) => void;
  appliedCoupon: {
    code: string;
    discountAmount: number;
    discountType: string;
    discountValue: string;
  } | null;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  isValidating: boolean;
  couponError: string | null;
}) {
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const itemCount = useCartStore((state) => state.getItemCount());
  const discount = appliedCoupon?.discountAmount ?? 0;
  const total = subtotal - discount;

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
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-center">
              <p className="font-medium text-sm line-clamp-1 text-white">
                {item.productName}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Qty: {item.quantity} × ${item.productPrice.toFixed(2)}
              </p>
            </div>
            <div className="flex items-center font-bold text-white">
              ${(item.quantity * item.productPrice).toFixed(2)}
            </div>
          </div>
        ))}

        {/* Coupon Input */}
        <div className="border-t border-white/10 pt-4 mt-2">
          <Label className="text-sm font-medium text-white mb-2 block">
            Coupon Code
          </Label>
          {appliedCoupon ? (
            <div className="flex items-center justify-between mt-2 p-2 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-green-700 dark:text-green-400">
                  {appliedCoupon.code}
                </span>
                <span className="text-sm text-green-600 dark:text-green-500">
                  (
                  {appliedCoupon.discountType === "percentage"
                    ? `${appliedCoupon.discountValue}% off`
                    : `-$${appliedCoupon.discountValue}`}
                  )
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemoveCoupon}
                className="text-red-500 hover:text-red-700"
              >
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                className="flex-1 px-3 py-2 border border-white/10 bg-[#1a1a1a] text-white rounded-md text-sm uppercase placeholder:text-gray-500 focus:outline-hidden focus:border-val-accent focus:ring-1 focus:ring-val-accent"
              />
              <Button
                variant="outline"
                onClick={onApplyCoupon}
                disabled={!couponCode.trim() || isValidating}
                className="border-white/20"
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Apply"
                )}
              </Button>
            </div>
          )}
          {couponError && (
            <p className="text-sm text-red-500 mt-1">{couponError}</p>
          )}
        </div>

        <div className="border-t border-white/10 pt-4 space-y-3 mt-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Subtotal</span>
            <span className="text-white">${subtotal.toFixed(2)}</span>
          </div>
          {appliedCoupon && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-${discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Shipping</span>
            <span className="text-green-500 font-medium">Free</span>
          </div>
          <div className="flex justify-between font-bold text-xl pt-4 border-t border-white/10 mt-4">
            <span>Total</span>
            <span className="text-white">${total.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
