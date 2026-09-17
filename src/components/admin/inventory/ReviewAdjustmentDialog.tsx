import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  getInventoryCategoryLabel,
  type InventoryAdjustmentRequestView,
  requiresDecisionExplanation,
} from "./inventory-work-ui";

interface ReviewAdjustmentDialogProps {
  request: InventoryAdjustmentRequestView | null;
  siblingRequests: InventoryAdjustmentRequestView[];
  currentStock: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Decision = "approved" | "rejected";

export function ReviewAdjustmentDialog({
  request,
  siblingRequests,
  currentStock,
  open,
  onOpenChange,
  onSuccess,
}: ReviewAdjustmentDialogProps) {
  const [decision, setDecision] = useState<Decision>("approved");
  const [approvedQuantity, setApprovedQuantity] = useState(() =>
    request ? String(request.requestedQuantity) : ""
  );
  const [explanation, setExplanation] = useState("");

  const parsedQuantity = Number.parseInt(approvedQuantity, 10);
  const quantityIsValid =
    Number.isSafeInteger(parsedQuantity) && parsedQuantity > 0;
  const explanationRequired = request
    ? requiresDecisionExplanation({
        decision,
        requestedQuantity: request.requestedQuantity,
        approvedQuantity: quantityIsValid ? parsedQuantity : null,
      })
    : false;

  const projectedStock = useMemo(() => {
    if (!request || currentStock === null || !quantityIsValid) return null;
    if (decision === "rejected") return currentStock;
    return (
      currentStock +
      (request.category === "extra" ? parsedQuantity : -parsedQuantity)
    );
  }, [currentStock, decision, parsedQuantity, quantityIsValid, request]);

  const reviewMutation = trpc.admin.inventory.reviewRequest.useMutation({
    onSuccess: () => {
      toast.success(
        decision === "approved"
          ? "Inventory request approved"
          : "Inventory request rejected"
      );
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!request) return;

    if (decision === "approved" && !quantityIsValid) {
      toast.error("Approved quantity must be a positive whole number");
      return;
    }
    if (decision === "approved" && currentStock === null) {
      toast.error("This variant was deleted and cannot be approved");
      return;
    }
    if (
      decision === "approved" &&
      projectedStock !== null &&
      projectedStock < 0
    ) {
      toast.error("Approval would make recorded stock negative");
      return;
    }
    const trimmedExplanation = explanation.trim();
    if (explanationRequired && !trimmedExplanation) {
      toast.error(
        decision === "rejected"
          ? "Add a reason for rejecting this request"
          : "Explain why the approved quantity differs"
      );
      return;
    }

    reviewMutation.mutate({
      requestId: request.id,
      decision,
      approvedQuantity: decision === "approved" ? parsedQuantity : undefined,
      explanation: trimmedExplanation || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review inventory request</DialogTitle>
          <DialogDescription>
            Decide against the current recorded stock. The original report is
            kept unchanged for the audit trail.
          </DialogDescription>
        </DialogHeader>

        {request && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-3 border bg-muted/40 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Variant</p>
                <p className="font-medium">{request.productName}</p>
                <p className="text-sm text-muted-foreground">
                  {request.sku}
                  {request.size ? ` / ${request.size}` : ""}
                  {request.color ? ` / ${request.color}` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reported by</p>
                <p className="font-medium">
                  {request.requester?.name ?? "Deleted staff account"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {getInventoryCategoryLabel(request.category)}{" "}
                  {request.requestedQuantity} unit
                  {request.requestedQuantity === 1 ? "" : "s"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Stock at request
                </p>
                <p className="font-mono text-lg">{request.stockAtRequest}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Current recorded stock
                </p>
                <p className="font-mono text-lg">
                  {currentStock ?? "Variant deleted"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Worker explanation</p>
              <p className="border-l-2 border-muted-foreground/30 pl-3 text-sm text-muted-foreground">
                {request.explanation}
              </p>
            </div>

            {siblingRequests.length > 1 && (
              <div className="border-l-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-medium">
                  {siblingRequests.length - 1} other pending request
                  {siblingRequests.length === 2 ? "" : "s"} for this variant
                </p>
                <p className="mt-1 text-amber-900/80">
                  Review them together so the same finding is not counted twice.
                </p>
              </div>
            )}

            {currentStock === null && (
              <div className="border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                This variant was deleted. It can remain in history, but only
                rejection is available.
              </div>
            )}

            <RadioGroup
              value={decision}
              onValueChange={(value) => setDecision(value as Decision)}
              className="grid gap-3 sm:grid-cols-2"
            >
              <label className="flex cursor-pointer items-start gap-3 border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem
                  value="approved"
                  disabled={reviewMutation.isPending || currentStock === null}
                />
                <span>
                  <span className="flex items-center gap-2 font-medium">
                    <Check className="size-4 text-emerald-700" /> Approve
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Apply the signed stock difference.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem
                  value="rejected"
                  disabled={reviewMutation.isPending}
                />
                <span>
                  <span className="flex items-center gap-2 font-medium">
                    <X className="size-4 text-red-700" /> Reject
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Keep recorded stock unchanged.
                  </span>
                </span>
              </label>
            </RadioGroup>

            {decision === "approved" && (
              <div className="space-y-2">
                <Label htmlFor="approved-quantity">Approved quantity</Label>
                <Input
                  id="approved-quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={approvedQuantity}
                  onChange={(event) => setApprovedQuantity(event.target.value)}
                  disabled={reviewMutation.isPending || currentStock === null}
                />
              </div>
            )}

            <div className="border bg-background p-3 text-sm">
              <span className="text-muted-foreground">
                Projected recorded stock:{" "}
              </span>
              <strong
                className={
                  projectedStock !== null && projectedStock < 0
                    ? "text-red-700"
                    : ""
                }
              >
                {projectedStock ?? "Not available"}
              </strong>
            </div>

            <div className="space-y-2">
              <Label htmlFor="decision-explanation">
                Decision explanation
                {explanationRequired ? " (required)" : " (optional)"}
              </Label>
              <Textarea
                id="decision-explanation"
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                placeholder={
                  decision === "rejected"
                    ? "Explain why this request is being rejected..."
                    : "Explain the corrected quantity..."
                }
                maxLength={500}
                rows={3}
                disabled={reviewMutation.isPending}
                required={explanationRequired}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={reviewMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={decision === "rejected" ? "destructive" : "default"}
                disabled={
                  reviewMutation.isPending ||
                  (decision === "approved" &&
                    (currentStock === null ||
                      !quantityIsValid ||
                      projectedStock === null ||
                      projectedStock < 0))
                }
              >
                {reviewMutation.isPending
                  ? "Saving..."
                  : decision === "approved"
                    ? "Approve request"
                    : "Reject request"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
