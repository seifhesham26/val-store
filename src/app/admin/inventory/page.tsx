"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAdminWriteAccess } from "@/hooks/use-admin-write-access";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Package, AlertTriangle, History, ClipboardList } from "lucide-react";
import { InventoryHeader } from "@/components/admin/inventory/InventoryHeader";
import {
  AllStockTab,
  type InventoryVariant,
} from "@/components/admin/inventory/AllStockTab";
import { LowStockTab } from "@/components/admin/inventory/LowStockTab";
import { HistoryTab } from "@/components/admin/inventory/HistoryTab";
import { AdjustStockDialog } from "@/components/admin/inventory/AdjustStockDialog";
import { RequestAdjustmentDialog } from "@/components/admin/inventory/RequestAdjustmentDialog";
import { ReviewAdjustmentDialog } from "@/components/admin/inventory/ReviewAdjustmentDialog";
import { RequestsTab } from "@/components/admin/inventory/RequestsTab";
import type { InventoryAvailabilityState } from "@/domain/inventory/inventory-policy";
import type {
  InventoryAdjustmentRequestView,
  InventoryInspectionView,
} from "@/components/admin/inventory/inventory-work-ui";

function resolveInternalState(
  variant: { stockQuantity: number },
  hasPendingInspection: boolean,
  hasPendingFlaw: boolean
): InventoryAvailabilityState {
  if (hasPendingFlaw) return "quarantined";
  if (hasPendingInspection) return "inspection_pending";
  if (variant.stockQuantity <= 0) return "out_of_stock";
  return "available";
}

