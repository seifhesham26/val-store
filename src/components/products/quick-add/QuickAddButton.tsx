"use client";

import { ShoppingCart, Check, Loader2, LogIn } from "lucide-react";

interface QuickAddButtonProps {
  isAuthenticated: boolean;
  isAdding: boolean;
  justAdded: boolean;
  inStock: boolean;
  onAdd: (e: React.MouseEvent) => void;
}

export function QuickAddButton({
  isAuthenticated,
  isAdding,
  justAdded,
  inStock,
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

  return (
    <button
      onClick={onAdd}
      disabled={isAdding || !inStock}
      className={`flex items-center justify-center gap-1 w-full text-[10px] py-2 rounded-md font-semibold transition-all duration-200 ${
        !inStock
          ? "bg-gray-700 text-gray-400 cursor-not-allowed"
          : justAdded
            ? "bg-green-600 text-white"
            : "bg-white text-black hover:bg-val-silver"
      }`}
    >
      {isAdding ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Adding
        </>
      ) : justAdded ? (
        <>
          <Check className="h-3 w-3" />
          Added!
        </>
      ) : !inStock ? (
        "Sold Out"
      ) : (
        <>
          <ShoppingCart className="h-3 w-3" />
          Add
        </>
      )}
    </button>
  );
}
