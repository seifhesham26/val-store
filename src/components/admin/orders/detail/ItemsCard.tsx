import { OrderData } from "./types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ItemsCard({ order }: { order: OrderData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Items</CardTitle>
        <CardDescription>
          {order.items.length} item{order.items.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {order.items.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="space-y-1">
                <p className="font-medium">{item.productName}</p>
                {item.variantDetails && (
                  <p className="text-sm font-medium text-primary">
                    {item.variantDetails}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Qty: {item.quantity} × ${item.price.toFixed(2)}
                </p>
                {/* A partial return leaves the ordered quantity unchanged, so
                    without this the line still reads "Qty: 3" with no sign that
                    one of them came back. */}
                {item.refundedQuantity > 0 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    {item.refundedQuantity} of {item.quantity} returned
                    {item.refundedQuantity >= item.quantity
                      ? ""
                      : ` · ${item.quantity - item.refundedQuantity} still with the customer`}
                  </p>
                )}
              </div>
              <p className="font-semibold">
                ${(item.quantity * item.price).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
