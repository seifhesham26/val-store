import { OrderData } from "./types";
import { Clock, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The fulfilment path, in the order the state machine walks it.
 *
 * This used to list a "confirmed" step that is not an order status at all, and
 * omit `paid`, which is — so every paid order scored `indexOf === -1` and drew
 * the whole timeline grey, including "Order Placed". The keys here must stay in
 * `ORDER_STATUSES`.
 */
const TIMELINE_STEPS = [
  { key: "pending", label: "Order Placed" },
  { key: "processing", label: "Processing" },
  { key: "paid", label: "Paid" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
] as const;

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
        {/* Equal-width columns with the connector drawn *inside* each step,
            spanning from the previous circle's centre to this one's. The old
            layout made the connector a sibling of the whole circle+label stack
            under `items-center`, so it centred against the stack's full height
            and sat well below the circles — and the last step, having no
            connector, pulled its circle out of line with its label. */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${TIMELINE_STEPS.length}, minmax(0, 1fr))`,
          }}
        >
          {TIMELINE_STEPS.map((step, index) => {
            const isCompleted = index <= currentStatusIndex;
            const isCurrent = index === currentStatusIndex;
            // The segment *into* this step is lit once this step is reached.
            const isSegmentFilled = index <= currentStatusIndex;

            return (
              <div
                key={step.key}
                className="relative flex flex-col items-center gap-2"
              >
                {index > 0 && (
                  <div
                    aria-hidden
                    className={`absolute top-4 right-1/2 left-[-50%] h-0.5 -translate-y-1/2 ${
                      isSegmentFilled ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}

                {/* z-10 keeps the circle above the line it passes behind. */}
                <div
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  } ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}
                >
                  {isCompleted && !isCurrent ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>

                <span
                  className={`px-1 text-center text-xs ${
                    isCompleted
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
