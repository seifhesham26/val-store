"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { useReadBeforeConfirm } from "@/hooks/use-read-before-confirm";

export function ReturnProposalDialog({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const proposal = trpc.public.returns.getById.useQuery(
    { requestId },
    { enabled: open }
  );
  const data = proposal.data;
  const gate = useReadBeforeConfirm({
    proposalVersion: data?.proposalVersion ?? 0,
    openedAt: data?.proposalOpenedAt,
  });
  const utils = trpc.useUtils();
  const acknowledge = trpc.public.returns.acknowledge.useMutation({
    onSuccess: () =>
      void utils.public.returns.getById.invalidate({ requestId }),
  });
  const otp = trpc.public.returns.requestOtp.useMutation({
    onSuccess: (result) => setChallengeId(result.id),
  });
  const confirm = trpc.public.returns.confirmOtp.useMutation({
    onSuccess: () => {
      void utils.public.returns.getById.invalidate({ requestId });
      setOpen(false);
    },
  });
  const p = data?.proposal;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-transparent">
          Review outcome
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return proposal</DialogTitle>
        </DialogHeader>
        {!data || !p ? (
          <p>Loading proposal…</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p>
              Physical status: {data.physicalStatus}. Payout status:{" "}
              {data.payoutStatus ?? "not started"}.
            </p>
            <ul>
              {data.items.map((item) => (
                <li key={item.id}>
                  Requested {item.requestedQuantity}; approved{" "}
                  {item.approvedQuantity}; outcome {item.outcome ?? "pending"}
                </li>
              ))}
            </ul>
            <p>
              Items: {formatCurrency(p.itemRefund)} · Original delivery:{" "}
              {formatCurrency(p.deliveryRefund)} · Collection due:{" "}
              {formatCurrency(p.collectionDue)} ·{" "}
              <strong>Total: {formatCurrency(p.totalRefund)}</strong>
            </p>
            <p>{p.customerCopy}</p>
            <p>
              Payout destination:{" "}
              {p.payoutDestination ?? "Your verified account phone"}. Carrier
              claims, if any, keep payout paused.
            </p>
            {!data.acknowledgedAt && (
              <Button
                disabled={!gate.canConfirm || acknowledge.isPending}
                onClick={() =>
                  acknowledge.mutate({
                    requestId,
                    proposalVersion: data.proposalVersion,
                  })
                }
              >
                {gate.canConfirm
                  ? "I have reviewed this"
                  : `Read for ${gate.remainingSeconds}s`}
              </Button>
            )}
            {data.acknowledgedAt && p.totalRefund > 0 && !challengeId && (
              <Button
                onClick={() =>
                  otp.mutate({
                    requestId,
                    proposalVersion: data.proposalVersion,
                  })
                }
              >
                Send OTP to verified phone
              </Button>
            )}
            {challengeId && (
              <>
                <input
                  value={code}
                  maxLength={6}
                  inputMode="numeric"
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Six-digit code"
                />
                <Button
                  disabled={confirm.isPending}
                  onClick={() =>
                    confirm.mutate({
                      requestId,
                      proposalVersion: data.proposalVersion,
                      challengeId,
                      code,
                    })
                  }
                >
                  Confirm return
                </Button>
              </>
            )}
            <p className="text-gray-400">
              If you disagree, contact support with a detailed reason; payout
              remains paused while reviewed.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
