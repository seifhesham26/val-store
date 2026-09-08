"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartItem } from "@/components/cart/CartItem";
import { CartSummary } from "@/components/cart/CartSummary";
import { CouponField } from "@/components/cart/CouponField";
import { useCart } from "@/components/providers/cart-provider";
import { useCartStock } from "@/components/providers/cart-stock-provider";

export function CartPopulated() {
  const {
    items,
    itemCount,
    subtotal,
    updateQuantity,
    removeItem,
    clearCart,
    flushPendingWrites,
  } = useCart();

  const { hasProblems, openDialog } = useCartStock();

  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);

  // See CartDrawer: checkout waits for the server to catch up, rather than the
  // whole cart being disabled whenever it hasn't.
  const handleCheckout = async () => {
    setIsLeaving(true);
    try {
      await flushPendingWrites();
    } finally {
      setIsLeaving(false);
    }
    router.push("/checkout");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          Your Cart ({itemCount} {itemCount === 1 ? "item" : "items"})
        </h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-red-400"
          onClick={clearCart}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Cart
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-white/10 bg-zinc-900 p-4">
            {items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            ))}
          </div>

          {/* Continue Shopping */}
          <div className="mt-6">
            <Button variant="outline" asChild>
              <Link href="/collections/all">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Continue Shopping
              </Link>
            </Button>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1 space-y-4">
          {/* Above the summary: the code is entered before the totals it will
              change, and the summary itself quotes no discount — checkout
              prices the coupon. */}
          <div className="rounded-lg border border-white/10 bg-zinc-900 p-4">
            <CouponField />
          </div>
          <CartSummary
            subtotal={subtotal}
            itemCount={itemCount}
            onCheckout={handleCheckout}
            isLoading={isLeaving}
            stockBlocked={hasProblems}
            onReviewStock={openDialog}
          />
        </div>
      </div>
    </div>
  );
}
