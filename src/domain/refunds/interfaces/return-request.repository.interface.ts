import type {
  InspectionOutcome,
  RefundCalculation,
  ReturnReason,
} from "@/domain/refunds/refund-policy";
import type {
  ReturnFault,
  ReturnRequestRecord,
  ReturnRequestStatus,
} from "@/domain/refunds/return-request";

export type ReturnEvidenceKind =
  | "customer_product_photo"
  | "customer_package_photo"
  | "courier_handoff_video"
  | "receiving_inspection_video"
  | "payout_proof"
  | "cash_receipt";

export interface ReturnEvidenceRecord {
  id: string;
  requestId: string;
  storageKey: string;
}

export type ReturnPackageEventKind =
  | "customer_declaration"
  | "courier_handoff"
  | "receiving_count"
  | "second_count"
  | "correction";

export interface CreateReturnRequestInput {
  orderId: string;
  customerId: string;
  reason: ReturnReason;
  customerNote?: string;
  pickupMethod: "courier" | "in_store";
  lines: ReadonlyArray<{ orderItemId: string; quantity: number }>;
}

export interface ReturnRequestRepositoryInterface {
  create(input: CreateReturnRequestInput): Promise<ReturnRequestRecord>;
  findForCustomer(
    requestId: string,
    customerId: string
  ): Promise<ReturnRequestRecord | null>;
  listForOrder(
    orderId: string,
    customerId: string
  ): Promise<ReturnRequestRecord[]>;
  listForStaffOrder(orderId: string): Promise<ReturnRequestRecord[]>;
  findForStaff(requestId: string): Promise<ReturnRequestRecord | null>;
  listWork(limit?: number): Promise<ReturnRequestRecord[]>;
  countWork(): Promise<number>;
  transition(
    requestId: string,
    expectedStatus: ReturnRequestStatus,
    targetStatus: ReturnRequestStatus
  ): Promise<ReturnRequestRecord>;
  attachEvidence(input: {
    requestId: string;
    uploaderId: string;
    uploaderRole: "customer" | "worker" | "admin" | "super_admin";
    kind: ReturnEvidenceKind;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    contentHash?: string;
    originalMetadata?: unknown;
  }): Promise<void>;
  countEvidence(input: {
    requestId: string;
    kind: ReturnEvidenceKind;
  }): Promise<number>;
  findEvidence(input: {
    requestId: string;
    storageKey: string;
  }): Promise<ReturnEvidenceRecord | null>;
  recordEvidenceAccess(input: {
    actorId: string;
    actorRole: "super_admin";
    requestId: string;
    evidenceId: string;
  }): Promise<void>;
  recordPackageEvent(input: {
    requestId: string;
    kind: ReturnPackageEventKind;
    packageCount: number;
    itemCount?: number;
    sealIntact?: boolean;
    note?: string;
    recordedBy: string;
    correctionOfId?: string;
  }): Promise<void>;
  recordInspection(input: {
    requestId: string;
    expectedStatus: ReturnRequestStatus;
    reviewerId: string;
    lines: ReadonlyArray<{
      requestItemId: string;
      receivedQuantity: number;
      inspectedQuantity: number;
      approvedQuantity: number;
      restockedQuantity: number;
      outcome: InspectionOutcome;
      fault: ReturnFault;
      itemRefund: number;
    }>;
  }): Promise<ReturnRequestRecord>;
  saveProposal(input: {
    requestId: string;
    expectedVersion: number;
    actorId: string;
    itemRefund: number;
    deliveryRefund: number;
    collectionDue: number;
    totalRefund: number;
    payoutDestination: string | null;
    customerCopy: string;
    calculation: RefundCalculation | unknown;
  }): Promise<ReturnRequestRecord>;
  markProposalOpened(input: {
    requestId: string;
    customerId: string;
    proposalVersion: number;
  }): Promise<Date>;
  acknowledgeProposal(input: {
    requestId: string;
    customerId: string;
    proposalVersion: number;
    acknowledgedAt: Date;
  }): Promise<ReturnRequestRecord>;
  reject(input: {
    requestId: string;
    reviewerId: string;
    reason: string;
  }): Promise<ReturnRequestRecord>;
  submitDispute(input: {
    requestId: string;
    customerId: string;
    proposalVersion: number;
    reason: string;
  }): Promise<ReturnRequestRecord>;
  reviewDispute(input: {
    requestId: string;
    reviewerId: string;
    expectedLevel: number;
  }): Promise<ReturnRequestRecord>;
  finalize(input: {
    requestId: string;
    customerId: string;
    proposalVersion: number;
  }): Promise<ReturnRequestRecord>;
  openCarrierClaim(input: {
    requestId: string;
    actorId: string;
    missingQuantity: number;
  }): Promise<void>;
  resolveCarrierClaim(input: {
    requestId: string;
    fault: ReturnFault;
    outcomeNote: string;
  }): Promise<void>;
}
