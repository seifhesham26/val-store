import { db } from "@/db";
import {
  inventoryAdjustmentRequests,
  inventoryInspections,
  inventoryLogs,
  productVariants,
} from "@/db/schema";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type {
  CreateAdjustmentRequestCommand,
  InventoryAdjustmentRequestRecord,
  InventoryCommandActor,
  InventoryInspectionRecord,
  ReviewAdjustmentRequestCommand,
} from "@/domain/inventory/inventory-operations";
import type {
  InventoryRequestsRepositoryInterface,
  InventoryWorkHistoryItem,
  InventoryWorkList,
  InventoryWorkResult,
} from "@/domain/inventory/interfaces/repositories/inventory-requests.repository.interface";
import {
  lockVariantStockState,
  reconcileLowStockCycle,
} from "./inventory-stock-state";

type RequestRow = typeof inventoryAdjustmentRequests.$inferSelect;
type InspectionRow = typeof inventoryInspections.$inferSelect;

function requestRecord(row: RequestRow): InventoryAdjustmentRequestRecord {
  const { requesterId, requesterName, reviewerId, reviewerName, ...record } =
    row;
  return {
    ...record,
    requester: { id: requesterId, name: requesterName },
    reviewer:
      reviewerName === null ? null : { id: reviewerId, name: reviewerName },
  };
}

function inspectionRecord(
  row: InspectionRow,
  adjustmentRequestId: string | null = null
): InventoryInspectionRecord {
  const { completedBy, completedByName, ...record } = row;
  return {
    ...record,
    completedBy:
      completedByName === null
        ? null
        : { id: completedBy, name: completedByName },
    adjustmentRequestId,
  };
}

export class DrizzleInventoryRequestsRepository implements InventoryRequestsRepositoryInterface {
  async submit(
    command: CreateAdjustmentRequestCommand
  ): Promise<
    InventoryWorkResult<{ request: InventoryAdjustmentRequestRecord }>
  > {
    return db.transaction(async (tx) => {
      const variant = await lockVariantStockState(tx, command.variantId);
      if (!variant) return { success: false, error: "variant_deleted" };
      if (!variant.isAvailable)
        return { success: false, error: "variant_unavailable" };
      const explanation = command.explanation.trim();
      if (!explanation || explanation.length > 500)
        return { success: false, error: "invalid_explanation" };
      if (
        !Number.isSafeInteger(command.requestedQuantity) ||
        command.requestedQuantity <= 0
      )
        return { success: false, error: "invalid_quantity" };
      if (!["damaged", "missing", "extra"].includes(command.category))
        return { success: false, error: "invalid_category" };

      const inspectionId =
        command.inspectionId ??
        (variant.pendingInspection ? variant.openInspectionId : null);
      if (
        inspectionId &&
        (inspectionId !== variant.openInspectionId ||
          !variant.pendingInspection)
      )
        return { success: false, error: "conflict" };

      // A pending damaged/missing row is the quarantine. Inserting while the
      // variant is locked makes that quarantine atomic against every writer.
      const [saved] = await tx
        .insert(inventoryAdjustmentRequests)
        .values({
          variantId: variant.id,
          inspectionId,
          productName: variant.productName,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          requesterId: command.requester.id,
          requesterName: command.requester.name,
          category: command.category,
          requestedQuantity: command.requestedQuantity,
          explanation,
          stockAtRequest: variant.stockQuantity,
        })
        .returning();
      if (inspectionId && command.category !== "extra") {
        const [completed] = await tx
          .update(inventoryInspections)
          .set({
            status: "flaw_reported",
            completedBy: command.requester.id,
            completedByName: command.requester.name,
            completedAt: new Date(),
          })
          .where(
            and(
              eq(inventoryInspections.id, inspectionId),
              eq(inventoryInspections.status, "pending"),
              isNull(inventoryInspections.cycleEndedAt)
            )
          )
          .returning({ id: inventoryInspections.id });
        // Impossible for cooperating writers under the variant lock. Throw so
        // a future bypass cannot commit a request with a lost inspection write.
        if (!completed)
          throw new Error("Inspection changed while variant was locked");
      }
      return { success: true, request: requestRecord(saved) };
    });
  }

