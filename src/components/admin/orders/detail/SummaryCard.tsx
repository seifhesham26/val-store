import { OrderData } from "./types";
import { format } from "date-fns";
import { Package } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  processing:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  shipped:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  delivered:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  refunded: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export function SummaryCard({ order }: { order: OrderData }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <Package className="h-5 w-5 text-primary" />
        <div>
          <CardTitle>Order Summary</CardTitle>
          <CardDescription>
            Order #{order.id.slice(0, 8).toUpperCase()}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge
            className={STATUS_COLORS[order.status] || ""}
            variant="secondary"
          >
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Created</span>
          <span className="text-sm font-medium">
            {format(new Date(order.createdAt), "MMM dd, yyyy HH:mm")}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Last Updated</span>
          <span className="text-sm font-medium">
            {format(new Date(order.updatedAt), "MMM dd, yyyy HH:mm")}
          </span>
        </div>
        {order.paidAt && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Paid At</span>
            <span className="text-sm font-medium">
              {format(new Date(order.paidAt), "MMM dd, yyyy HH:mm")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
