"use client";

import Link from "next/link";
import { Loader2, LogIn, Truck, RefreshCw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductActionsProps {
  isAuthenticated: boolean;
  isAdding: boolean;
  inStock?: boolean;
  onAddToCart: () => void;
  details?: string[];
}

export function ProductActions({
  isAuthenticated,
  isAdding,
  inStock,
  onAddToCart,
  details,
}: ProductActionsProps) {
  return (
    <>
      {/* Add to Cart */}
      <div className="flex gap-4 mb-8">
        {!isAuthenticated ? (
          <Button
            className="flex-1 bg-val-accent hover:bg-val-accent/90 text-white py-6 text-lg font-medium"
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
          <Button
            onClick={onAddToCart}
            className="flex-1 bg-white text-black hover:bg-val-silver py-6 text-lg font-medium"
            disabled={!inStock || isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Adding...
              </>
            ) : inStock ? (
              "Add to Cart"
            ) : (
              "Out of Stock"
            )}
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
