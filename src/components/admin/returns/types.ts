import type { ReturnRequestRecord } from "@/domain/refunds/return-request";

/** tRPC serializes dates; keep the staff UI honest about its wire contract. */
export type ReturnRequestView = Omit<
  ReturnRequestRecord,
  | "proposalOpenedAt"
  | "acknowledgedAt"
  | "confirmedAt"
  | "recordedAt"
  | "createdAt"
  | "updatedAt"
  | "proposal"
> & {
  proposalOpenedAt: string | null;
  acknowledgedAt: string | null;
  confirmedAt: string | null;
  recordedAt: string | null;
  createdAt: string;
  updatedAt: string;
  proposal: {
    id: string;
    version: number;
    itemRefund: number;
    deliveryRefund: number;
    collectionDue: number;
    totalRefund: number;
    payoutDestination: string | null;
    customerCopy: string;
    calculation?: unknown;
    createdAt: string;
  } | null;
};
