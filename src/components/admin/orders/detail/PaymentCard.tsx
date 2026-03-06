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
            {order.paymentMethod || "N/A"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Payment Status</span>
          <Badge variant={order.isPaid ? "default" : "destructive"}>
            {order.isPaid ? "Paid" : "Unpaid"}
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
        </div>
      </CardContent>
    </Card>
  );
}
