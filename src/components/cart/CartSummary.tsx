/**
 * Cart Summary Component
 *
 * Displays cart totals and checkout button.
 */

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface CartSummaryProps {
  subtotal: number;
  itemCount: number;
  onCheckout?: () => void;
  isLoading?: boolean;
  showCheckoutButton?: boolean;
  /** Live stock no longer covers the cart — checkout is replaced by a prompt. */
  stockBlocked?: boolean;
  onReviewStock?: () => void;
}

export function CartSummary({
  subtotal,
  itemCount,
  onCheckout,
  isLoading = false,
  showCheckoutButton = true,
  stockBlocked = false,
  onReviewStock,
}: CartSummaryProps) {
  // Placeholder for shipping/tax - can be expanded later
  const shipping: number = 0; // Free shipping or calculated
  const tax: number = 0; // Calculate based on location
  const total = subtotal + shipping + tax;

  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-zinc-900 p-4">
      <h3 className="text-lg font-semibold text-white">Order Summary</h3>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Subtotal ({itemCount} items)</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex justify-between text-gray-400">
          <span>Shipping</span>
          <span>{shipping === 0 ? "Free" : formatCurrency(shipping)}</span>
        </div>

        {tax > 0 && (
          <div className="flex justify-between text-gray-400">
            <span>Tax</span>
            <span>{formatCurrency(tax)}</span>
          </div>
        )}

        <div className="border-t border-white/10 pt-2">
          <div className="flex justify-between text-base font-semibold text-white">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {showCheckoutButton && stockBlocked && (
        <Button
          className="w-full bg-amber-500 text-black font-medium hover:bg-amber-500/90"
          size="lg"
          onClick={onReviewStock}
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Review stock changes
        </Button>
      )}

      {showCheckoutButton && !stockBlocked && (
        <Button
          className="w-full bg-val-accent hover:bg-val-accent/90 text-white font-medium"
          size="lg"
          onClick={onCheckout}
          disabled={isLoading || itemCount === 0}
          asChild={!onCheckout}
        >
          {onCheckout ? (
            <>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingBag className="mr-2 h-4 w-4" />
              )}
              Proceed to Checkout
            </>
          ) : (
            <Link href="/checkout">
              <ShoppingBag className="mr-2 h-4 w-4" />
              Proceed to Checkout
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          )}
        </Button>
      )}

      <p className="text-xs text-center text-gray-500">
        Shipping and taxes calculated at checkout
      </p>
    </div>
  );
}
