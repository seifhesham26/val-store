import { OrderData } from "./types";
import { PaymentWindowNotice } from "./PaymentWindowNotice";
import { usePaymentWindow } from "@/hooks/use-payment-window";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ORDER_STATUSES,
  OrderStatus,
} from "@/domain/orders/value-objects/order-status.value-object";

interface UpdateStatusCardProps {
  order: OrderData;
  isPending: boolean;
  onStatusChange: (status: string) => void;
}

export function UpdateStatusCard({
  order,
  isPending,
  onStatusChange,
}: UpdateStatusCardProps) {
  // Derived from the clock, not from the flag in the response: otherwise the
  // deadline passes on screen while the buttons stay disabled until a reload.
  const paymentWindow = usePaymentWindow(order.paymentDeadline);
  const heldForPayment = order.awaitingPayment && paymentWindow.open;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Status</CardTitle>
        <CardDescription>Change the order status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.awaitingPayment && order.paymentDeadline && (
          <PaymentWindowNotice deadline={order.paymentDeadline} />
        )}

        <div className="flex items-center gap-4">
          <Select
            value={order.status}
            onValueChange={onStatusChange}
            disabled={isPending}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((status) => {
                // The current status stays selectable so the trigger renders it;
                // anything the state machine forbids is disabled rather than
                // hidden, so the whole flow stays visible.
                const isCurrent = status === order.status;
                return (
                  <SelectItem
                    key={status}
                    value={status}
                    disabled={
                      !isCurrent &&
                      (!OrderStatus.canTransition(order.status, status, {
                        paymentCaptured: order.hasCapturedPayment,
                      }) ||
                        // Held while the customer may still be paying.
                        (status === "cancelled" && heldForPayment))
                    }
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          {OrderStatus.canTransition(order.status, "cancelled") && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onStatusChange("cancelled")}
              disabled={isPending || heldForPayment}
            >
              Cancel Order
            </Button>
          )}
          {/* Gated on refundability, not on a status transition: a partial
              return does not move the order's status at all, so gating it on
              `→ refunded` would make one impossible from, say, `shipped`. */}
          {order.canRefund && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatusChange("refunded")}
              disabled={isPending}
            >
              {order.partiallyRefunded
                ? "Record another return"
                : "Record a return"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
