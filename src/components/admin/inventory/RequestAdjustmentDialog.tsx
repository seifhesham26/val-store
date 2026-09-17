import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { InventoryAdjustmentCategory } from "@/domain/inventory/inventory-operations";
import { getInventoryCategoryLabel } from "./inventory-work-ui";
import type { InventoryVariant } from "./AllStockTab";

interface RequestAdjustmentDialogProps {
  variant: InventoryVariant | null;
  inspectionId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const categories: InventoryAdjustmentCategory[] = [
  "damaged",
  "missing",
  "extra",
];

export function RequestAdjustmentDialog({
  variant,
  inspectionId,
  open,
  onOpenChange,
  onSuccess,
}: RequestAdjustmentDialogProps) {
  const [category, setCategory] =
    useState<InventoryAdjustmentCategory>("damaged");
  const [quantity, setQuantity] = useState("1");
  const [explanation, setExplanation] = useState("");

  const requestMutation = trpc.admin.inventory.submitRequest.useMutation({
    onSuccess: () => {
      toast.success("Adjustment request sent for review");
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!variant) return;

    const parsedQuantity = Number.parseInt(quantity, 10);
    const trimmedExplanation = explanation.trim();
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity <= 0) {
      toast.error("Quantity must be a positive whole number");
      return;
    }
    if (!trimmedExplanation) {
      toast.error("Add a concrete explanation before sending the request");
      return;
    }

    requestMutation.mutate({
      variantId: variant.variantId,
      inspectionId: inspectionId ?? undefined,
      category,
      quantity: parsedQuantity,
      explanation: trimmedExplanation,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request an inventory adjustment</DialogTitle>
          <DialogDescription>
            Report what you found. An admin will review the proposed stock
            change before anything is added or removed.
          </DialogDescription>
        </DialogHeader>

        {variant && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{variant.productName}</p>
              <p className="text-muted-foreground">
                {variant.sku}
                {variant.size ? ` / ${variant.size}` : ""}
                {variant.color ? ` / ${variant.color}` : ""}
              </p>
              <p className="mt-1 text-muted-foreground">
                Recorded stock:{" "}
                <strong className="text-foreground">
                  {variant.stockQuantity}
                </strong>
              </p>
              {inspectionId && (
                <p className="mt-1 text-amber-800">
                  Linked to the pending low-stock inspection.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <div className="space-y-2">
                <Label htmlFor="adjustment-category">What did you find?</Label>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    setCategory(value as InventoryAdjustmentCategory)
                  }
                >
                  <SelectTrigger id="adjustment-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((item) => (
                      <SelectItem key={item} value={item}>
                        {getInventoryCategoryLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjustment-quantity">Units</Label>
                <Input
                  id="adjustment-quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment-explanation">Explanation</Label>
              <Textarea
                id="adjustment-explanation"
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                placeholder="Describe where you found the discrepancy..."
                maxLength={500}
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">
                {explanation.length}/500
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={requestMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={requestMutation.isPending}>
                <Send />
                {requestMutation.isPending ? "Sending..." : "Send request"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
