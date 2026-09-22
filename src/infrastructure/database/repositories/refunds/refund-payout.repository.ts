import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type {
  RefundPayoutPreparation,
  RefundPayoutRecord,
  RefundPayoutStore,
} from "@/application/refunds/refund-payout.service";
import { db } from "@/db";
import {
  orderItems,
  orders,
  payments,
  returnPayouts,
  returnProposals,
  returnRequestItems,
  returnRequests,
} from "@/db/schema";

const RETRY_WINDOW_MS = 24 * 60 * 60 * 1_000;
const MAX_ATTEMPTS = 3;

function money(value: string | number | null | undefined): number {
  return Number.parseFloat(String(value ?? 0));
}

function payoutRecord(
  row: typeof returnPayouts.$inferSelect
): RefundPayoutRecord {
  return {
    id: row.id,
    requestId: row.requestId,
    amount: money(row.amount),
    originalPaymentReference: row.originalPaymentReference ?? "",
    idempotencyKey: row.idempotencyKey,
    providerReference: row.providerReference,
    status: row.status,
    attemptCount: row.attemptCount,
    lastAttemptAt: row.lastAttemptAt,
  };
}

/** Database half of the payout state machine. All money is loaded here. */
export class DrizzleRefundPayoutRepository implements RefundPayoutStore {
  async prepare(requestId: string): Promise<RefundPayoutPreparation> {
    return db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(returnRequests)
        .where(eq(returnRequests.id, requestId))
        .for("update");
      if (!request) throw new Error("Return request not found");
      if (request.status !== "recorded") {
        throw new Error("Return must be recorded before payout");
      }

      const [existing] = await tx
        .select()
        .from(returnPayouts)
        .where(eq(returnPayouts.requestId, request.id))
        .orderBy(asc(returnPayouts.createdAt))
        .limit(1)
        .for("update");
      if (existing) {
        const payout = payoutRecord(existing);
        if (existing.status === "succeeded") return { action: "none", payout };
        if (existing.status === "pending" || existing.status === "unknown") {
          return existing.provider === "opay"
            ? { action: "reconcile", payout }
            : { action: "none", payout };
        }
        const withinWindow =
          Date.now() - existing.createdAt.getTime() <= RETRY_WINDOW_MS;
        if (
          existing.provider !== "opay" ||
          !withinWindow ||
          existing.attemptCount >= MAX_ATTEMPTS
        ) {
          return { action: "none", payout };
        }
        const now = new Date();
        const [retried] = await tx
          .update(returnPayouts)
          .set({
            status: "pending",
            attemptCount: existing.attemptCount + 1,
            lastAttemptAt: now,
            failedAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(returnPayouts.id, existing.id),
              eq(returnPayouts.status, "failed")
            )
          )
          .returning();
        return retried
          ? { action: "initiate", payout: payoutRecord(retried) }
          : { action: "reconcile", payout };
      }

      const [proposal] = await tx
        .select()
        .from(returnProposals)
        .where(
          and(
            eq(returnProposals.requestId, request.id),
            eq(returnProposals.version, request.proposalVersion)
          )
        );
      if (!proposal) throw new Error("The recorded proposal is missing");
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.orderId, request.orderId))
        .limit(1);

      const canUseOPay =
        payment?.paymentStatus === "completed" &&
        (payment.paymentMethod === "credit_card" ||
          payment.paymentMethod === "debit_card") &&
        Boolean(payment.transactionId);
      const provider = canUseOPay ? "opay" : "cash";
      const now = new Date();
      const [created] = await tx
        .insert(returnPayouts)
        .values({
          requestId: request.id,
          proposalId: proposal.id,
          provider,
          idempotencyKey: `return:${request.id}:proposal:${proposal.version}`,
          originalPaymentReference: canUseOPay ? payment!.transactionId : null,
          amount: proposal.totalRefund,
          status: "pending",
          attemptCount: canUseOPay ? 1 : 0,
          lastAttemptAt: canUseOPay ? now : null,
        })
        .returning();
      await tx
        .update(returnRequests)
        .set({ payoutStatus: "pending", updatedAt: now })
        .where(eq(returnRequests.id, request.id));
      const payout = payoutRecord(created);
      return canUseOPay
        ? { action: "initiate", payout }
        : { action: "none", payout };
    });
  }

  async recordObservation(
    input: Parameters<RefundPayoutStore["recordObservation"]>[0]
  ): Promise<RefundPayoutRecord> {
    const [identity] = await db
      .select({ requestId: returnPayouts.requestId })
      .from(returnPayouts)
      .where(eq(returnPayouts.id, input.payoutId))
      .limit(1);
    if (!identity) throw new Error("Refund payout not found");

    return db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(returnRequests)
        .where(eq(returnRequests.id, identity.requestId))
        .for("update");
      const [payout] = await tx
        .select()
        .from(returnPayouts)
        .where(eq(returnPayouts.id, input.payoutId))
        .for("update");
      if (!payout) throw new Error("Refund payout not found");
      if (payout.status === "succeeded") return payoutRecord(payout);

      const now = new Date();
      if (input.status === "succeeded") {
        if (!request || request.status !== "recorded") {
          throw new Error("Recorded return not found");
        }
        const [proposal] = await tx
          .select()
          .from(returnProposals)
          .where(eq(returnProposals.id, payout.proposalId));
        if (!proposal) throw new Error("Refund proposal not found");
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, request.orderId))
          .for("update");
        if (!order) throw new Error("Order not found");
        const lines = await tx
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
              lines.map((line) => line.orderItemId)
            )
          )
          .orderBy(asc(orderItems.id))
          .for("update");

        for (const line of lines) {
          const orderLine = lockedOrderLines.find(
            (candidate) => candidate.id === line.orderItemId
          );
          if (
            !orderLine ||
            orderLine.refundedQuantity + line.approvedQuantity >
              orderLine.quantity
          ) {
            throw new Error("Approved refund no longer fits the order");
          }
          await tx
            .update(orderItems)
            .set({
              refundedQuantity: sql`${orderItems.refundedQuantity} + ${line.approvedQuantity}`,
            })
            .where(eq(orderItems.id, line.orderItemId));
          await tx
            .update(returnRequestItems)
            .set({ refundedQuantity: line.approvedQuantity, updatedAt: now })
            .where(eq(returnRequestItems.id, line.id));
        }

        const shippingRefund = money(proposal.deliveryRefund);
        const shippingRemaining = Math.max(
          0,
          money(order.shippingAmount) - money(order.refundedShippingAmount)
        );
        if (shippingRefund > shippingRemaining + 0.001) {
          throw new Error("Delivery refund no longer fits the order");
        }
        await tx
          .update(orders)
          .set({
            refundedShippingAmount: sql`${orders.refundedShippingAmount} + ${shippingRefund.toFixed(2)}`,
            updatedAt: now,
          })
          .where(eq(orders.id, order.id));
      }

      const [updated] = await tx
        .update(returnPayouts)
        .set({
          status: input.status,
          providerReference: input.providerReference,
          ...(input.status === "succeeded" ? { succeededAt: now } : {}),
          ...(input.status === "failed" ? { failedAt: now } : {}),
          updatedAt: now,
        })
        .where(eq(returnPayouts.id, payout.id))
        .returning();
      await tx
        .update(returnRequests)
        .set({ payoutStatus: input.status, updatedAt: now })
        .where(eq(returnRequests.id, payout.requestId));
      return payoutRecord(updated);
    });
  }
}
