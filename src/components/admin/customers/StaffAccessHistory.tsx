"use client";

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

const actionLabels: Record<string, string> = {
  order_view: "Opened order",
  delivery_reveal: "Revealed delivery details",
  customer_lookup: "Looked up customer",
  customer_reveal: "Revealed customer contact",
  order_export: "Exported orders",
};

const reasonLabels: Record<string, string> = {
  order_fulfillment: "Order fulfilment",
  customer_support: "Customer support",
  delivery_issue: "Delivery issue",
  account_correction: "Account correction",
  order_status: "Order status",
  delivery_problem: "Delivery problem",
  return_exchange: "Return or exchange",
  operations_export: "Operations export",
  other: "Other",
};

export function StaffAccessHistory({ staffUserId }: { staffUserId: string }) {
  const { data, isLoading, error } =
    trpc.admin.accessAudit.listForStaff.useQuery({ staffUserId, limit: 25 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Customer-data access history
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Retained for 12 months. The log records access, not the revealed
          customer values.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : !data || data.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No customer-data access recorded.
          </p>
        ) : (
          <div className="space-y-3">
            {data.events.map((event) => (
              <div key={event.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {actionLabels[event.action] ?? event.action}
                  </p>
                  <time className="text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {reasonLabels[event.reason] ?? event.reason}
                  </Badge>
                  {event.orderId && (
                    <Badge variant="secondary">
                      Order {event.orderId.slice(0, 8)}
                    </Badge>
                  )}
                  {event.subjectUserId && (
                    <Badge variant="outline">
                      Customer {event.subjectUserId.slice(0, 8)}
                    </Badge>
                  )}
                  {event.confirmedCustomerRequest && (
                    <Badge variant="secondary">
                      Customer request confirmed
                    </Badge>
                  )}
                </div>
                {event.reasonNote && (
                  <p className="mt-2 text-muted-foreground">
                    {event.reasonNote}
                  </p>
                )}
              </div>
            ))}
            {data.total > data.events.length && (
              <p className="text-xs text-muted-foreground">
                Showing the newest {data.events.length} of {data.total} events.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
