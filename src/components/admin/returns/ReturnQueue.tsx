"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReturnRequestView } from "./types";

export function ReturnQueue({
  requests,
  selectedId,
  onSelect,
}: {
  requests: ReturnRequestView[];
  selectedId: string | null;
  onSelect: (requestId: string) => void;
}) {
  if (requests.length === 0)
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No unresolved return work.
      </p>
    );
  return (
    <div className="space-y-2" aria-label="Return request queue">
      {requests.map((request) => (
        <Button
          key={request.id}
          variant={selectedId === request.id ? "secondary" : "outline"}
          className="h-auto w-full justify-between gap-3 p-3 text-left"
          onClick={() => onSelect(request.id)}
        >
          <span>
            <span className="block font-medium">
              Request {request.id.slice(0, 8)}
            </span>
            <span className="block text-xs text-muted-foreground">
              Order {request.orderId.slice(0, 8)} · {request.items.length} line
              {request.items.length === 1 ? "" : "s"}
            </span>
          </span>
          <span className="flex flex-wrap justify-end gap-1">
            <Badge variant="secondary">
              {request.status.replaceAll("_", " ")}
            </Badge>
            <Badge variant="outline">physical: {request.physicalStatus}</Badge>
            {request.payoutStatus && (
              <Badge variant="outline">payout: {request.payoutStatus}</Badge>
            )}
          </span>
        </Button>
      ))}
    </div>
  );
}
