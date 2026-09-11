"use client";

import Link from "next/link";
import { LogIn, Truck, RefreshCw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductActionsProps {
  isAuthenticated: boolean;
  inStock?: boolean;
  /** In stock, but the cart already holds every available unit. */
  atCeiling?: boolean;
  /** How many are already in the cart, for the at-ceiling label. */
  inCartQuantity?: number;
  onAddToCart: () => void;
  details?: string[];
}

export function ProductActions({
  isAuthenticated,
  inStock,
  atCeiling = false,
  inCartQuantity = 0,
  onAddToCart,
  details,
}: ProductActionsProps) {
  return (
    <>
      {/* Add to Cart */}
      <div className="flex gap-4 mb-8">
        {!isAuthenticated ? (
          /*
           * `text-black`, not `text-white`. `--val-accent` is #94a3b8, so
           * white on it measures 2.58:1 — below the 3:1 WCAG AA floor even at
           * this size, which is why the button read as washed out. Black on
           * the same background is 8.14:1. This is the rule already recorded
           * in CLAUDE.md under the storefront button trap.
           */
          <Button
            className="flex-1 bg-val-accent py-6 text-lg font-medium text-black hover:bg-val-accent-light"
            asChild
          >
            <Link
              href={`/login?redirect=${encodeURIComponent(
                typeof window !== "undefined" ? window.location.pathname : "/"
              )}`}
            >
              <LogIn className="h-5 w-5 mr-2" />
              Sign In to Buy
            </Link>
          </Button>
        ) : (
          // No pending state: the press is a local write, so there is no round
          // trip to spin for and no reason the button should ever go dead
          // between presses. The stock ceiling is the only thing that stops it.
          <Button
            onClick={onAddToCart}
            className="flex-1 bg-white text-black hover:bg-val-silver py-6 text-lg font-medium"
            disabled={!inStock || atCeiling}
          >
            {!inStock
              ? "Out of Stock"
              : atCeiling
                ? `All ${inCartQuantity} in cart`
                : "Add to Cart"}
          </Button>
        )}
      </div>

      {/* Trust Badges */}
      <div className="grid grid-cols-3 gap-4 pt-8 border-t border-white/10">
        <div className="text-center">
          <Truck className="h-6 w-6 mx-auto text-val-accent mb-2" />
          <p className="text-xs text-gray-400">Free Shipping</p>
        </div>
        <div className="text-center">
          <RefreshCw className="h-6 w-6 mx-auto text-val-accent mb-2" />
          <p className="text-xs text-gray-400">Easy Returns</p>
        </div>
        <div className="text-center">
          <Shield className="h-6 w-6 mx-auto text-val-accent mb-2" />
          <p className="text-xs text-gray-400">Secure Payment</p>
        </div>
      </div>

      {/* Product Details */}
      {details && details.length > 0 && (
        <div className="mt-8 pt-8 border-t border-white/10">
          <h3 className="text-lg font-medium text-white mb-4">
            Product Details
          </h3>
          <ul className="space-y-2">
            {details.map((detail, idx) => (
              <li key={idx} className="text-gray-400 text-sm flex items-start">
                <span className="mr-2">•</span>
                {detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
