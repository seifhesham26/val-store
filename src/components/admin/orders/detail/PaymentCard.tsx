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

export function PaymentCard({ order }: { order: OrderData }) {
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
            <span>${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span>${order.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Shipping</span>
            <span>${order.shippingCost.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>${order.totalAmount.toFixed(2)}</span>
          </div>
          {/* Returns can be partial, so what has actually gone back to the
              customer is worth stating separately from the order total. */}
          {order.refundedAmount > 0 && (
            <>
              <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
                <span>Refunded</span>
                <span>-${order.refundedAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Net</span>
                <span>
                  ${(order.totalAmount - order.refundedAmount).toFixed(2)}
                </span>
              </div>
              {order.partiallyRefunded && (
                <p className="text-xs text-muted-foreground">
                  Partly returned — the rest can still be returned.
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
