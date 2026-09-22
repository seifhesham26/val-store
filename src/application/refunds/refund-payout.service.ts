export type RefundPayoutStatus = "pending" | "succeeded" | "failed" | "unknown";

export interface RefundPayoutRecord {
  id: string;
  requestId: string;
  amount: number;
  originalPaymentReference: string;
  idempotencyKey: string;
  providerReference: string | null;
  status: RefundPayoutStatus;
  attemptCount: number;
  lastAttemptAt: Date | null;
}

export type RefundPayoutPreparation =
  | { action: "initiate" | "reconcile"; payout: RefundPayoutRecord }
  | { action: "none"; payout: RefundPayoutRecord | null };

export interface RefundPayoutStore {
  /**
   * Resolve amount, destination and original payment reference from durable
   * return/order records. This deliberately accepts no browser-supplied money
   * or wallet data. The returned attempt is already persisted before a
   * provider call is allowed.
   */
  prepare(requestId: string): Promise<RefundPayoutPreparation>;
  recordObservation(input: {
    payoutId: string;
    status: RefundPayoutStatus;
    providerReference: string | null;
  }): Promise<RefundPayoutRecord>;
}

export interface RefundPayoutProviderObservation {
  status: RefundPayoutStatus;
  /** True only after authenticating the provider response or webhook. */
  verified: boolean;
  providerReference: string | null;
}

export interface RefundPayoutProvider {
  refundOriginalPayment(input: {
    originalPaymentReference: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<RefundPayoutProviderObservation>;
  reconcileRefund(input: {
    originalPaymentReference: string;
    idempotencyKey: string;
    providerReference: string | null;
  }): Promise<RefundPayoutProviderObservation>;
}

/**
 * Executes an already-authorized payout without ever accepting customer totals
 * or destinations. Pending/unknown attempts are queried, never re-sent.
 */
export class RefundPayoutService {
  constructor(
    private readonly store: RefundPayoutStore,
    private readonly provider: RefundPayoutProvider
  ) {}

  async execute(requestId: string): Promise<RefundPayoutRecord | null> {
    const prepared = await this.store.prepare(requestId);
    if (prepared.action === "none") return prepared.payout;

    const payout = prepared.payout;
    try {
      const observation =
        prepared.action === "initiate"
          ? await this.provider.refundOriginalPayment({
              originalPaymentReference: payout.originalPaymentReference,
              amount: payout.amount,
              idempotencyKey: payout.idempotencyKey,
            })
          : await this.provider.reconcileRefund({
              originalPaymentReference: payout.originalPaymentReference,
              idempotencyKey: payout.idempotencyKey,
              providerReference: payout.providerReference,
            });

      return this.store.recordObservation({
        payoutId: payout.id,
        status: this.trustedStatus(observation),
        providerReference: observation.providerReference,
      });
    } catch {
      // A network error is not proof of failure. The provider may have accepted
      // the request before the connection disappeared, so the only safe next
      // action is reconciliation with the same idempotency key.
      return this.store.recordObservation({
        payoutId: payout.id,
        status: "unknown",
        providerReference: payout.providerReference,
      });
    }
  }

  private trustedStatus(
    observation: RefundPayoutProviderObservation
  ): RefundPayoutStatus {
    if (!observation.verified) return "unknown";
    return observation.status;
  }
}
