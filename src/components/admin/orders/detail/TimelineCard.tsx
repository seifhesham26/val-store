import { OrderData } from "./types";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Timeline steps in logical order
const TIMELINE_STEPS = [
  { key: "pending", label: "Order Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

function getStatusIndex(status: string): number {
  return TIMELINE_STEPS.findIndex((s) => s.key === status);
}

export function TimelineCard({ order }: { order: OrderData }) {
  const isCancelledOrRefunded =
    order.status === "cancelled" || order.status === "refunded";

  if (isCancelledOrRefunded) {
    return null;
  }

  const currentStatusIndex = getStatusIndex(order.status);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <Clock className="h-5 w-5 text-primary" />
        <CardTitle>Order Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          {TIMELINE_STEPS.map((step, index) => {
            const isCompleted = index <= currentStatusIndex;
            const isCurrent = index === currentStatusIndex;
            return (
              <div key={step.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCompleted
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    } ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={`text-xs text-center ${
                      isCompleted
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < TIMELINE_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      index < currentStatusIndex ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
