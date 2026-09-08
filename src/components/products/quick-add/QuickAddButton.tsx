"use client";

import { ShoppingCart, Check, LogIn } from "lucide-react";

interface QuickAddButtonProps {
  isAuthenticated: boolean;
  inStock: boolean;
  /** In stock, but the cart already holds every available unit. */
  atCeiling: boolean;
  /** How many are already in the cart, for the at-ceiling label. */
  inCartQuantity: number;
  /** Units queued locally that the server has not confirmed yet. */
  pendingAdded: number;
  onAdd: (e: React.MouseEvent) => void;
}

export function QuickAddButton({
  isAuthenticated,
  inStock,
  atCeiling,
  inCartQuantity,
  pendingAdded,
  onAdd,
}: QuickAddButtonProps) {
  if (!isAuthenticated) {
    return (
      <a
        href={`/login?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-center gap-1 w-full bg-val-accent hover:bg-val-accent/90 text-white text-[10px] py-2 rounded-md font-semibold transition-colors"
      >
        <LogIn className="h-3 w-3" />
        Sign In
      </a>
    );
  }

  // Two different stops, two different words: nothing left to sell, versus the
  // customer already holding all of it. "Sold Out" for the second would be a
  // lie about the product.
  const stopped = !inStock || atCeiling;

  return (
    <button
      onClick={onAdd}
      // Never disabled merely because a write is in flight — the press is a
      // local write, and a button that goes dead between presses is the whole
      // problem this replaces.
      disabled={stopped}
      className={`flex items-center justify-center gap-1 w-full text-[10px] py-2 rounded-md font-semibold transition-all duration-200 ${
        stopped
          ? "bg-gray-700 text-gray-400 cursor-not-allowed"
          : pendingAdded > 0
            ? "bg-green-600 text-white"
            : "bg-white text-black hover:bg-val-silver"
      }`}
    >
      {!inStock ? (
        "Sold Out"
      ) : atCeiling ? (
        `All ${inCartQuantity} in cart`
      ) : pendingAdded > 0 ? (
        <>
          <Check className="h-3 w-3" />
          Added {pendingAdded}
        </>
      ) : (
        <>
          <ShoppingCart className="h-3 w-3" />
          Add
        </>
      )}
    </button>
  );
}
