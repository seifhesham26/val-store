import { OrderData } from "./types";
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

export const STATUS_OPTIONS = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Status</CardTitle>
        <CardDescription>Change the order status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Select
            defaultValue={order.status}
            onValueChange={onStatusChange}
            disabled={isPending}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
          {order.canCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onStatusChange("cancelled")}
              disabled={isPending}
            >
              Cancel Order
            </Button>
          )}
          {order.canRefund && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatusChange("refunded")}
              disabled={isPending}
            >
              Refund Order
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
