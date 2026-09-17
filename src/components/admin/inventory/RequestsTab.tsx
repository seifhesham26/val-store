import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  Clock3,
  PackageSearch,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  InventoryAdjustmentRequestView,
  InventoryInspectionView,
  InventoryWorkHistoryView,
  InventoryWorkListView,
} from "./inventory-work-ui";
import { InventoryAvailabilityBadge } from "./InventoryAvailabilityBadge";
import { getInventoryCategoryLabel } from "./inventory-work-ui";
import type { InventoryVariant } from "./AllStockTab";

interface RequestsTabProps {
  work: InventoryWorkListView | undefined;
  isLoading: boolean;
  role: "customer" | "worker" | "admin" | "super_admin" | null;
  isRolePending: boolean;
  variantsById: ReadonlyMap<string, InventoryVariant>;
  onRequestAdjustment: (
    variant: InventoryVariant,
    inspectionId?: string | null
  ) => void;
  onReviewRequest: (
    request: InventoryAdjustmentRequestView,
    siblingRequests: InventoryAdjustmentRequestView[]
  ) => void;
  onCompleteInspection: (inspection: InventoryInspectionView) => void;
}

function age(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

function variantText(item: {
  sku: string;
  size: string | null;
  color: string | null;
}) {
  return [item.sku, item.size, item.color].filter(Boolean).join(" / ");
}

function EmptyWorkState() {
  return (
    <div className="border border-dashed p-10 text-center">
      <PackageSearch className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 font-medium">No inventory work is waiting</p>
      <p className="mt-1 text-sm text-muted-foreground">
        New inspections and worker reports will appear here.
      </p>
    </div>
  );
}

function InspectionRow({
  inspection,
  variant,
  isWorker,
  isRolePending,
  onRequestAdjustment,
  onComplete,
}: {
  inspection: InventoryInspectionView;
  variant: InventoryVariant | undefined;
  isWorker: boolean;
  isRolePending: boolean;
  onRequestAdjustment: (
    variant: InventoryVariant,
    inspectionId?: string | null
  ) => void;
  onComplete: (inspection: InventoryInspectionView) => void;
}) {
  return (
    <div className="border-l-4 border-amber-400 bg-amber-50/60 p-4 dark:bg-amber-950/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ClipboardCheck className="size-4 text-amber-700" />
            <p className="font-medium">{inspection.productName}</p>
            <InventoryAvailabilityBadge state="pending" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {variantText(inspection)}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span>
              Trigger stock: <strong>{inspection.triggerStock}</strong>
            </span>
            <span className="text-muted-foreground">
              Opened {age(inspection.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {variant && (
            <Button
              variant="outline"
              size="sm"
              disabled={!isWorker || isRolePending}
              onClick={() => onRequestAdjustment(variant, inspection.id)}
            >
              <AlertTriangle />
              Request adjustment
            </Button>
          )}
          <Button
            size="sm"
            disabled={!isWorker || isRolePending}
            onClick={() => onComplete(inspection)}
          >
            <Check />
            Checked all units - everything is fine
          </Button>
        </div>
      </div>
      {!variant && (
        <p className="mt-3 text-sm text-red-700">
          This variant was deleted. The inspection remains in history.
        </p>
      )}
    </div>
  );
}

function RequestRow({
  request,
  currentStock,
  canReview,
  isRolePending,
  onReview,
}: {
  request: InventoryAdjustmentRequestView;
  currentStock: number | null;
  canReview: boolean;
  isRolePending: boolean;
  onReview: () => void;
}) {
  const isFlaw = request.category !== "extra";
  return (
    <div className="border bg-background p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                isFlaw
                  ? "border-red-300 bg-red-100 text-red-800"
                  : "border-slate-300 bg-slate-100 text-slate-700"
              }
            >
              {getInventoryCategoryLabel(request.category)}
            </Badge>
            <span className="font-medium">
              {request.requestedQuantity} unit
              {request.requestedQuantity === 1 ? "" : "s"}
            </span>
            {isFlaw && <InventoryAvailabilityBadge state="quarantined" />}
          </div>
          <p className="text-sm text-foreground">{request.explanation}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>By {request.requester?.name ?? "Deleted staff account"}</span>
            <span>Requested at stock {request.stockAtRequest}</span>
            <span>{age(request.createdAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right text-sm">
            <p className="text-xs text-muted-foreground">Current stock</p>
            <p className="font-mono text-lg">{currentStock ?? "Deleted"}</p>
          </div>
          {canReview ? (
            <Button size="sm" disabled={isRolePending} onClick={onReview}>
              Review
            </Button>
          ) : isRolePending ? (
            <Button size="sm" disabled>
              Loading access
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">
              Awaiting admin review
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryRow({ item }: { item: InventoryWorkHistoryView }) {
  if (item.kind === "inspection") {
    const inspection = item.inspection;
    return (
      <div className="flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <InventoryAvailabilityBadge state={inspection.status} />
          <div className="min-w-0">
            <p className="truncate font-medium">{inspection.productName}</p>
            <p className="text-sm text-muted-foreground">
              {variantText(inspection)}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {inspection.completedBy?.name ?? "Deleted staff account"} ·{" "}
          {age(inspection.completedAt ?? inspection.createdAt)}
        </p>
      </div>
    );
  }

  const request = item.request;
  return (
    <div className="flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <InventoryAvailabilityBadge
          state={request.status === "approved" ? "available" : "quarantined"}
        />
        <div className="min-w-0">
          <p className="truncate font-medium">
            {getInventoryCategoryLabel(request.category)}{" "}
            {request.requestedQuantity} unit
            {request.requestedQuantity === 1 ? "" : "s"} - {request.productName}
          </p>
          <p className="text-sm text-muted-foreground">
            {variantText(request)} · {request.explanation}
          </p>
        </div>
      </div>
      <p className="shrink-0 text-sm text-muted-foreground">
        {request.status} by {request.reviewer?.name ?? "Deleted staff account"}{" "}
        · {age(request.reviewedAt ?? request.createdAt)}
      </p>
    </div>
  );
}

export function RequestsTab({
  work,
  isLoading,
  role,
  isRolePending,
  variantsById,
  onRequestAdjustment,
  onReviewRequest,
  onCompleteInspection,
}: RequestsTabProps) {
  if (isLoading || !work) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse bg-muted" />
        <div className="h-24 animate-pulse bg-muted" />
      </div>
    );
  }

  const isWorker = role === "worker";
  const canReview = role === "admin" || role === "super_admin";
  const hasWork =
    work.pendingInspections.length > 0 || work.pendingRequestGroups.length > 0;

  return (
    <div className="space-y-8">
      {!hasWork && work.history.length === 0 ? (
        <EmptyWorkState />
      ) : (
        <>
          <section
            className="space-y-3"
            aria-labelledby="pending-inspections-heading"
          >
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-amber-700" />
              <h2
                id="pending-inspections-heading"
                className="text-sm font-semibold"
              >
                Pending inspections
              </h2>
              <Badge variant="secondary">
                {work.pendingInspections.length}
              </Badge>
            </div>
            {work.pendingInspections.length === 0 ? (
              <p className="border border-dashed p-4 text-sm text-muted-foreground">
                No low-stock inspections are waiting for a physical check.
              </p>
            ) : (
              <div className="space-y-2">
                {work.pendingInspections.map((inspection) => (
                  <InspectionRow
                    key={inspection.id}
                    inspection={inspection}
                    variant={
                      inspection.variantId
                        ? variantsById.get(inspection.variantId)
                        : undefined
                    }
                    isWorker={isWorker}
                    isRolePending={isRolePending}
                    onRequestAdjustment={onRequestAdjustment}
                    onComplete={onCompleteInspection}
                  />
                ))}
              </div>
            )}
          </section>

          <section
            className="space-y-3"
            aria-labelledby="pending-requests-heading"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-red-700" />
              <h2
                id="pending-requests-heading"
                className="text-sm font-semibold"
              >
                Pending adjustment requests
              </h2>
              <Badge variant="secondary">
                {work.pendingRequestGroups.reduce(
                  (total, group) => total + group.requests.length,
                  0
                )}
              </Badge>
            </div>
            {work.pendingRequestGroups.length === 0 ? (
              <p className="border border-dashed p-4 text-sm text-muted-foreground">
                No worker adjustment requests are waiting for review.
              </p>
            ) : (
              <div className="space-y-4">
                {work.pendingRequestGroups.map((group) => (
                  <div
                    key={group.variantId ?? `deleted-${group.sku}`}
                    className="border-l-4 border-red-400 bg-red-50/50 p-4 dark:bg-red-950/20"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <AlertTriangle className="size-4 text-red-700" />
                      <p className="font-medium">{group.productName}</p>
                      <span className="text-sm text-muted-foreground">
                        {group.sku}
                      </span>
                      <Badge variant="secondary">
                        {group.requests.length} pending
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {group.requests.map((request) => (
                        <RequestRow
                          key={request.id}
                          request={request}
                          currentStock={
                            request.variantId
                              ? (variantsById.get(request.variantId)
                                  ?.stockQuantity ?? null)
                              : null
                          }
                          canReview={canReview}
                          isRolePending={isRolePending}
                          onReview={() =>
                            onReviewRequest(request, group.requests)
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            className="space-y-3"
            aria-labelledby="inventory-history-heading"
          >
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-muted-foreground" />
              <h2
                id="inventory-history-heading"
                className="text-sm font-semibold"
              >
                Resolved history
              </h2>
              <Badge variant="secondary">{work.history.length}</Badge>
            </div>
            {work.history.length === 0 ? (
              <p className="border border-dashed p-4 text-sm text-muted-foreground">
                No resolved work yet.
              </p>
            ) : (
              <div className="border bg-background px-4">
                {work.history.map((item) => (
                  <HistoryRow
                    key={`${item.kind}-${item.kind === "inspection" ? item.inspection.id : item.request.id}`}
                    item={item}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
