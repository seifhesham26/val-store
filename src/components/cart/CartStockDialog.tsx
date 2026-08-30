"use client";

/**
 * Cart Stock Dialog
 *
 * Shown the moment the cart stops matching what is on the shelf.
 *
 * A toast at the final checkout button was the wrong answer twice over: too
 * late to do anything about, and gone before it could be read. This says which
 * item, which variant, how many are actually left, why it changed — and gives
 * the customer every route out of it: take what is left, drop the line, or
 * switch to a variant that is in stock.
 */

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { useCartStock } from "@/components/providers/cart-stock-provider";
import type { CartStockLine } from "@/application/cart/use-cases/check-cart-stock.use-case";

export function CartStockDialog() {
  const { problems, isDialogOpen, closeDialog } = useCartStock();
  const utils = trpc.useUtils();
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [isFixingAll, setIsFixingAll] = useState(false);

  const sync = async () => {
    await Promise.all([
      utils.public.cart.get.invalidate(),
      utils.public.cart.stockStatus.invalidate(),
    ]);
  };

  const updateQuantity = trpc.public.cart.updateQuantity.useMutation();
  const removeItem = trpc.public.cart.remove.useMutation();
  const changeVariant = trpc.public.cart.changeVariant.useMutation();

  const run = async (lineId: string, action: () => Promise<unknown>) => {
    setBusyLine(lineId);
    try {
      await action();
      await sync();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update your cart"
      );
    } finally {
      setBusyLine(null);
    }
  };

  const handleKeepAvailable = (line: CartStockLine) =>
    run(line.cartItemId, () =>
      updateQuantity.mutateAsync({
        cartItemId: line.cartItemId,
        quantity: line.available,
      })
    );

  const handleRemove = (line: CartStockLine) =>
    run(line.cartItemId, () =>
      removeItem.mutateAsync({ cartItemId: line.cartItemId })
    );

  const handleSwitch = (line: CartStockLine, variantId: string) =>
    run(line.cartItemId, () =>
      changeVariant.mutateAsync({ cartItemId: line.cartItemId, variantId })
    );

  /**
   * Apply the obvious fix to every line at once: keep what is left, drop the
   * rest. Deliberately does not pick a substitute variant on the customer's
   * behalf — that is a choice, not a correction.
   */
  const handleFixAll = async () => {
    setIsFixingAll(true);
    try {
      for (const line of problems) {
        if (line.available > 0) {
          await updateQuantity.mutateAsync({
            cartItemId: line.cartItemId,
            quantity: line.available,
          });
        } else {
          await removeItem.mutateAsync({ cartItemId: line.cartItemId });
        }
      }
      await sync();
      toast.success("Cart updated to match what is in stock");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update your cart"
      );
    } finally {
      setIsFixingAll(false);
    }
  };

  const soldOutCount = problems.filter((l) => l.available <= 0).length;
  const isBusy = busyLine !== null || isFixingAll;

  return (
    <Dialog
      open={isDialogOpen && problems.length > 0}
      onOpenChange={(open) => !open && closeDialog()}
    >
      <DialogContent className="sm:max-w-lg border-white/10 bg-zinc-900 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            {soldOutCount === problems.length
              ? problems.length === 1
                ? "An item sold out"
                : "Some items sold out"
              : "Your cart needs an update"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Stock changed while{" "}
            {problems.length === 1 ? "this was" : "these were"} in your cart.
            Choose what to do before checking out.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] -mx-1 px-1">
          <ul className="space-y-3">
            {problems.map((line) => {
              const soldOut = line.available <= 0;
              const lineBusy = busyLine === line.cartItemId;

              return (
                <li
                  key={line.cartItemId}
                  className="rounded-lg border border-white/10 bg-black/40 p-3"
                >
                  <div className="flex gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-white/5">
                      {line.productImage ? (
                        <Image
                          src={line.productImage}
                          alt={line.productName}
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ShoppingBag className="h-6 w-6 text-gray-600" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">
                        {line.productName}
                      </p>
                      {line.variantLabel && (
                        <p className="mt-0.5 text-sm text-gray-400">
                          {line.variantLabel}
                        </p>
                      )}

                      <p className="mt-2 text-sm">
                        <span className="text-gray-500">In your cart</span>{" "}
                        <span className="font-medium tabular-nums">
                          {line.requested}
                        </span>
                        <span className="mx-2 text-gray-700">·</span>
                        <span className="text-gray-500">Available</span>{" "}
                        <span
                          className={`font-medium tabular-nums ${
                            soldOut ? "text-red-400" : "text-amber-400"
                          }`}
                        >
                          {soldOut ? "none" : line.available}
                        </span>
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {!soldOut && (
                          <Button
                            size="sm"
                            className="h-8 bg-val-accent text-white hover:bg-val-accent/90"
                            disabled={isBusy}
                            onClick={() => handleKeepAvailable(line)}
                          >
                            {lineBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>Keep {line.available}</>
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                          disabled={isBusy}
                          onClick={() => handleRemove(line)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>

                  {line.alternatives.length > 0 && (
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Available in
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {line.alternatives.map((alt) => (
                          <button
                            key={alt.variantId}
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleSwitch(line, alt.variantId)}
                            className="group flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-sm transition-colors hover:border-val-accent hover:bg-val-accent/10 disabled:opacity-50"
                          >
                            <span>{alt.label}</span>
                            <span className="text-xs text-gray-500">
                              {alt.available} left
                            </span>
                            {alt.sameSize && (
                              <span
                                className="text-[10px] uppercase tracking-wide text-val-accent"
                                title="Same size you chose"
                              >
                                same size
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            disabled={isBusy}
            onClick={closeDialog}
          >
            Decide later
          </Button>
          <Button
            className="bg-val-accent text-white hover:bg-val-accent/90"
            disabled={isBusy}
            onClick={handleFixAll}
          >
            {isFixingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Update my cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
