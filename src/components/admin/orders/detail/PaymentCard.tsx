import { OrderData } from "./types";
import { CreditCard } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/currency";

export function PaymentCard({ order }: { order: OrderData }) {
  const completed = order.returns.filter(
    (returnRequest) => returnRequest.payoutStatus === "succeeded"
  );
  const completedItemAmount = completed.reduce(
    (sum, returnRequest) => sum + returnRequest.itemRefund,
    0
  );
  const completedDeliveryAmount = completed.reduce(
    (sum, returnRequest) => sum + returnRequest.deliveryRefund,
    0
  );
  const completedCollectionFees = completed.reduce(
    (sum, returnRequest) => sum + returnRequest.collectionDue,
    0
  );
  const completedPayout =
    completedItemAmount + completedDeliveryAmount - completedCollectionFees;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <CreditCard className="h-5 w-5 text-primary" />
        <div>
          <CardTitle>Payment</CardTitle>
          <CardDescription>Payment information</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Method</span>
          <span className="text-sm font-medium">
            {order.paymentMethod === "cash_on_delivery"
              ? "Cash on Delivery"
              : order.paymentMethod === "stripe"
                ? "Card (Stripe)"
                : "N/A"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Payment Status</span>
          {/* Driven by the payments row, not the order status — an order can be
              marked paid while the charge has not actually been captured. */}
          <Badge
            variant={
              order.paymentStatus === "completed"
                ? "default"
                : order.paymentStatus === "refunded"
                  ? "secondary"
                  : order.hasCapturedPayment
                    ? "default"
                    : "destructive"
            }
          >
            {order.paymentStatus === "completed"
              ? "Paid"
              : order.paymentStatus === "refunded"
                ? "Refunded"
                : order.paymentStatus === "failed"
                  ? "Failed"
                  : order.hasCapturedPayment
                    ? "Paid (on delivery)"
                    : "Awaiting payment"}
          </Badge>
        </div>
        <Separator />
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatCurrency(order.tax)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Shipping</span>
            <span>{formatCurrency(order.shippingCost)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>
          {/* Returns can be partial, so what has actually gone back to the
              customer is worth stating separately from the order total. */}
          {completedPayout > 0 && (
            <>
              <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
                <span>Completed item payout</span>
                <span>-{formatCurrency(completedItemAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
                <span>Completed delivery payout</span>
                <span>-{formatCurrency(completedDeliveryAmount)}</span>
              </div>
              {completedCollectionFees > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Collection fee</span>
                  <span>+{formatCurrency(completedCollectionFees)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
                <span>Total payout completed</span>
                <span>-{formatCurrency(completedPayout)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Net</span>
                <span>
                  {formatCurrency(order.totalAmount - completedPayout)}
                </span>
              </div>
              {order.partiallyRefunded && (
                <p className="text-xs text-muted-foreground">
                  Partly returned — the rest can still be returned.
                </p>
              )}
            </>
          )}
          {order.returns.map((returnRequest) => (
            <div
              key={returnRequest.id}
              className="space-y-1 border-t pt-3 text-xs text-muted-foreground"
            >
              <p>
                Physical: {returnRequest.physicalStatus.replaceAll("_", " ")} ·{" "}
                {returnRequest.receivedQuantity} received ·{" "}
                {returnRequest.missingQuantity} missing
              </p>
              <p>
                Payout: {returnRequest.payoutMethod.replaceAll("_", " ")} ·{" "}
                {returnRequest.payoutStatus ?? "not started"}
              </p>
              <p>Carrier claim: {returnRequest.carrierClaimStatus ?? "none"}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
