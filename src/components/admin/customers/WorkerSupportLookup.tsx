"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

type SupportReason =
  | "order_status"
  | "delivery_problem"
  | "return_exchange"
  | "other";

const reasonLabels: Record<SupportReason, string> = {
  order_status: "Order status",
  delivery_problem: "Delivery problem",
  return_exchange: "Return or exchange",
  other: "Other",
};

export function WorkerSupportLookup() {
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState<SupportReason | "">("");
  const [reasonNote, setReasonNote] = useState("");
  const lookup = trpc.admin.customers.supportLookup.useMutation({
    // A confirmation applies to one attempt only. Even when the lookup fails,
    // the next email requires a fresh explicit affirmation.
    onSettled: () => setConfirmed(false),
  });

  const canSubmit =
    email.trim() !== "" &&
    confirmed &&
    reason !== "" &&
    (reason !== "other" || reasonNote.trim() !== "");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !confirmed || !reason) return;

    lookup.mutate({
      email,
      confirmedCustomerRequest: true,
      reason,
      reasonNote: reason === "other" ? reasonNote : undefined,
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customer support</h1>
        <p className="text-muted-foreground">
          Historical orders require the exact email supplied by the customer.
          Every lookup and order opened is recorded.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exact-email lookup</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="support-email">Customer email</Label>
              <Input
                id="support-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setConfirmed(false);
                  lookup.reset();
                }}
                placeholder="customer@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Select
                value={reason}
                onValueChange={(value) => setReason(value as SupportReason)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reasonLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reason === "other" && (
              <div className="space-y-2">
                <Label htmlFor="support-note">Short note</Label>
                <Textarea
                  id="support-note"
                  value={reasonNote}
                  onChange={(event) => setReasonNote(event.target.value)}
                  maxLength={500}
                />
              </div>
            )}

            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="customer-confirmation"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <Label
                htmlFor="customer-confirmation"
                className="font-normal leading-relaxed"
              >
                I confirm this customer requested support and provided this
                email address.
              </Label>
            </div>

            <Button type="submit" disabled={!canSubmit || lookup.isPending}>
              {lookup.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Look up customer
            </Button>

            {lookup.error && (
              <p className="text-sm text-destructive">{lookup.error.message}</p>
            )}
          </form>
        </CardContent>
      </Card>

      {lookup.data && !lookup.data.customer && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No customer matched that exact email address. The attempt was
            recorded.
          </CardContent>
        </Card>
      )}

      {lookup.data?.customer && (
        <Card>
          <CardHeader>
            <CardTitle>{lookup.data.customer.name || "Customer"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lookup.data.customer.email}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {lookup.data.customer.ordersTruncated && (
              <p className="text-sm text-muted-foreground">
                Showing the newest 100 historical orders. Ask an administrator
                if an older record is needed.
              </p>
            )}
            {lookup.data.customer.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No historical orders found. Active fulfilment orders remain in
                the Orders screen.
              </p>
            ) : (
              lookup.data.customer.orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {order.orderNumber ?? order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()} ·{" "}
                      {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">
                      {order.status}
                    </Badge>
                    <span className="font-medium">
                      {formatCurrency(Number(order.totalAmount))}
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/admin/orders/${order.id}?supportAccess=${lookup.data.supportAccessId}`}
                      >
                        Open order
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
