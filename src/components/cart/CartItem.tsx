/**
 * Cart Item Component
 *
 * Displays a single cart item with image, name, price, and quantity controls.
 */

"use client";

import Image from "next/image";
import { AlertTriangle, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStock } from "@/components/providers/cart-stock-provider";
import type { CartItem as CartItemType } from "@/lib/stores/cart-store";
import { formatCurrency } from "@/lib/currency";
import { unoptimizedFor } from "@/lib/image-hosts";

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (cartItemId: string, quantity: number) => void;
  onRemove: (cartItemId: string) => void;
  disabled?: boolean;
}

export function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
  disabled = false,
}: CartItemProps) {
  const { availableFor } = useCartStock();

  // The live figure wins; the quantity baked into the cart payload is only a
  // fallback for the moment before the first check lands.
  const ceiling = availableFor(item.id) ?? item.maxStock;
  const soldOut = ceiling <= 0;
  const overCeiling = !soldOut && item.quantity > ceiling;

  const canDecrease = item.quantity > 1;
  // Previously `maxStock === 0` was read as "no limit", which let a sold-out
  // line be incremented freely.
  const canIncrease = item.quantity < ceiling;

  const handleDecrease = () => {
    if (canDecrease) {
      onUpdateQuantity(item.id, item.quantity - 1);
    }
  };

  const handleIncrease = () => {
    if (canIncrease) {
      onUpdateQuantity(item.id, item.quantity + 1);
    }
  };

  const subtotal = item.productPrice * item.quantity;

  return (
    <div className="flex gap-4 py-4 border-b border-white/10">
      {/* Product Image */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-gray-800">
        {item.productImage ? (
          <Image
            src={item.productImage}
            alt={item.productName}
            fill
            sizes="96px"
            className="object-cover"
            unoptimized={unoptimizedFor(item.productImage)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            <span className="text-xs">No image</span>
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <h3 className="text-sm font-medium text-white line-clamp-2">
            {item.productName}
          </h3>
          {item.variantLabel && (
            <p className="mt-0.5 text-xs text-gray-500">{item.variantLabel}</p>
          )}
          {(soldOut || overCeiling) && (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-400">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {soldOut ? "Out of stock" : `Only ${ceiling} left`}
            </p>
          )}
          <p className="mt-1 text-sm text-gray-400">
            {formatCurrency(item.productPrice)}
          </p>
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-full border-white/20 bg-transparent hover:bg-white/10"
              onClick={handleDecrease}
              disabled={disabled || !canDecrease}
            >
              <Minus className="h-3 w-3 text-white" />
            </Button>

            <span className="w-8 text-center text-sm font-medium text-white">
              {item.quantity}
            </span>

            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-full border-white/20 bg-transparent hover:bg-white/10"
              onClick={handleIncrease}
              disabled={disabled || !canIncrease}
            >
              <Plus className="h-3 w-3 text-white" />
            </Button>
          </div>

          {/* Subtotal & Remove */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-white">
              {formatCurrency(subtotal)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-red-400"
              onClick={() => onRemove(item.id)}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
