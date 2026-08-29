"use client";

/**
 * Stock Issue Dialog
 *
 * Shown when a requested quantity cannot be fulfilled. A toast is the wrong
 * surface for this: the customer needs to see *which* item and variant failed,
 * how many are actually left, and be given a way forward — not a line of text
 * that disappears.
 */

import Image from "next/image";
import { AlertTriangle, ShoppingBag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface StockIssue {
  productName: string;
  productImage?: string | null;
  variantLabel?: string | null;
  /** How many the customer asked for. */
  requested: number;
  /** How many can actually be supplied. Null when the reason is not a limit. */
  available: number | null;
  /** Server message, used when the failure is not a simple quantity problem. */
  message?: string;
}

interface StockIssueDialogProps {
  issue: StockIssue | null;
  onOpenChange: (open: boolean) => void;
  /** Offered when some units are still available. */
  onUseMax?: (max: number) => void;
}

export function StockIssueDialog({
  issue,
  onOpenChange,
  onUseMax,
}: StockIssueDialogProps) {
  const available = issue?.available ?? null;
  const soldOut = available !== null && available <= 0;
  const canTakeSome = available !== null && available > 0;

  return (
    <Dialog open={!!issue} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-white/10 bg-zinc-900 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            {soldOut ? "Out of stock" : "Not enough stock"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {soldOut
              ? "This item has just sold out."
              : "Someone else may have taken the last few while you were deciding."}
          </DialogDescription>
        </DialogHeader>

        {issue && (
          <div className="flex gap-4 rounded-lg border border-white/10 bg-black/40 p-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-white/5">
              {issue.productImage ? (
                <Image
                  src={issue.productImage}
                  alt={issue.productName}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-gray-600" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-medium leading-snug">{issue.productName}</p>
              {issue.variantLabel && (
                <p className="mt-0.5 text-sm text-gray-400">
                  {issue.variantLabel}
                </p>
              )}

              <dl className="mt-2 space-y-0.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">You wanted</dt>
                  <dd className="font-medium tabular-nums">
                    {issue.requested}
                  </dd>
                </div>
                {available !== null && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Available</dt>
                    <dd
                      className={`font-medium tabular-nums ${
                        soldOut ? "text-red-400" : "text-amber-400"
                      }`}
                    >
                      {available}
                    </dd>
                  </div>
                )}
              </dl>

              {available === null && issue.message && (
                <p className="mt-2 text-sm text-amber-400">{issue.message}</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {canTakeSome && onUseMax && (
            <Button
              className="bg-val-accent text-white hover:bg-val-accent/90"
              onClick={() => {
                onUseMax(available);
                onOpenChange(false);
              }}
            >
              Add {available} instead
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