  async completeAllFine(command: {
    inspectionId: string;
    worker: InventoryCommandActor;
  }): Promise<InventoryWorkResult<{ inspection: InventoryInspectionRecord }>> {
    return db.transaction(async (tx) => {
      // Discover only the immutable FK before locking; never decide from this
      // read. The guarded update below is authoritative after the variant lock.
      const [identity] = await tx
        .select({ variantId: inventoryInspections.variantId })
        .from(inventoryInspections)
        .where(eq(inventoryInspections.id, command.inspectionId));
      if (!identity) return { success: false, error: "not_found" };
      const variant = identity.variantId
        ? await lockVariantStockState(tx, identity.variantId)
        : null;
      if (!variant) return { success: false, error: "variant_deleted" };
      const [saved] = await tx
        .update(inventoryInspections)
        .set({
          status: "all_fine",
          completedBy: command.worker.id,
          completedByName: command.worker.name,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(inventoryInspections.id, command.inspectionId),
            eq(inventoryInspections.variantId, variant.id),
            eq(inventoryInspections.status, "pending"),
            isNull(inventoryInspections.cycleEndedAt)
          )
        )
        .returning();
      if (!saved) return { success: false, error: "conflict" };
      return { success: true, inspection: inspectionRecord(saved) };
    });
  }

  async review(
    command: ReviewAdjustmentRequestCommand
  ): Promise<
    InventoryWorkResult<{ request: InventoryAdjustmentRequestRecord }>
  > {
    return db.transaction(async (tx) => {
      // Identity discovery does not lock the child ahead of its parent. The
      // request is re-read FOR UPDATE only after acquiring the variant lock.
      const [identity] = await tx
        .select({ variantId: inventoryAdjustmentRequests.variantId })
        .from(inventoryAdjustmentRequests)
        .where(eq(inventoryAdjustmentRequests.id, command.requestId));
      if (!identity) return { success: false, error: "not_found" };
      const variant = identity.variantId
        ? await lockVariantStockState(tx, identity.variantId)
        : null;
      const [original] = await tx
        .select()
        .from(inventoryAdjustmentRequests)
        .where(eq(inventoryAdjustmentRequests.id, command.requestId))
        .for("update");
      if (!original) return { success: false, error: "not_found" };
      if (original.status !== "pending")
        return { success: false, error: "conflict" };
      if (!["approved", "rejected"].includes(command.decision))
        return { success: false, error: "invalid_decision" };
      if (command.decision === "approved" && !variant)
        return { success: false, error: "variant_deleted" };
      const quantity = command.approvedQuantity ?? original.requestedQuantity;
      if (!Number.isSafeInteger(quantity) || quantity <= 0)
        return { success: false, error: "invalid_quantity" };
      const decisionExplanation = command.decisionExplanation?.trim() || null;
      if (decisionExplanation && decisionExplanation.length > 500)
        return { success: false, error: "invalid_explanation" };
      if (
        (command.decision === "rejected" ||
          quantity !== original.requestedQuantity) &&
        !decisionExplanation
      )
        return { success: false, error: "decision_explanation_required" };

      let inventoryLogId: string | null = null;
      if (command.decision === "approved" && variant) {
        const delta = original.category === "extra" ? quantity : -quantity;
        const nextStock = variant.stockQuantity + delta;
        if (nextStock < 0)
          return { success: false, error: "insufficient_stock" };
        await tx
          .update(productVariants)
          .set({ stockQuantity: nextStock, updatedAt: new Date() })
          .where(eq(productVariants.id, variant.id));
        const [log] = await tx
          .insert(inventoryLogs)
          .values({
            variantId: variant.id,
            changeType:
              original.category === "damaged" ? "damaged" : "adjustment",
            quantityChange: delta,
            previousQuantity: variant.stockQuantity,
            newQuantity: nextStock,
            reason: `Inventory request ${original.id}: ${decisionExplanation ?? original.explanation}`,
            createdBy: command.reviewer.id,
          })
          .returning({ id: inventoryLogs.id });
        inventoryLogId = log.id;
        await reconcileLowStockCycle(tx, {
          variant,
          previousStock: variant.stockQuantity,
          stockQuantity: nextStock,
        });
      }
      const [saved] = await tx
        .update(inventoryAdjustmentRequests)
        .set({
          status: command.decision,
          approvedQuantity: command.decision === "approved" ? quantity : null,
          decisionExplanation,
          reviewerId: command.reviewer.id,
          reviewerName: command.reviewer.name,
          reviewedAt: new Date(),
          inventoryLogId,
        })
        .where(
          and(
            eq(inventoryAdjustmentRequests.id, original.id),
            eq(inventoryAdjustmentRequests.status, "pending")
          )
        )
        .returning();
      if (!saved) throw new Error("Request changed while locked");
      return { success: true, request: requestRecord(saved) };
    });
  }

