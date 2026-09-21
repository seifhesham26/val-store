"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { UserRole } from "@/domain/customers/value-objects/user-role";
import type { ReturnRequestView } from "./types";
import { ReturnEvidenceViewer } from "./ReturnEvidenceViewer";

export function ReturnReview({
  request,
  role,
  onAuthorize,
  onReject,
}: {
  request: ReturnRequestView;
  role: UserRole | null;
  onAuthorize: () => Promise<unknown>;
  onReject: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const canDecide = role === "admin" || role === "super_admin";
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Return inspection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Workflow</dt>
              <dd>{request.status.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pickup</dt>
              <dd>{request.pickupMethod ?? "not selected"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Physical state</dt>
              <dd>{request.physicalStatus}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Payout</dt>
              <dd>{request.payoutStatus ?? "not started"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                Customer-facing proposal
              </dt>
              <dd>{request.proposal?.customerCopy ?? "Awaiting inspection"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Proposal total</dt>
              <dd>
                {request.proposal
                  ? request.proposal.totalRefund.toFixed(2)
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className="rounded border p-3">
            <p className="font-medium">Returned lines</p>
            {request.items.map((item) => (
              <p key={item.id} className="text-muted-foreground">
                Requested {item.requestedQuantity}; received{" "}
                {item.receivedQuantity}; approved {item.approvedQuantity};
                outcome {item.outcome ?? "pending"}
              </p>
            ))}
          </div>
          {request.proposal && (
            <p className="rounded border p-3">
              Delivery refund {request.proposal.deliveryRefund.toFixed(2)} ·
              Collection due {request.proposal.collectionDue.toFixed(2)} ·
              Payout remains pending until provider confirmation.
            </p>
          )}
        </CardContent>
      </Card>
      <ReturnEvidenceViewer isSuperAdmin={role === "super_admin"} />
      <Card>
        <CardHeader>
          <CardTitle>Decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canDecide ? (
            <>
              <Button
                onClick={() =>
                  void onAuthorize().catch((error) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Could not authorize pickup"
                    )
                  )
                }
                disabled={
                  !["requested", "awaiting_customer_evidence"].includes(
                    request.status
                  )
                }
              >
                Authorize pickup
              </Button>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Rejection reason"
              />
              <Button
                variant="destructive"
                disabled={!reason.trim()}
                onClick={() =>
                  void onReject(reason).catch((error) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Could not reject request"
                    )
                  )
                }
              >
                Reject request
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Record intake facts and video findings; an admin must classify
              fault or approve/reject.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
