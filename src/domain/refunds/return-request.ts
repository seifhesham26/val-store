import type {
  InspectionOutcome,
  ReturnReason,
} from "@/domain/refunds/refund-policy";

export type ReturnRequestStatus =
  | "requested"
  | "awaiting_customer_evidence"
  | "pickup_authorized"
  | "pickup_pending"
  | "in_transit"
  | "received"
  | "count_disputed"
  | "inspection_pending"
  | "awaiting_customer_confirmation"
  | "disputed"
  | "customer_action_required"
  | "confirmed"
  | "recorded"
  | "rejected"
  | "evidence_exception";

export type ReturnRequestAction =
  | "attach_customer_evidence"
  | "attach_staff_evidence"
  | "record_package_event"
  | "record_inspection"
  | "save_proposal"
  | "acknowledge_proposal"
  | "confirm_proposal"
  | "finalize";

export type ReturnPhysicalStatus =
  | "pending"
  | "in_transit"
  | "received"
  | "resellable"
  | "quarantined"
  | "missing"
  | "mixed";

export type ReturnPayoutStatus = "pending" | "succeeded" | "failed" | "unknown";

export type ReturnFault = "customer" | "carrier" | "valkyrie" | "unresolved";

export const RECOMMENDED_UNITS_PER_RETURN_PACKAGE = 3;

export function packageGuidance(input: {
  itemCount: number;
  declaredPackageCount: number;
}) {
  const recommendedPackageCount = Math.max(
    1,
    Math.ceil(input.itemCount / RECOMMENDED_UNITS_PER_RETURN_PACKAGE)
  );
  return {
    recommendedPackageCount,
    exceedsRecommendedCapacity:
      input.declaredPackageCount < recommendedPackageCount,
    accepted: true,
  };
}

export function carrierClaimDeadline(openedAt: Date): Date {
  const deadline = new Date(openedAt);
  deadline.setUTCDate(deadline.getUTCDate() + 3);
  return deadline;
}

export interface ReturnRequestItemRecord {
  id: string;
  orderItemId: string;
  requestedQuantity: number;
  receivedQuantity: number;
  inspectedQuantity: number;
  approvedQuantity: number;
  returnedQuantity: number;
  restockedQuantity: number;
  refundedQuantity: number;
  outcome: InspectionOutcome | null;
  fault: ReturnFault | null;
  itemRefund: number;
}

export interface ReturnProposalRecord {
  id: string;
  version: number;
  itemRefund: number;
  deliveryRefund: number;
  collectionDue: number;
  totalRefund: number;
  payoutDestination: string | null;
  customerCopy: string;
  calculation: unknown;
  createdAt: Date;
}

export interface ReturnRequestRecord {
  id: string;
  orderId: string;
  customerId: string;
  status: ReturnRequestStatus;
  reason: ReturnReason;
  customerNote: string | null;
  pickupMethod: "courier" | "in_store" | null;
  physicalStatus: ReturnPhysicalStatus;
  payoutStatus: ReturnPayoutStatus | null;
  proposalVersion: number;
  proposalOpenedAt: Date | null;
  acknowledgedAt: Date | null;
  confirmedAt: Date | null;
  recordedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: ReturnRequestItemRecord[];
  proposal: ReturnProposalRecord | null;
}

const transitions: Record<ReturnRequestStatus, readonly ReturnRequestStatus[]> =
  {
    requested: ["awaiting_customer_evidence", "rejected"],
    awaiting_customer_evidence: [
      "pickup_authorized",
      "evidence_exception",
      "rejected",
    ],
    pickup_authorized: ["pickup_pending", "in_transit", "received", "rejected"],
    pickup_pending: ["in_transit", "received", "rejected"],
    in_transit: ["received", "count_disputed", "rejected"],
    received: [
      "count_disputed",
      "inspection_pending",
      "evidence_exception",
      "rejected",
    ],
    count_disputed: ["inspection_pending", "evidence_exception", "rejected"],
    inspection_pending: [
      "awaiting_customer_confirmation",
      "evidence_exception",
      "rejected",
    ],
    awaiting_customer_confirmation: [
      "confirmed",
      "disputed",
      "customer_action_required",
      "rejected",
    ],
    disputed: [
      "awaiting_customer_confirmation",
      "customer_action_required",
      "rejected",
    ],
    customer_action_required: [
      "awaiting_customer_confirmation",
      "disputed",
      "rejected",
    ],
    confirmed: ["recorded"],
    recorded: [],
    rejected: [],
    evidence_exception: [
      "inspection_pending",
      "awaiting_customer_confirmation",
      "rejected",
    ],
  };

const actionStates: Record<
  ReturnRequestAction,
  readonly ReturnRequestStatus[]
> = {
  attach_customer_evidence: [
    "requested",
    "awaiting_customer_evidence",
    "evidence_exception",
  ],
  attach_staff_evidence: [
    "pickup_authorized",
    "pickup_pending",
    "in_transit",
    "received",
    "count_disputed",
    "inspection_pending",
    "evidence_exception",
  ],
  record_package_event: [
    "awaiting_customer_evidence",
    "pickup_authorized",
    "pickup_pending",
    "in_transit",
    "received",
    "count_disputed",
    "inspection_pending",
    "evidence_exception",
  ],
  record_inspection: [
    "received",
    "count_disputed",
    "inspection_pending",
    "evidence_exception",
  ],
  save_proposal: ["inspection_pending", "disputed", "evidence_exception"],
  acknowledge_proposal: [
    "awaiting_customer_confirmation",
    "customer_action_required",
  ],
  confirm_proposal: ["awaiting_customer_confirmation"],
  finalize: ["confirmed"],
};

export function transitionReturnRequest(
  current: ReturnRequestStatus,
  target: ReturnRequestStatus
): ReturnRequestStatus {
  if (!transitions[current].includes(target)) {
    throw new Error(
      `Return request cannot transition from ${current} to ${target}`
    );
  }
  return target;
}

export function assertReturnActionAllowed(
  status: ReturnRequestStatus,
  action: ReturnRequestAction
): void {
  if (!actionStates[action].includes(status)) {
    throw new Error(
      `Return action ${action} is not allowed while status is ${status}`
    );
  }
}