  async listWork(): Promise<InventoryWorkList> {
    // One snapshot prevents a review between the two reads from making an
    // inspection and its request disagree in the same work-list response.
    return db.transaction(
      async (tx) => {
        const [inspectionRows, requestRows] = await Promise.all([
          tx
            .select()
            .from(inventoryInspections)
            .orderBy(
              asc(inventoryInspections.sku),
              asc(inventoryInspections.variantId),
              asc(inventoryInspections.createdAt),
              asc(inventoryInspections.id)
            ),
          tx
            .select()
            .from(inventoryAdjustmentRequests)
            .orderBy(
              asc(inventoryAdjustmentRequests.sku),
              asc(inventoryAdjustmentRequests.variantId),
              asc(inventoryAdjustmentRequests.createdAt),
              asc(inventoryAdjustmentRequests.id)
            ),
        ]);
        const flawByInspection = new Map<string, string>();
        for (const row of requestRows) {
          if (
            row.inspectionId &&
            row.category !== "extra" &&
            !flawByInspection.has(row.inspectionId)
          )
            flawByInspection.set(row.inspectionId, row.id);
        }
        const result: InventoryWorkList = {
          pendingInspections: [],
          pendingRequestGroups: [],
          history: [],
        };
        for (const row of inspectionRows) {
          const inspection = inspectionRecord(
            row,
            flawByInspection.get(row.id) ?? null
          );
          if (row.status === "pending" && !row.cycleEndedAt && row.variantId)
            result.pendingInspections.push(inspection);
          else result.history.push({ kind: "inspection", inspection });
        }
        const groups = new Map<
          string,
          InventoryWorkList["pendingRequestGroups"][number]
        >();
        for (const row of requestRows) {
          const request = requestRecord(row);
          if (row.status !== "pending") {
            result.history.push({ kind: "request", request });
            continue;
          }
          // Deleted variants keep their own SKU group rather than collapsing all
          // historical variants into a single null-variant group.
          const key = row.variantId ?? `deleted:${row.sku}`;
          let group = groups.get(key);
          if (!group) {
            group = {
              variantId: row.variantId,
              sku: row.sku,
              productName: row.productName,
              requests: [],
            };
            groups.set(key, group);
            result.pendingRequestGroups.push(group);
          }
          group.requests.push(request);
        }
        const historyKey = (item: InventoryWorkHistoryItem) =>
          item.kind === "request"
            ? {
                time: (
                  item.request.reviewedAt ?? item.request.createdAt
                ).getTime(),
                id: item.request.id,
              }
            : {
                time: (
                  item.inspection.completedAt ??
                  item.inspection.cycleEndedAt ??
                  item.inspection.createdAt
                ).getTime(),
                id: item.inspection.id,
              };
        result.history.sort((a, b) => {
          const left = historyKey(a);
          const right = historyKey(b);
          return right.time - left.time || right.id.localeCompare(left.id);
        });
        return result;
      },
      { isolationLevel: "repeatable read", accessMode: "read only" }
    );
  }

  async countPending(): Promise<number> {
    const [row] = await db.execute<{ count: number }>(sql`select (
      (select count(*) from ${inventoryInspections} where status = 'pending' and cycle_ended_at is null and variant_id is not null)
      + (select count(*) from ${inventoryAdjustmentRequests} where status = 'pending')
    )::int as count`);
    return row.count;
  }
}
