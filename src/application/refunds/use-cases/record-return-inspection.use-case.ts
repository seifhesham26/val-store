import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import {
  calculateRefund,
  type InspectionOutcome,
} from "@/domain/refunds/refund-policy";
import type {
  ReturnFault,
  ReturnRequestStatus,
} from "@/domain/refunds/return-request";
import { requireRefundDecisionRole, type RefundActor } from "../refund-actor";

export class RecordReturnInspectionUseCase {
  constructor(private readonly returns: ReturnRequestRepositoryInterface) {}

  async execute(input: {
    actor: RefundActor;
    requestId: string;
    expectedStatus: ReturnRequestStatus;
    evidenceComplete: boolean;
    auditedMediaException: boolean;
    returnedAllOrder: boolean;
    originalDelivery: number;
    collectionFee: number;
    capturedPayment: number;
    payoutDestination: string | null;
    customerCopy: string;
    lines: ReadonlyArray<{
      requestItemId: string;
      paidAmount: number;
      receivedQuantity: number;
      inspectedQuantity: number;
      approvedQuantity: number;
      restockedQuantity: number;
      outcome: InspectionOutcome;
      fault: ReturnFault;
    }>;
  }) {
    requireRefundDecisionRole(input.actor);
    if (!input.evidenceComplete && !input.auditedMediaException) {
      throw new Error(
        "A receiving video or audited media exception is required before inspection"
      );
    }
    const request = await this.returns.findForStaff(input.requestId);
    if (!request) throw new Error("Return request not found");
    if (request.status !== input.expectedStatus) {
      throw new Error("Return request conflict: inspection state is stale");
    }

    const calculation = calculateRefund({
      reason: request.reason,
      items: input.lines.map((line) => ({
        paidAmount: line.paidAmount,
        outcome: line.outcome,
      })),
      originalDelivery: input.originalDelivery,
      returnedAllOrder: input.returnedAllOrder,
      collectionFee: input.collectionFee,
      capturedPayment: input.capturedPayment,
    });
    await this.returns.recordInspection({
      requestId: request.id,
      expectedStatus: input.expectedStatus,
      reviewerId: input.actor.id,
      lines: input.lines.map((line) => ({
        requestItemId: line.requestItemId,
        receivedQuantity: line.receivedQuantity,
        inspectedQuantity: line.inspectedQuantity,
        approvedQuantity: line.approvedQuantity,
        restockedQuantity: line.restockedQuantity,
        outcome: line.outcome,
        fault: line.fault,
        itemRefund: calculateRefund({
          reason: request.reason,
          items: [{ paidAmount: line.paidAmount, outcome: line.outcome }],
          originalDelivery: 0,
          returnedAllOrder: false,
          collectionFee: 0,
          capturedPayment: line.paidAmount,
        }).itemRefund,
      })),
    });
    return this.returns.saveProposal({
      requestId: request.id,
      expectedVersion: request.proposalVersion,
      actorId: input.actor.id,
      itemRefund: calculation.itemRefund,
      deliveryRefund: calculation.deliveryRefund,
      collectionDue: calculation.customerCollectionDue,
      totalRefund: calculation.totalRefund,
      payoutDestination: input.payoutDestination,
      customerCopy: input.customerCopy,
      calculation,
    });
  }
}
