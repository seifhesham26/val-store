"use client";

/**
 * Close Order Dialog — cancelling or refunding an order.
 *
 * Both actions end the order and hand stock back, and neither is safe to do
 * blindly: a cancelled order may be partly picked, and a refunded one may come
 * back damaged. So the admin confirms, line by line, how much of each item
 * actually returns to sale, and records why.
 *
 * Anything not restocked stays out of inventory — the difference shows up as
 * shrinkage rather than silently reappearing as sellable stock.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Minus, Package, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { OrderData } from "./types";

export type CloseAction = "cancelled" | "refunded";

const CANCEL_REASONS = [
  "Customer changed their mind",
  "Item out of stock",
  "Payment problem",
  "Suspected fraud",
  "Delivery not possible",
  "Duplicate order",
] as const;

const REFUND_REASONS = [
  "Item arrived damaged",
  "Wrong item sent",
  "Item not as described",
  "Customer returned the item",
  "Late delivery",
  "Goodwill",
] as const;

interface CloseOrderDialogProps {
  order: OrderData;
  action: CloseAction | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: {
    reason: string;
    restock: { orderItemId: string; quantity: number }[];
  }) => void;
}

export function CloseOrderDialog({
  order,
  action,
  isPending,
  onOpenChange,
  onConfirm,
}: CloseOrderDialogProps) {
  const isRefund = action === "refunded";
  const reasons = isRefund ? REFUND_REASONS : CANCEL_REASONS;

  // Only lines tied to a variant can move stock. Older orders predate variant
  // tracking, so they are shown but not restockable.
  const trackedItems = order.items.filter((item) => item.variantId);

  const [restock, setRestock] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Default to returning everything each time the dialog opens.
  useEffect(() => {
    if (!action) return;
    setRestock(
      Object.fromEntries(trackedItems.map((item) => [item.id, item.quantity]))
    );
    setReason("");
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, order.id]);

  const setQuantity = (itemId: string, next: number, max: number) =>
    setRestock((current) => ({
      ...current,
      [itemId]: Math.max(0, Math.min(next, max)),
    }));

  const totalRestocked = Object.values(restock).reduce((a, b) => a + b, 0);
  const totalTracked = trackedItems.reduce((sum, i) => sum + i.quantity, 0);
  const withheld = totalTracked - totalRestocked;

  const handleConfirm = () => {
    const combined = [reason, notes.trim()].filter(Boolean).join(" — ");
    onConfirm({
      reason: combined,
      restock: trackedItems.map((item) => ({
        orderItemId: item.id,
        quantity: restock[item.id] ?? 0,
      })),
    });
  };

  return (
    <Dialog open={!!action} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isRefund ? "Refund order" : "Cancel order"}
          </DialogTitle>
          <DialogDescription>
            {isRefund
              ? "Record why this order is being refunded and how much of it returns to sale."
              : "Record why this order is being cancelled and how much of it returns to sale."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="close-notes">Notes (optional)</Label>
            <Textarea
              id="close-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth recording against this order..."
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>Return to stock</Label>
              <span className="text-xs text-muted-foreground">
                {totalRestocked} of {totalTracked} units
              </span>
            </div>

            {trackedItems.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                None of these items are linked to a stock record, so nothing can
                be returned to inventory.
              </p>
            ) : (
              <ul className="space-y-2">
                {trackedItems.map((item) => {
                  const value = restock[item.id] ?? 0;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-md border p-2"
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                        {item.productImage ? (
                          <Image
                            src={item.productImage}
                            alt={item.productName}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.productName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.variantDetails
                            ? `${item.variantDetails} · `
                            : ""}
                          ordered {item.quantity}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={value <= 0}
                          onClick={() =>
                            setQuantity(item.id, value - 1, item.quantity)
                          }
                          aria-label={`Restock one fewer ${item.productName}`}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-7 text-center text-sm font-medium tabular-nums">
                          {value}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={value >= item.quantity}
                          onClick={() =>
                            setQuantity(item.id, value + 1, item.quantity)
                          }
                          aria-label={`Restock one more ${item.productName}`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {withheld > 0 && (
              <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {withheld} unit{withheld === 1 ? "" : "s"} will not go back on
                  sale. Use this for damaged or missing items — the shortfall
                  stays out of inventory.
                </span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Keep order
          </Button>
          <Button
            variant={isRefund ? "default" : "destructive"}
            onClick={handleConfirm}
            disabled={isPending || !reason}
          >
            {isPending
              ? "Working..."
              : isRefund
                ? "Refund order"
                : "Cancel order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
