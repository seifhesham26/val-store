"use client";

/**
 * Close Order Dialog — cancelling an order, or recording a return against it.
 *
 * The two are not the same shape, and treating them as one was the flaw in the
 * first version.
 *
 * **Cancelling** happens before anything ships. Nothing was sent, so nothing
 * comes back: one number per line, how much stock to release.
 *
 * **A return** has two independent numbers per line — how many units the
 * customer is refunded for, and how many of those are fit to sell again. A
 * damaged shirt is money back but not stock back. And a customer may send back
 * one of three: the order is then *partly* refunded, stays open, and the other
 * two remain returnable later.
 */

import { useEffect, useMemo, useState } from "react";
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
import { formatCurrency } from "@/lib/currency";

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

export type CloseConfirmation =
  | {
      action: "cancelled";
      reason: string;
      restock: { orderItemId: string; quantity: number }[];
    }
  | {
      action: "refunded";
      reason: string;
      lines: { orderItemId: string; returned: number; restocked: number }[];
    };

interface CloseOrderDialogProps {
  order: OrderData;
  action: CloseAction | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: CloseConfirmation) => void;
}

/** A stepper bounded to [0, max], showing the ceiling rather than hiding it. */
function Stepper({
  value,
  max,
  label,
  disabled,
  onChange,
}: {
  value: number;
  max: number;
  label: string;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        disabled={disabled || value <= 0}
        onClick={() => onChange(value - 1)}
        aria-label={`One fewer ${label}`}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <span className="w-12 text-center text-sm font-medium tabular-nums">
        {value}
        <span className="text-muted-foreground">/{max}</span>
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        aria-label={`One more ${label}`}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
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

  // Cancelling can only move stock for lines tied to a variant. Orders placed
  // before variant tracking have no stock record, so they are shown but not
  // restockable.
  const trackedItems = useMemo(
    () => order.items.filter((item) => item.variantId),
    [order.items]
  );

  // A return is bounded by what is left to return, not by what was ordered — an
  // earlier partial return has already used some of it up.
  const returnableItems = useMemo(
    () =>
      order.items
        .map((item) => ({
          ...item,
          remaining: Math.max(0, item.quantity - item.refundedQuantity),
        }))
        .filter((item) => item.remaining > 0),
    [order.items]
  );

  const [restock, setRestock] = useState<Record<string, number>>({});
  const [returned, setReturned] = useState<Record<string, number>>({});
  const [resellable, setResellable] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Default to the whole thing coming back each time the dialog opens.
  useEffect(() => {
    if (!action) return;
    setRestock(
      Object.fromEntries(trackedItems.map((item) => [item.id, item.quantity]))
    );
    setReturned(
      Object.fromEntries(
        returnableItems.map((item) => [item.id, item.remaining])
      )
    );
    setResellable(
      Object.fromEntries(
        returnableItems.map((item) => [
          item.id,
          item.variantId && order.status !== "cancelled" ? item.remaining : 0,
        ])
      )
    );
    setReason("");
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, order.id]);

  const setRestockQuantity = (itemId: string, next: number, max: number) =>
    setRestock((current) => ({
      ...current,
      [itemId]: Math.max(0, Math.min(next, max)),
    }));

  const setReturnedQuantity = (itemId: string, next: number, max: number) => {
    const clamped = Math.max(0, Math.min(next, max));
    setReturned((current) => ({ ...current, [itemId]: clamped }));
    // Stock cannot come back for units that are not being returned.
    setResellable((current) => ({
      ...current,
      [itemId]: Math.min(current[itemId] ?? 0, clamped),
    }));
  };

  const setResellableQuantity = (itemId: string, next: number, max: number) =>
    setResellable((current) => ({
      ...current,
      [itemId]: Math.max(0, Math.min(next, max)),
    }));

  // --- Cancel totals -------------------------------------------------------
  const totalRestocked = Object.values(restock).reduce((a, b) => a + b, 0);
  const totalTracked = trackedItems.reduce((sum, i) => sum + i.quantity, 0);
  const withheld = totalTracked - totalRestocked;

  // Cancelling already put every unit back, so a refund recorded afterwards
  // moves money only — restocking again would count the same units twice.
  const stockAlreadyReturned = order.status === "cancelled";

  // --- Return totals -------------------------------------------------------
  // Line prices are pre-discount but the customer paid post-discount, so scale
  // by what the order actually charged. Mirrors `OrderEntity.refundValue`.
  const paidFraction =
    order.discount > 0 && order.subtotal > 0
      ? Math.max(0, (order.subtotal - order.discount) / order.subtotal)
      : 1;

  const refundValue =
    Math.round(
      returnableItems.reduce(
        (sum, item) => sum + item.price * (returned[item.id] ?? 0),
        0
      ) *
        paidFraction *
        100
    ) / 100;
  const totalReturned = returnableItems.reduce(
    (sum, item) => sum + (returned[item.id] ?? 0),
    0
  );
  const totalResellable = returnableItems.reduce(
    (sum, item) => sum + (resellable[item.id] ?? 0),
    0
  );
  const notResellable = totalReturned - totalResellable;

  // Does this return close the order out entirely?
  const completesOrder = order.items.every((item) => {
    const taken = returned[item.id] ?? 0;
    return item.refundedQuantity + taken >= item.quantity;
  });

  const handleConfirm = () => {
    const combined = [reason, notes.trim()].filter(Boolean).join(" — ");

    if (isRefund) {
      onConfirm({
        action: "refunded",
        reason: combined,
        lines: returnableItems.map((item) => {
          const take = Math.min(returned[item.id] ?? 0, item.remaining);
          return {
            orderItemId: item.id,
            returned: take,
            // Never claim more stock back than units returned — the server
            // rejects that outright rather than clamping.
            restocked: stockAlreadyReturned
              ? 0
              : Math.min(resellable[item.id] ?? 0, take),
          };
        }),
      });
      return;
    }

    onConfirm({
      action: "cancelled",
      reason: combined,
      restock: trackedItems.map((item) => ({
        orderItemId: item.id,
        quantity: Math.min(Math.max(0, restock[item.id] ?? 0), item.quantity),
      })),
    });
  };

  const canConfirm = Boolean(reason) && (!isRefund || totalReturned > 0);

  return (
    <Dialog open={!!action} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isRefund ? "Record a return" : "Cancel order"}
          </DialogTitle>
          <DialogDescription>
            {isRefund
              ? "Choose what the customer sent back, and how much of it can be sold again."
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

          {isRefund ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label>What came back</Label>
                <span className="text-xs text-muted-foreground">
                  {totalReturned} unit{totalReturned === 1 ? "" : "s"} ·{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatCurrency(refundValue)}
                  </span>
                </span>
              </div>

              {returnableItems.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Every unit on this order has already been returned.
                </p>
              ) : (
                <ul className="space-y-2">
                  {returnableItems.map((item) => {
                    const take = returned[item.id] ?? 0;
                    const back = resellable[item.id] ?? 0;

                    return (
                      <li key={item.id} className="rounded-md border p-2">
                        <div className="flex items-center gap-3">
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
                              {formatCurrency(item.price)} each
                              {item.refundedQuantity > 0 &&
                                ` · ${item.refundedQuantity} already returned`}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground">
                              Refund the customer for
                            </span>
                            <Stepper
                              value={take}
                              max={item.remaining}
                              label={`${item.productName} returned`}
                              onChange={(next) =>
                                setReturnedQuantity(
                                  item.id,
                                  next,
                                  item.remaining
                                )
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground">
                              Of those, put back on sale
                            </span>
                            {stockAlreadyReturned ? (
                              <span className="text-xs text-muted-foreground">
                                already back in stock
                              </span>
                            ) : item.variantId ? (
                              <Stepper
                                value={back}
                                max={take}
                                label={`${item.productName} resellable`}
                                onChange={(next) =>
                                  setResellableQuantity(item.id, next, take)
                                }
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                no stock record
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {stockAlreadyReturned && (
                <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                  This order was cancelled, so its stock is already back. This
                  records the money only.
                </p>
              )}

              {!stockAlreadyReturned && notResellable > 0 && (
                <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {notResellable} returned unit
                    {notResellable === 1 ? "" : "s"} will not go back on sale.
                    The customer is still refunded for
                    {notResellable === 1 ? " it" : " them"}.
                  </span>
                </p>
              )}

              {returnableItems.length > 0 && !completesOrder && (
                <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                  This is a partial return. The order stays open and the rest
                  can be returned later.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label>Return to stock</Label>
                <span className="text-xs text-muted-foreground">
                  {totalRestocked} of {totalTracked} units
                </span>
              </div>

              {trackedItems.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  None of these items are linked to a stock record, so nothing
                  can be returned to inventory.
                </p>
              ) : (
                <ul className="space-y-2">
                  {trackedItems.map((item) => (
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

                      <Stepper
                        value={restock[item.id] ?? 0}
                        max={item.quantity}
                        label={item.productName}
                        onChange={(next) =>
                          setRestockQuantity(item.id, next, item.quantity)
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}

              {withheld > 0 && (
                <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {withheld} unit{withheld === 1 ? "" : "s"} will not go back
                    on sale. Use this for damaged or missing items — the
                    shortfall stays out of inventory.
                  </span>
                </p>
              )}
            </div>
          )}
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
            disabled={isPending || !canConfirm}
          >
            {isPending
              ? "Working..."
              : isRefund
                ? `Refund ${formatCurrency(refundValue)}`
                : "Cancel order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
