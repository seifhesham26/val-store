"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

type Line = {
  id: string;
  productName: string;
  quantity: number;
  refundedQuantity: number;
};
export function ReturnRequestDialog({
  orderId,
  deliveredAt,
  items,
}: {
  orderId: string;
  deliveredAt: Date | string | null;
  items: Line[];
}) {
  const [reason, setReason] = useState<
    | "change_of_mind"
    | "defective"
    | "wrong_item"
    | "not_as_described"
    | "late_delivery"
  >("change_of_mind");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const create = trpc.public.returns.create.useMutation({
    onSuccess: () => {
      void utils.public.returns.listForOrder.invalidate({ orderId });
      setOpen(false);
    },
  });
  const deadline = deliveredAt
    ? new Date(
        new Date(deliveredAt).getTime() +
          (reason === "change_of_mind" ? 14 : 30) * 86400000
      ).toLocaleDateString()
    : null;
  const eligible = items.filter(
    (item) => item.quantity > item.refundedQuantity
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-val-accent text-black">Request a return</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request a return</DialogTitle>
          <DialogDescription>
            Initial submission does not refund money. Unworn try-ons may be
            eligible; customer-caused damage can be rejected.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label>
            Reason{" "}
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
            >
              <option value="change_of_mind">Changed my mind</option>
              <option value="defective">Defective</option>
              <option value="wrong_item">Wrong item</option>
              <option value="not_as_described">Not as described</option>
              <option value="late_delivery">Late delivery</option>
            </select>
          </label>
          {deadline && (
            <p>
              Request by {deadline} ({reason === "change_of_mind" ? "14" : "30"}
              -day window).
            </p>
          )}
          <p>
            Valkyrie pays one return pickup for accepted returns. Change-of-mind
            returns keep the original delivery fee; customer-caused rejected
            returns may have collection charged.
          </p>
          {eligible.map((item) => (
            <label className="flex gap-2" key={item.id}>
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={(event) =>
                  setSelectedIds((current) =>
                    event.target.checked
                      ? [...current, item.id]
                      : current.filter((id) => id !== item.id)
                  )
                }
              />
              {item.productName} (up to {item.quantity - item.refundedQuantity})
            </label>
          ))}
          <Button
            disabled={create.isPending || selectedIds.length === 0}
            onClick={() =>
              create.mutate({
                orderId,
                reason,
                pickupMethod: "courier",
                lines: eligible
                  .filter((item) => selectedIds.includes(item.id))
                  .map((item) => ({
                    orderItemId: item.id,
                    quantity: item.quantity - item.refundedQuantity,
                  })),
              })
            }
          >
            Submit request
          </Button>
          {create.error && (
            <p className="text-red-400">{create.error.message}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
