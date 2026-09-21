"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Minus, Package, Plus } from "lucide-react";
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
import type { OrderData } from "./types";

export type CloseAction = "cancelled";
export type CloseConfirmation = {
  action: "cancelled";
  reason: string;
  restock: { orderItemId: string; quantity: number }[];
};

const CANCEL_REASONS = [
  "Customer changed their mind",
  "Item out of stock",
  "Payment problem",
  "Suspected fraud",
  "Delivery not possible",
  "Duplicate order",
] as const;

function Stepper({
  value,
  max,
  label,
  onChange,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        disabled={value <= 0}
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
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        aria-label={`One more ${label}`}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

/** Cancellation only. Evidence-backed returns are reviewed in /admin/returns. */
export function CloseOrderDialog({
  order,
  action,
  isPending,
  onOpenChange,
  onConfirm,
}: {
  order: OrderData;
  action: CloseAction | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: CloseConfirmation) => void;
}) {
  const trackedItems = useMemo(
    () => order.items.filter((item) => item.variantId),
    [order.items]
  );
  const [restock, setRestock] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const totalRestocked = trackedItems.reduce(
    (sum, item) => sum + (restock[item.id] ?? item.quantity),
    0
  );
  const totalTracked = trackedItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  return (
    <Dialog open={!!action} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cancel order</DialogTitle>
          <DialogDescription>
            Record why this order is being cancelled and how much stock returns
            to sale. Returns after delivery must use the inspection queue.
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
                {CANCEL_REASONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
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
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>Return to stock</Label>
              <span className="text-xs text-muted-foreground">
                {totalRestocked} of {totalTracked} units
              </span>
            </div>
            {trackedItems.map((item) => (
              <div
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
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {item.productName}
                </p>
                <Stepper
                  value={restock[item.id] ?? item.quantity}
                  max={item.quantity}
                  label={item.productName}
                  onChange={(next) =>
                    setRestock((current) => ({
                      ...current,
                      [item.id]: Math.max(0, Math.min(next, item.quantity)),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Keep order
          </Button>
          <Button
            variant="destructive"
            disabled={isPending || !reason}
            onClick={() =>
              onConfirm({
                action: "cancelled",
                reason: [reason, notes.trim()].filter(Boolean).join(" — "),
                restock: trackedItems.map((item) => ({
                  orderItemId: item.id,
                  quantity: restock[item.id] ?? item.quantity,
                })),
              })
            }
          >
            {isPending ? "Working..." : "Cancel order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
