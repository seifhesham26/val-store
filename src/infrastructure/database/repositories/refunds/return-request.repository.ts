import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  inventoryLogs,
  orderItems,
  orders,
  productVariants,
  returnCarrierClaims,
  returnEvidence,
  returnEvidenceAccessAudits,
  returnPackageEvents,
  returnProposals,
  returnRequestItems,
  returnRequests,
} from "@/db/schema";
import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import {
  assertReturnActionAllowed,
  carrierClaimDeadline,
  transitionReturnRequest,
  type ReturnProposalRecord,
  type ReturnRequestItemRecord,
  type ReturnRequestRecord,
  type ReturnRequestStatus,
} from "@/domain/refunds/return-request";
import {
  lockVariantStockState,
  reconcileLowStockCycle,
} from "@/infrastructure/database/repositories/inventory/inventory-stock-state";

const unresolvedStatuses: ReturnRequestStatus[] = [
  "requested",
  "awaiting_customer_evidence",
  "pickup_authorized",
  "pickup_pending",
  "in_transit",
  "received",
  "count_disputed",
  "inspection_pending",
  "awaiting_customer_confirmation",
  "disputed",
  "customer_action_required",
  "confirmed",
  "evidence_exception",
];

const singleFileEvidenceKinds = new Set([
  "customer_product_photo",
  "customer_package_photo",
  "receiving_inspection_video",
]);

function money(value: string | number): number {
  return typeof value === "number" ? value : Number.parseFloat(value);
}

function mapItem(
  row: typeof returnRequestItems.$inferSelect
): ReturnRequestItemRecord {
  return {
    id: row.id,
    orderItemId: row.orderItemId,
    requestedQuantity: row.requestedQuantity,
    receivedQuantity: row.receivedQuantity,
    inspectedQuantity: row.inspectedQuantity,
    approvedQuantity: row.approvedQuantity,
    returnedQuantity: row.returnedQuantity,
    restockedQuantity: row.restockedQuantity,
    refundedQuantity: row.refundedQuantity,
    outcome: row.outcome,
    fault: row.fault,
    itemRefund: money(row.itemRefund),
  };
}

function mapProposal(
  row: typeof returnProposals.$inferSelect | null | undefined
): ReturnProposalRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    version: row.version,
    itemRefund: money(row.itemRefund),
    deliveryRefund: money(row.deliveryRefund),
    collectionDue: money(row.collectionDue),
    totalRefund: money(row.totalRefund),
    payoutDestination: row.payoutDestination,
    customerCopy: row.customerCopy,
    calculation: row.calculation,
    createdAt: row.createdAt,
  };
}

function mapRequest(row: {
  id: string;
  orderId: string;
  customerId: string;
  status: ReturnRequestStatus;
  reason: ReturnRequestRecord["reason"];
  customerNote: string | null;
  pickupMethod: ReturnRequestRecord["pickupMethod"];
  physicalStatus: ReturnRequestRecord["physicalStatus"];
  payoutStatus: ReturnRequestRecord["payoutStatus"];
  proposalVersion: number;
  proposalOpenedAt: Date | null;
  acknowledgedAt: Date | null;
  confirmedAt: Date | null;
  recordedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items?: (typeof returnRequestItems.$inferSelect)[];
  proposals?: (typeof returnProposals.$inferSelect)[];
}): ReturnRequestRecord {
  const proposal = row.proposals?.find(
    (candidate) => candidate.version === row.proposalVersion
  );
  return {
    id: row.id,
    orderId: row.orderId,
    customerId: row.customerId,
    status: row.status,
    reason: row.reason,
    customerNote: row.customerNote,
    pickupMethod: row.pickupMethod,
    physicalStatus: row.physicalStatus,
    payoutStatus: row.payoutStatus,
    proposalVersion: row.proposalVersion,
    proposalOpenedAt: row.proposalOpenedAt,
    acknowledgedAt: row.acknowledgedAt,
    confirmedAt: row.confirmedAt,
    recordedAt: row.recordedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: row.items?.map(mapItem) ?? [],
    proposal: mapProposal(proposal),
  };
}

