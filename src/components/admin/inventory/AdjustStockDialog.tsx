import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { type InventoryVariant } from "./AllStockTab";

const CHANGE_TYPES = [
  { value: "restock", label: "Restock" },
  { value: "adjustment", label: "Manual Adjustment" },
  { value: "damaged", label: "Damaged/Lost" },
  { value: "return", label: "Return" },
] as const;

type ChangeType = (typeof CHANGE_TYPES)[number]["value"];

interface AdjustStockDialogProps {
  variant: InventoryVariant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AdjustStockDialog({
  variant,
  open,
  onOpenChange,
  onSuccess,
}: AdjustStockDialogProps) {
  const [newQuantity, setNewQuantity] = useState("");
  const [changeType, setChangeType] = useState<ChangeType>("adjustment");
  const [reason, setReason] = useState("");
  // Which variant the fields below currently hold values for — see the
  // re-seeding block under `handleSubmit`. `null` means "nothing is open",
  // which is what makes reopening the same variant re-seed rather than
  // keeping whatever was typed last time.
  const [seededFor, setSeededFor] = useState<string | null>(null);

  const adjustMutation = trpc.admin.inventory.adjustStock.useMutation({
    onSuccess: () => {
      toast.success("Stock adjusted successfully");
      onSuccess();
      // Closing is all that is needed: the re-seeding block below owns every
      // field's value and re-runs on the next open. Clearing them here as
      // well is what previously disguised the fact that a *cancelled* close
      // reset nothing.
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!variant) return;

    const qty = parseInt(newQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    adjustMutation.mutate({
      variantId: variant.variantId,
      newQuantity: qty,
      changeType,
      reason: reason.trim() || undefined,
    });
  };

  // Re-seed the form for whichever variant is currently open.
  //
  // This used to be `if (variant && newQuantity === "")`, which only fired
  // when the field happened to be empty — and it is emptied *only* by the
  // mutation's `onSuccess`. Closing without submitting (Escape, the X, an
  // overlay click) left the previous variant's number in state, so the next
  // variant opened showing a quantity that belonged to a different SKU while
  // "Current Stock" above it correctly showed its own. Submitting that set
  // the wrong stock level and wrote an audit row that looked entirely
  // truthful — `AdjustStockUseCase` is an absolute "set stock to N", so it
  // applies whatever arrives.
  //
  // Tracking the id the form was last seeded for — and clearing it whenever
  // the dialog is closed — re-seeds on every open, including reopening the
  // same variant after a cancel. `open` is part of the key rather than just
  // `variant`, because `variant` stays set while the close animation runs.
  const activeVariantId = open && variant ? variant.variantId : null;

  if (activeVariantId !== seededFor) {
    setSeededFor(activeVariantId);

    if (variant && activeVariantId) {
      setNewQuantity(String(variant.stockQuantity));
      setChangeType("adjustment");
      setReason("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
        </DialogHeader>
        {variant && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{variant.productName}</p>
              <p className="text-sm text-muted-foreground">
                SKU: {variant.sku}
                {variant.size && ` • Size: ${variant.size}`}
                {variant.color && ` • Color: ${variant.color}`}
              </p>
              <p className="text-sm mt-1">
                Current Stock:{" "}
                <span className="font-semibold">{variant.stockQuantity}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newQuantity">New Quantity</Label>
              <Input
                id="newQuantity"
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Reason for Change</Label>
              <Select
                value={changeType}
                onValueChange={(v) => setChangeType(v as ChangeType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>
                      {ct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Notes (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Additional details..."
                rows={2}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={adjustMutation.isPending}
            >
              {adjustMutation.isPending ? "Saving..." : "Update Stock"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
