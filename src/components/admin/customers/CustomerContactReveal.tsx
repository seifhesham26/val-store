"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldCheck } from "lucide-react";

type RevealReason =
  | "customer_support"
  | "delivery_issue"
  | "account_correction"
  | "other";

const reasonLabels: Record<RevealReason, string> = {
  customer_support: "Customer support",
  delivery_issue: "Delivery issue",
  account_correction: "Account or data correction",
  other: "Other",
};

export function CustomerContactReveal({ customerId }: { customerId: string }) {
  const [reason, setReason] = useState<RevealReason | "">("");
  const [reasonNote, setReasonNote] = useState("");
  const reveal = trpc.admin.customers.revealContact.useMutation();

  const canReveal =
    reason !== "" && (reason !== "other" || reasonNote.trim() !== "");

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div>
          <h4 className="font-semibold">Protected contact details</h4>
          <p className="text-sm text-muted-foreground">
            Phone and saved delivery addresses are hidden until an audited
            reveal. Birthday and billing address are not available here.
          </p>
        </div>
      </div>

      {reveal.data ? (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-medium">Account phone:</span>{" "}
            {reveal.data.phone || "Not provided"}
          </p>
          {reveal.data.shippingAddresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved delivery addresses.
            </p>
          ) : (
            reveal.data.shippingAddresses.map((address) => (
              <address
                key={address.id}
                className="rounded-md border p-3 text-sm not-italic"
              >
                <p className="font-medium">
                  {address.fullName}
                  {address.isDefault ? " · Default" : ""}
                </p>
                <p>{address.addressLine1}</p>
                {address.addressLine2 && <p>{address.addressLine2}</p>}
                <p>
                  {[address.city, address.state].filter(Boolean).join(", ")}{" "}
                  {address.postalCode}
                </p>
                <p>{address.country}</p>
                <p>{address.phone}</p>
              </address>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Reason for access</Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as RevealReason)}
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
              <Label htmlFor="customer-reveal-note">Short note</Label>
              <Textarea
                id="customer-reveal-note"
                value={reasonNote}
                onChange={(event) => setReasonNote(event.target.value)}
                maxLength={500}
              />
            </div>
          )}

          <Button
            type="button"
            disabled={!canReveal || reveal.isPending}
            onClick={() => {
              if (!reason) return;
              reveal.mutate({
                customerId,
                reason,
                reasonNote: reason === "other" ? reasonNote : undefined,
              });
            }}
          >
            {reveal.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Reveal contact details
          </Button>
          {reveal.error && (
            <p className="text-sm text-destructive">{reveal.error.message}</p>
          )}
        </>
      )}
    </div>
  );
}
