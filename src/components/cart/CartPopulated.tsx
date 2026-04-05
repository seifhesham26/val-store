"use client";

import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartItem } from "@/components/cart/CartItem";
import { CartSummary } from "@/components/cart/CartSummary";
import { useCart } from "@/components/providers/cart-provider";

export function CartPopulated() {
  const {
    items,
    isSyncing,
    itemCount,
    subtotal,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

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
          disabled={isSyncing}
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
                disabled={isSyncing}
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
        <div className="lg:col-span-1">
          <CartSummary
            subtotal={subtotal}
            itemCount={itemCount}
            isLoading={isSyncing}
          />
        </div>
      </div>
    </div>
  );
}