export default function AdminInventoryPage() {
  const [adjustingVariant, setAdjustingVariant] =
    useState<InventoryVariant | null>(null);
  const [requestingVariant, setRequestingVariant] = useState<{
    variant: InventoryVariant;
    inspectionId: string | null;
  } | null>(null);
  const [reviewingRequest, setReviewingRequest] = useState<{
    request: InventoryAdjustmentRequestView;
    siblingRequests: InventoryAdjustmentRequestView[];
    currentStock: number | null;
  } | null>(null);
  const [confirmingInspection, setConfirmingInspection] =
    useState<InventoryInspectionView | null>(null);

  const { role, isPending: isRolePending } = useAdminWriteAccess();
  const { data: variantPage, isLoading } =
    trpc.admin.inventory.listVariants.useQuery();
  const { data: lowStock = [] } = trpc.admin.inventory.getLowStock.useQuery({
    threshold: 20,
  });
  const { data: logs = [] } = trpc.admin.inventory.getLogs.useQuery({
    limit: 50,
  });
  const { data: work, isLoading: isWorkLoading } =
    trpc.admin.inventory.listWork.useQuery();
  const { data: pendingWorkCount = 0 } =
    trpc.admin.inventory.pendingCount.useQuery(undefined, {
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    });

  const utils = trpc.useUtils();
  const completeInspectionMutation =
    trpc.admin.inventory.completeInspection.useMutation({
      onMutate: async ({ inspectionId }) => {
        await utils.admin.inventory.listWork.cancel();
        const previousWork = utils.admin.inventory.listWork.getData();
        const previousCount = utils.admin.inventory.pendingCount.getData();
        const completedAt = new Date().toISOString();

        utils.admin.inventory.listWork.setData(undefined, (current) => {
          if (!current) return current;
          const pendingInspection = current.pendingInspections.find(
            (inspection) => inspection.id === inspectionId
          );
          if (!pendingInspection) return current;
          return {
            ...current,
            pendingInspections: current.pendingInspections.filter(
              (inspection) => inspection.id !== inspectionId
            ),
            history: [
              {
                kind: "inspection" as const,
                inspection: {
                  ...pendingInspection,
                  status: "all_fine" as const,
                  completedAt,
                },
              },
              ...current.history,
            ],
          };
        });
        if (previousCount !== undefined) {
          utils.admin.inventory.pendingCount.setData(
            undefined,
            Math.max(0, previousCount - 1)
          );
        }
        return { previousWork, previousCount };
      },
      onSuccess: () => {
        toast.success("Inspection marked all fine");
        setConfirmingInspection(null);
        invalidateInventory();
      },
      onError: (error, _input, context) => {
        if (context?.previousWork !== undefined) {
          utils.admin.inventory.listWork.setData(
            undefined,
            context.previousWork
          );
        }
        if (context?.previousCount !== undefined) {
          utils.admin.inventory.pendingCount.setData(
            undefined,
            context.previousCount
          );
        }
        toast.error(error.message);
      },
    });

  const allVariants = useMemo(
    () => variantPage?.items ?? [],
    [variantPage?.items]
  );
  const pendingInspections = useMemo(
    () => work?.pendingInspections ?? [],
    [work?.pendingInspections]
  );
  const pendingFlawIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of work?.pendingRequestGroups ?? []) {
      if (
        group.variantId &&
        group.requests.some((request) => request.category !== "extra")
      ) {
        ids.add(group.variantId);
      }
    }
    return ids;
  }, [work?.pendingRequestGroups]);
  const inspectionByVariant = useMemo(
    () =>
      new Map(
        pendingInspections.flatMap((inspection) =>
          inspection.variantId
            ? [[inspection.variantId, inspection] as const]
            : []
        )
      ),
    [pendingInspections]
  );
  const variantsById = useMemo(
    () =>
      new Map(
        allVariants.map((variant) => [variant.variantId, variant] as const)
      ),
    [allVariants]
  );
  const displayVariants = useMemo(
    () =>
      allVariants.map((variant) => ({
        ...variant,
        availabilityState: resolveInternalState(
          variant,
          inspectionByVariant.has(variant.variantId),
          pendingFlawIds.has(variant.variantId)
        ),
      })),
    [allVariants, inspectionByVariant, pendingFlawIds]
  );
  const displayLowStock = useMemo(
    () =>
      lowStock.map((variant) => ({
        ...variant,
        availabilityState: resolveInternalState(
          variant,
          inspectionByVariant.has(variant.variantId),
          pendingFlawIds.has(variant.variantId)
        ),
      })),
    [lowStock, inspectionByVariant, pendingFlawIds]
  );

  function invalidateInventory() {
    void Promise.all([
      utils.admin.inventory.listVariants.invalidate(),
      utils.admin.inventory.getLowStock.invalidate(),
      utils.admin.inventory.getLogs.invalidate(),
      utils.admin.inventory.listWork.invalidate(),
      utils.admin.inventory.pendingCount.invalidate(),
      utils.public.products.getStock.invalidate(),
      utils.public.cart.stockStatus.invalidate(),
    ]);
  }

  const handleRequestAdjustment = (
    variant: InventoryVariant,
    inspectionId?: string | null
  ) => {
    setRequestingVariant({ variant, inspectionId: inspectionId ?? null });
  };

  const handleReviewRequest = (
    request: InventoryAdjustmentRequestView,
    siblingRequests: InventoryAdjustmentRequestView[]
  ) => {
    setReviewingRequest({
      request,
      siblingRequests,
      currentStock: request.variantId
        ? (variantsById.get(request.variantId)?.stockQuantity ?? null)
        : null,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-64 bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <InventoryHeader
        lowStockCount={displayLowStock.length}
        pendingWorkCount={pendingWorkCount}
      />

      <Tabs defaultValue="all">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="all">
            <Package className="h-4 w-4" />
            All Stock ({displayVariants.length})
          </TabsTrigger>
          <TabsTrigger value="low">
            <AlertTriangle className="h-4 w-4" />
            Low Stock ({displayLowStock.length})
          </TabsTrigger>
          <TabsTrigger value="requests">
            <ClipboardList className="h-4 w-4" />
            Requests{pendingWorkCount > 0 ? ` (${pendingWorkCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <AllStockTab
            variants={displayVariants}
            total={variantPage?.total ?? displayVariants.length}
            onAdjust={setAdjustingVariant}
            onRequest={(variant) => handleRequestAdjustment(variant)}
            role={role}
            isRolePending={isRolePending}
          />
        </TabsContent>

        <TabsContent value="low">
          <LowStockTab
            variants={displayLowStock}
            onAdjust={setAdjustingVariant}
            onRequest={handleRequestAdjustment}
            inspectionByVariant={inspectionByVariant}
            onCompleteInspection={setConfirmingInspection}
            role={role}
            isRolePending={isRolePending}
          />
        </TabsContent>

        <TabsContent value="requests">
          <RequestsTab
            work={work}
            isLoading={isWorkLoading}
            role={role}
            isRolePending={isRolePending}
            variantsById={variantsById}
            onRequestAdjustment={handleRequestAdjustment}
            onReviewRequest={handleReviewRequest}
            onCompleteInspection={setConfirmingInspection}
          />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab logs={logs} />
        </TabsContent>
      </Tabs>

      <AdjustStockDialog
        variant={adjustingVariant}
        open={!!adjustingVariant}
        onOpenChange={(open) => !open && setAdjustingVariant(null)}
        onSuccess={invalidateInventory}
      />

      <RequestAdjustmentDialog
        key={
          requestingVariant
            ? requestingVariant.variant.variantId
            : "closed-request"
        }
        variant={requestingVariant?.variant ?? null}
        inspectionId={requestingVariant?.inspectionId}
        open={!!requestingVariant}
        onOpenChange={(open) => !open && setRequestingVariant(null)}
        onSuccess={invalidateInventory}
      />

      <ReviewAdjustmentDialog
        key={reviewingRequest ? reviewingRequest.request.id : "closed-review"}
        request={reviewingRequest?.request ?? null}
        siblingRequests={reviewingRequest?.siblingRequests ?? []}
        currentStock={reviewingRequest?.currentStock ?? null}
        open={!!reviewingRequest}
        onOpenChange={(open) => !open && setReviewingRequest(null)}
        onSuccess={invalidateInventory}
      />

      <AlertDialog
        open={!!confirmingInspection}
        onOpenChange={(open) => !open && setConfirmingInspection(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Complete this low-stock inspection?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Confirm that you physically checked the remaining units for{" "}
              {confirmingInspection?.productName}. This releases the protected
              floor immediately and changes no recorded stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completeInspectionMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                completeInspectionMutation.isPending || !confirmingInspection
              }
              onClick={(event) => {
                event.preventDefault();
                if (confirmingInspection) {
                  completeInspectionMutation.mutate({
                    inspectionId: confirmingInspection.id,
                  });
                }
              }}
            >
              <Check />
              {completeInspectionMutation.isPending
                ? "Saving..."
                : "Checked all units - everything is fine"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
