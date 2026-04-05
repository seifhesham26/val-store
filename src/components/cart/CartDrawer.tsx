/**
 * Cart Drawer Component
 *
 * Slide-out drawer showing cart contents.
 * Uses Sheet component from shadcn/ui.
 */

"use client";

import Link from "next/link";
import { ShoppingBag, ArrowRight, ShoppingCart } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CartItem } from "./CartItem";
import { useCart } from "@/components/providers/cart-provider";

export function CartDrawer() {
  const {
    items,
    isOpen,
    isSyncing,
    itemCount,
    subtotal,
    isEmpty,
    isAuthenticated,
    updateQuantity,
    removeItem,
    closeCart,
  } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col bg-zinc-950 border-l border-white/10 sm:max-w-md"
      >
        <SheetHeader className="border-b border-white/10 px-4 py-4">
          <SheetTitle className="flex items-center gap-2 text-white">
            <ShoppingCart className="h-5 w-5" />
            Your Cart ({itemCount})
          </SheetTitle>
        </SheetHeader>

        {/* Cart Content */}
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <ShoppingBag className="h-16 w-16 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Your cart is empty
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              {isAuthenticated
                ? "Add some items to get started!"
                : "Sign in to sync your cart across devices"}
            </p>
            <Button
              onClick={closeCart}
              asChild
              className="bg-val-accent hover:bg-val-accent/90 text-black font-medium"
            >
              <Link href="/collections/all">
                Continue Shopping
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <ScrollArea className="flex-1 px-4">
              <div className="divide-y divide-white/10">
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
            </ScrollArea>

            {/* Footer with Summary */}
            <SheetFooter className="border-t border-white/10 px-4 py-4">
              <div className="w-full space-y-4">
                {/* Subtotal */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-lg font-semibold text-white">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  Shipping and taxes calculated at checkout
                </p>

                {/* Checkout Button */}
                <Button
                  className="w-full bg-val-accent hover:bg-val-accent/90 text-black font-medium"
                  size="lg"
                  asChild
                  disabled={isSyncing}
                >
                  <Link href="/checkout" onClick={closeCart}>
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Checkout
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                {/* View Cart Button */}
                <Button
                  variant="outline"
                  className="w-full border-white/10 hover:bg-white/4 hover:text-white"
                  asChild
                >
                  <Link href="/cart" onClick={closeCart}>
                    View Full Cart
                  </Link>
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
