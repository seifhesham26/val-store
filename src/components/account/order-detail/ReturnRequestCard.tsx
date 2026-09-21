"use client";

import { ReturnEvidenceUpload } from "./ReturnEvidenceUpload";
import { ReturnProposalDialog } from "./ReturnProposalDialog";
import { ReturnRequestDialog } from "./ReturnRequestDialog";
import { trpc } from "@/lib/trpc";

export function ReturnRequestCard({
  orderId,
  deliveredAt,
  items,
}: {
  orderId: string;
  deliveredAt: Date | string | null;
  items: {
    id: string;
    productName: string;
    quantity: number;
    refundedQuantity: number;
  }[];
}) {
  const requests = trpc.public.returns.listForOrder.useQuery({ orderId });
  return (
    <section className="space-y-4 rounded-lg border border-white/10 bg-zinc-900 p-5">
      <div>
        <h3 className="text-lg font-semibold text-white">Returns</h3>
        <p className="text-sm text-gray-400">
          A return is reviewed before any money moves.
        </p>
      </div>
      {requests.data?.map((request) => (
        <div
          className="space-y-3 border-t border-white/10 pt-4"
          key={request.id}
        >
          <p className="text-sm text-gray-300">
            Status: {request.status.replaceAll("_", " ")}
          </p>
          {[
            "requested",
            "awaiting_customer_evidence",
            "evidence_exception",
          ].includes(request.status) && (
            <ReturnEvidenceUpload requestId={request.id} />
          )}
          {request.proposal && <ReturnProposalDialog requestId={request.id} />}
        </div>
      ))}
      {(!requests.data || requests.data.length === 0) && (
        <ReturnRequestDialog
          orderId={orderId}
          deliveredAt={deliveredAt}
          items={items}
        />
      )}
    </section>
  );
}
