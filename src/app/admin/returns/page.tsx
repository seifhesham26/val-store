"use client";

import { useState } from "react";
import { ReturnQueue } from "@/components/admin/returns/ReturnQueue";
import { ReturnReview } from "@/components/admin/returns/ReturnReview";
import { trpc } from "@/lib/trpc";
import { useAdminWriteAccess } from "@/hooks/use-admin-write-access";

export default function AdminReturnsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { role } = useAdminWriteAccess();
  const utils = trpc.useUtils();
  const list = trpc.admin.returns.list.useQuery({ limit: 50 });
  const selected = trpc.admin.returns.getById.useQuery(
    { requestId: selectedId! },
    { enabled: !!selectedId }
  );
  const authorize = trpc.admin.returns.authorizePickup.useMutation({
    onSuccess: () =>
      void Promise.all([
        utils.admin.returns.list.invalidate(),
        selectedId
          ? utils.admin.returns.getById.invalidate({ requestId: selectedId })
          : Promise.resolve(),
      ]),
  });
  const reject = trpc.admin.returns.reject.useMutation({
    onSuccess: () =>
      void Promise.all([
        utils.admin.returns.list.invalidate(),
        selectedId
          ? utils.admin.returns.getById.invalidate({ requestId: selectedId })
          : Promise.resolve(),
      ]),
  });
  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
      <section>
        <h1 className="mb-4 text-2xl font-semibold">Returns</h1>
        <ReturnQueue
          requests={list.data ?? []}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </section>
      <section>
        {selected.data ? (
          <ReturnReview
            request={selected.data}
            role={role}
            onAuthorize={() =>
              authorize.mutateAsync({ requestId: selected.data!.id })
            }
            onReject={(reason) =>
              reject.mutateAsync({ requestId: selected.data!.id, reason })
            }
          />
        ) : (
          <p className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
            Select a return request to inspect its structured facts and evidence
            status.
          </p>
        )}
      </section>
    </div>
  );
}