async function loadRequest(
  requestId: string,
  customerId?: string
): Promise<ReturnRequestRecord | null> {
  const row = await db.query.returnRequests.findFirst({
    where: and(
      eq(returnRequests.id, requestId),
      customerId ? eq(returnRequests.customerId, customerId) : undefined
    ),
    with: {
      items: true,
      proposals: true,
    },
  });
  return row ? mapRequest(row) : null;
}

function conflict(message: string): Error {
  return new Error(`Return request conflict: ${message}`);
}

export class DrizzleReturnRequestRepository implements ReturnRequestRepositoryInterface {
  async create(
    input: Parameters<ReturnRequestRepositoryInterface["create"]>[0]
  ): Promise<ReturnRequestRecord> {
    if (input.lines.length === 0) {
      throw new Error("Select at least one order line to return");
    }
    const seen = new Set<string>();
    for (const line of input.lines) {
      if (seen.has(line.orderItemId)) {
        throw new Error("The same order line cannot appear twice");
      }
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new Error("Return quantities must be positive whole numbers");
      }
      seen.add(line.orderItemId);
    }

    const requestId = await db.transaction(async (tx) => {
      const [ownedOrder] = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(eq(orders.id, input.orderId), eq(orders.userId, input.customerId))
        )
        .limit(1);
      if (!ownedOrder) throw new Error("Order not found");

      const requestedIds = input.lines.map((line) => line.orderItemId);
      const rows = await tx
        .select({
          id: orderItems.id,
          quantity: orderItems.quantity,
          refundedQuantity: orderItems.refundedQuantity,
        })
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, input.orderId),
            inArray(orderItems.id, requestedIds)
          )
        );
      if (rows.length !== requestedIds.length) {
        throw new Error("A selected line is not part of this order");
      }
      for (const line of input.lines) {
        const row = rows.find(
          (candidate) => candidate.id === line.orderItemId
        )!;
        if (line.quantity > row.quantity - row.refundedQuantity) {
          throw new Error("A selected quantity is no longer refundable");
        }
      }

      const [request] = await tx
        .insert(returnRequests)
        .values({
          orderId: input.orderId,
          customerId: input.customerId,
          reason: input.reason,
          customerNote: input.customerNote,
          pickupMethod: input.pickupMethod,
          status: "requested",
        })
        .returning({ id: returnRequests.id });
      await tx.insert(returnRequestItems).values(
        input.lines.map((line) => ({
          requestId: request.id,
          orderItemId: line.orderItemId,
          requestedQuantity: line.quantity,
        }))
      );
      return request.id;
    });

    return (await loadRequest(requestId))!;
  }

  findForCustomer(requestId: string, customerId: string) {
    return loadRequest(requestId, customerId);
  }

  async listForOrder(orderId: string, customerId: string) {
    const rows = await db.query.returnRequests.findMany({
      where: and(
        eq(returnRequests.orderId, orderId),
        eq(returnRequests.customerId, customerId)
      ),
      with: { items: true, proposals: true },
      orderBy: [desc(returnRequests.createdAt)],
    });
    return rows.map(mapRequest);
  }

  findForStaff(requestId: string) {
    return loadRequest(requestId);
  }

  async listWork(limit = 50) {
    const rows = await db.query.returnRequests.findMany({
      where: inArray(returnRequests.status, unresolvedStatuses),
      with: { items: true, proposals: true },
      orderBy: [asc(returnRequests.createdAt)],
      limit: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map(mapRequest);
  }

  async countWork() {
    const [row] = await db
      .select({ value: count() })
      .from(returnRequests)
      .where(inArray(returnRequests.status, unresolvedStatuses));
    return row?.value ?? 0;
  }

  async transition(
    requestId: string,
    expectedStatus: ReturnRequestStatus,
    targetStatus: ReturnRequestStatus
  ) {
    transitionReturnRequest(expectedStatus, targetStatus);
    const [updated] = await db
      .update(returnRequests)
      .set({ status: targetStatus, updatedAt: new Date() })
      .where(
        and(
          eq(returnRequests.id, requestId),
          eq(returnRequests.status, expectedStatus)
        )
      )
      .returning({ id: returnRequests.id });
    if (!updated) throw conflict("the request changed; reload and try again");
    return (await loadRequest(updated.id))!;
  }

  async attachEvidence(
    input: Parameters<ReturnRequestRepositoryInterface["attachEvidence"]>[0]
  ) {
    await db.transaction(async (tx) => {
      // The request row serializes concurrent completion callbacks. Without
      // this lock, two valid UploadThing tokens could both observe zero rows
      // and record a second required photo/video.
      const [request] = await tx
        .select({
          status: returnRequests.status,
          customerId: returnRequests.customerId,
        })
        .from(returnRequests)
        .where(eq(returnRequests.id, input.requestId))
        .for("update")
        .limit(1);
      if (!request) throw new Error("Return request not found");

      const customerEvidence = input.kind.startsWith("customer_");
      assertReturnActionAllowed(
        request.status,
        customerEvidence ? "attach_customer_evidence" : "attach_staff_evidence"
      );
      if (customerEvidence) {
        if (
          input.uploaderRole !== "customer" ||
          input.uploaderId !== request.customerId
        ) {
          throw new Error(
            "Customer evidence belongs to the request owner only"
          );
        }
      } else if (input.uploaderRole === "customer") {
        throw new Error("Staff evidence cannot be uploaded by a customer");
      }

      if (singleFileEvidenceKinds.has(input.kind)) {
        const [{ value }] = await tx
          .select({ value: count() })
          .from(returnEvidence)
          .where(
            and(
              eq(returnEvidence.requestId, input.requestId),
              eq(returnEvidence.kind, input.kind)
            )
          );
        if (value > 0) {
          throw new Error(
            `${input.kind} is already uploaded for this return request`
          );
        }
      }

      await tx.insert(returnEvidence).values({
        requestId: input.requestId,
        uploaderId: input.uploaderId,
        uploaderRole: input.uploaderRole,
        kind: input.kind,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        contentHash: input.contentHash,
        originalMetadata: input.originalMetadata,
      });
    });
  }

  async countEvidence(
    input: Parameters<ReturnRequestRepositoryInterface["countEvidence"]>[0]
  ): Promise<number> {
    const [{ value }] = await db
      .select({ value: count() })
      .from(returnEvidence)
      .where(
        and(
          eq(returnEvidence.requestId, input.requestId),
          eq(returnEvidence.kind, input.kind)
        )
      );
    return value;
  }

  async findEvidence(
    input: Parameters<ReturnRequestRepositoryInterface["findEvidence"]>[0]
  ) {
    const [evidence] = await db
      .select({
        id: returnEvidence.id,
        requestId: returnEvidence.requestId,
        storageKey: returnEvidence.storageKey,
      })
      .from(returnEvidence)
      .where(
        and(
          eq(returnEvidence.requestId, input.requestId),
          eq(returnEvidence.storageKey, input.storageKey)
        )
      )
      .limit(1);
    return evidence ?? null;
  }

  async recordEvidenceAccess(
    input: Parameters<
      ReturnRequestRepositoryInterface["recordEvidenceAccess"]
    >[0]
  ): Promise<void> {
    await db.insert(returnEvidenceAccessAudits).values(input);
  }

  async recordPackageEvent(
    input: Parameters<ReturnRequestRepositoryInterface["recordPackageEvent"]>[0]
  ) {
    const request = await loadRequest(input.requestId);
    if (!request) throw new Error("Return request not found");
    assertReturnActionAllowed(request.status, "record_package_event");
    if (!Number.isInteger(input.packageCount) || input.packageCount <= 0) {
      throw new Error("Package count must be a positive whole number");
    }
    await db.insert(returnPackageEvents).values({
      requestId: input.requestId,
      kind: input.kind,
      packageCount: input.packageCount,
      itemCount: input.itemCount,
      sealIntact: input.sealIntact,
      note: input.note,
      recordedBy: input.recordedBy,
      correctionOfId: input.correctionOfId,
    });
  }

  async recordInspection(
    input: Parameters<ReturnRequestRepositoryInterface["recordInspection"]>[0]
  ) {
    const request = await loadRequest(input.requestId);
    if (!request) throw new Error("Return request not found");
    if (request.status !== input.expectedStatus) {
      throw conflict("the request changed before inspection was saved");
    }
    assertReturnActionAllowed(request.status, "record_inspection");
    await db.transaction(async (tx) => {
      for (const line of input.lines) {
        const [updated] = await tx
          .update(returnRequestItems)
          .set({
            receivedQuantity: line.receivedQuantity,
            inspectedQuantity: line.inspectedQuantity,
            approvedQuantity: line.approvedQuantity,
            restockedQuantity: line.restockedQuantity,
            outcome: line.outcome,
            fault: line.fault,
            itemRefund: line.itemRefund.toFixed(2),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(returnRequestItems.id, line.requestItemId),
              eq(returnRequestItems.requestId, input.requestId)
            )
          )
          .returning({ id: returnRequestItems.id });
        if (!updated) throw new Error("A return line no longer exists");
      }
      const [updatedRequest] = await tx
        .update(returnRequests)
        .set({
          status: "inspection_pending",
          reviewerId: input.reviewerId,
          physicalStatus: "received",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(returnRequests.id, input.requestId),
            eq(returnRequests.status, input.expectedStatus)
          )
        )
        .returning({ id: returnRequests.id });
      if (!updatedRequest)
        throw conflict("inspection lost a concurrent update");
    });
    return (await loadRequest(input.requestId))!;
  }

  async saveProposal(
    input: Parameters<ReturnRequestRepositoryInterface["saveProposal"]>[0]
  ) {
    await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(returnRequests)
        .where(eq(returnRequests.id, input.requestId))
        .for("update");
      if (!request) throw new Error("Return request not found");
      assertReturnActionAllowed(request.status, "save_proposal");
      if (request.proposalVersion !== input.expectedVersion) {
        throw conflict("the proposal version is stale");
      }
      const version = request.proposalVersion + 1;
      await tx.insert(returnProposals).values({
        requestId: request.id,
        version,
        itemRefund: input.itemRefund.toFixed(2),
        deliveryRefund: input.deliveryRefund.toFixed(2),
        collectionDue: input.collectionDue.toFixed(2),
        totalRefund: input.totalRefund.toFixed(2),
        payoutDestination: input.payoutDestination,
        customerCopy: input.customerCopy,
        calculation: input.calculation,
        createdBy: input.actorId,
      });
      await tx
        .update(returnRequests)
        .set({
          status: "awaiting_customer_confirmation",
          proposalVersion: version,
          proposalOpenedAt: null,
          acknowledgedAt: null,
          confirmedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(returnRequests.id, request.id));
    });
    return (await loadRequest(input.requestId))!;
  }

  async markProposalOpened(
    input: Parameters<ReturnRequestRepositoryInterface["markProposalOpened"]>[0]
  ) {
    const now = new Date();
    const [updated] = await db
      .update(returnRequests)
      .set({ proposalOpenedAt: now, updatedAt: now })
      .where(
        and(
          eq(returnRequests.id, input.requestId),
          eq(returnRequests.customerId, input.customerId),
          eq(returnRequests.proposalVersion, input.proposalVersion),
          inArray(returnRequests.status, [
            "awaiting_customer_confirmation",
            "customer_action_required",
          ])
        )
      )
      .returning({ proposalOpenedAt: returnRequests.proposalOpenedAt });
    if (!updated?.proposalOpenedAt)
      throw conflict("the proposal is no longer current");
    return updated.proposalOpenedAt;
  }

  async acknowledgeProposal(
    input: Parameters<
      ReturnRequestRepositoryInterface["acknowledgeProposal"]
    >[0]
  ) {
    const [updated] = await db
      .update(returnRequests)
      .set({
        acknowledgedAt: input.acknowledgedAt,
        updatedAt: input.acknowledgedAt,
      })
      .where(
        and(
          eq(returnRequests.id, input.requestId),
          eq(returnRequests.customerId, input.customerId),
          eq(returnRequests.proposalVersion, input.proposalVersion),
          inArray(returnRequests.status, [
            "awaiting_customer_confirmation",
            "customer_action_required",
          ])
        )
      )
      .returning({ id: returnRequests.id });
    if (!updated) throw conflict("the proposal is no longer current");
    return (await loadRequest(updated.id))!;
  }

  async reject(
    input: Parameters<ReturnRequestRepositoryInterface["reject"]>[0]
  ) {
    await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(returnRequests)
        .where(eq(returnRequests.id, input.requestId))
        .for("update");
      if (!request) throw new Error("Return request not found");
      transitionReturnRequest(request.status, "rejected");
      await tx
        .update(returnRequests)
        .set({
          status: "rejected",
          reviewerId: input.reviewerId,
          reviewNote: input.reason,
          rejectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(returnRequests.id, input.requestId));
    });
    return (await loadRequest(input.requestId))!;
  }

  async submitDispute(
    input: Parameters<ReturnRequestRepositoryInterface["submitDispute"]>[0]
  ) {
    if (!input.reason.trim()) throw new Error("A dispute reason is required");
    const now = new Date();
    const [updated] = await db
      .update(returnRequests)
      .set({
        status: "disputed",
        disputeReason: input.reason.trim(),
        disputedAt: now,
        disputeLevel: 1,
        payoutStatus: "pending",
        updatedAt: now,
      })
      .where(
        and(
          eq(returnRequests.id, input.requestId),
          eq(returnRequests.customerId, input.customerId),
          eq(returnRequests.proposalVersion, input.proposalVersion),
          eq(returnRequests.status, "awaiting_customer_confirmation")
        )
      )
      .returning({ id: returnRequests.id });
    if (!updated) throw conflict("the proposal is no longer current");
    return (await loadRequest(updated.id))!;
  }

  async reviewDispute(
    input: Parameters<ReturnRequestRepositoryInterface["reviewDispute"]>[0]
  ) {
    const [updated] = await db
      .update(returnRequests)
      .set({
        reviewerId: input.reviewerId,
        disputeLevel: input.expectedLevel + 1,
        status: "inspection_pending",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(returnRequests.id, input.requestId),
          eq(returnRequests.status, "disputed"),
          eq(returnRequests.disputeLevel, input.expectedLevel)
        )
      )
      .returning({ id: returnRequests.id });
    if (!updated) throw conflict("the dispute was already reviewed");
    return (await loadRequest(updated.id))!;
  }

  async finalize(
    input: Parameters<ReturnRequestRepositoryInterface["finalize"]>[0]
  ) {
    await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(returnRequests)
        .where(eq(returnRequests.id, input.requestId))
        .for("update");
      if (!request || request.customerId !== input.customerId) {
        throw new Error("Return request not found");
      }
      assertReturnActionAllowed(request.status, "finalize");
      if (request.proposalVersion !== input.proposalVersion) {
        throw conflict("the confirmed proposal is stale");
      }

      const [proposal] = await tx
        .select()
        .from(returnProposals)
        .where(
          and(
            eq(returnProposals.requestId, request.id),
            eq(returnProposals.version, input.proposalVersion)
          )
        );
      if (!proposal) throw conflict("the confirmed proposal is missing");

      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, request.orderId))
        .for("update");
      if (!order) throw new Error("Order not found");
      const shippingRefund = money(proposal.deliveryRefund);
      const shippingRemaining = Math.max(
        0,
        money(order.shippingAmount) - money(order.refundedShippingAmount)
      );
      if (shippingRefund > shippingRemaining + 0.001) {
        throw conflict("delivery money has already been refunded");
      }

      const requestLines = await tx
        .select()
        .from(returnRequestItems)
        .where(eq(returnRequestItems.requestId, request.id))
        .orderBy(asc(returnRequestItems.orderItemId));
      const lockedOrderLines = await tx
        .select()
        .from(orderItems)
        .where(
          inArray(
            orderItems.id,
            requestLines.map((line) => line.orderItemId)
          )
        )
        .orderBy(asc(orderItems.id))
        .for("update");

      const now = new Date();
      for (const line of requestLines) {
        const orderLine = lockedOrderLines.find(
          (candidate) => candidate.id === line.orderItemId
        );
        if (!orderLine) throw conflict("an order line is missing");
        if (
          line.approvedQuantity < 0 ||
          line.restockedQuantity < 0 ||
          line.restockedQuantity > line.receivedQuantity ||
          line.approvedQuantity > line.requestedQuantity ||
          orderLine.refundedQuantity + line.approvedQuantity >
            orderLine.quantity
        ) {
          throw conflict("approved quantities no longer fit the order");
        }

        const [bumped] = await tx
          .update(orderItems)
          .set({
            refundedQuantity: sql`${orderItems.refundedQuantity} + ${line.approvedQuantity}`,
          })
          .where(
            and(
              eq(orderItems.id, line.orderItemId),
              sql`${orderItems.refundedQuantity} + ${line.approvedQuantity} <= ${orderItems.quantity}`
            )
          )
          .returning({ id: orderItems.id });
        if (!bumped) throw conflict("an order line was finalized concurrently");

        if (line.restockedQuantity > 0 && orderLine.variantId) {
          const variant = await lockVariantStockState(tx, orderLine.variantId);
          if (!variant) throw conflict("the returned variant no longer exists");
          const newQuantity = variant.stockQuantity + line.restockedQuantity;
          await tx
            .update(productVariants)
            .set({ stockQuantity: newQuantity, updatedAt: now })
            .where(eq(productVariants.id, orderLine.variantId));
          await tx.insert(inventoryLogs).values({
            variantId: orderLine.variantId,
            changeType: "return",
            quantityChange: line.restockedQuantity,
            previousQuantity: variant.stockQuantity,
            newQuantity,
            reason: `Authorized return ${request.id}`,
            createdAt: now,
          });
          await reconcileLowStockCycle(tx, {
            variant,
            previousStock: variant.stockQuantity,
            stockQuantity: newQuantity,
          });
        }

        await tx
          .update(returnRequestItems)
          .set({
            returnedQuantity: line.receivedQuantity,
            refundedQuantity: line.approvedQuantity,
            updatedAt: now,
          })
          .where(eq(returnRequestItems.id, line.id));
      }

      await tx
        .update(orders)
        .set({
          refundedShippingAmount: sql`${orders.refundedShippingAmount} + ${shippingRefund.toFixed(2)}`,
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));
      const [recorded] = await tx
        .update(returnRequests)
        .set({ status: "recorded", recordedAt: now, updatedAt: now })
        .where(
          and(
            eq(returnRequests.id, request.id),
            eq(returnRequests.status, "confirmed")
          )
        )
        .returning({ id: returnRequests.id });
      if (!recorded) throw conflict("the request was finalized concurrently");
    });
    return (await loadRequest(input.requestId))!;
  }

  async openCarrierClaim(
    input: Parameters<ReturnRequestRepositoryInterface["openCarrierClaim"]>[0]
  ) {
    const deadlineAt = carrierClaimDeadline(new Date());
    await db.transaction(async (tx) => {
      await tx.insert(returnCarrierClaims).values({
        requestId: input.requestId,
        createdBy: input.actorId,
        missingQuantity: input.missingQuantity,
        deadlineAt,
      });
      await tx
        .update(returnRequests)
        .set({ carrierClaimStatus: "open", updatedAt: new Date() })
        .where(eq(returnRequests.id, input.requestId));
    });
  }

  async resolveCarrierClaim(
    input: Parameters<
      ReturnRequestRepositoryInterface["resolveCarrierClaim"]
    >[0]
  ) {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(returnCarrierClaims)
        .set({
          status: "resolved",
          fault: input.fault,
          outcomeNote: input.outcomeNote,
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(returnCarrierClaims.requestId, input.requestId),
            eq(returnCarrierClaims.status, "open")
          )
        )
        .returning({ id: returnCarrierClaims.id });
      if (!updated) throw conflict("the carrier claim is not open");
      await tx
        .update(returnRequests)
        .set({ carrierClaimStatus: "resolved", updatedAt: new Date() })
        .where(eq(returnRequests.id, input.requestId));
    });
  }
}
