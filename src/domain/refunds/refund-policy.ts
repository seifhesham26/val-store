export const REFUND_POLICY = {
  normalReturnWindowDays: 14,
  merchantFaultReturnWindowDays: 30,
  wornResellableRate: 0.7,
} as const;

export type ReturnReason =
  | "change_of_mind"
  | "defective"
  | "wrong_item"
  | "not_as_described"
  | "late_delivery";

export type InspectionOutcome =
  | "unworn"
  | "worn_resellable"
  | "defective"
  | "customer_damage"
  | "damaged_quarantine"
  | "missing_not_received";

export type RefundDisposition =
  | "resellable"
  | "quarantine"
  | "missing"
  | "mixed"
  | "rejected";

export interface RefundCalculationInput {
  reason: ReturnReason;
  items: ReadonlyArray<{
    paidAmount: number;
    outcome: InspectionOutcome;
  }>;
  originalDelivery: number;
  returnedAllOrder: boolean;
  collectionFee: number;
  capturedPayment: number;
}

export interface RefundCalculation {
  itemRefund: number;
  deliveryRefund: number;
  customerCollectionDue: number;
  totalRefund: number;
  disposition: RefundDisposition;
}

const merchantFaultReasons = new Set<ReturnReason>([
  "defective",
  "wrong_item",
  "not_as_described",
  "late_delivery",
]);

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function itemRefundRate(
  reason: ReturnReason,
  outcome: InspectionOutcome
): number {
  if (outcome === "customer_damage") return 0;
  if (reason === "change_of_mind" && outcome === "worn_resellable") {
    return REFUND_POLICY.wornResellableRate;
  }
  return 1;
}

function dispositionFor(
  outcomes: ReadonlyArray<InspectionOutcome>
): RefundDisposition {
  const dispositions = new Set(
    outcomes.map((outcome): RefundDisposition => {
      if (outcome === "customer_damage") return "rejected";
      if (outcome === "unworn" || outcome === "worn_resellable") {
        return "resellable";
      }
      if (outcome === "missing_not_received") return "missing";
      return "quarantine";
    })
  );

  return dispositions.size === 1
    ? (dispositions.values().next().value ?? "rejected")
    : "mixed";
}

export function calculateRefund(
  input: RefundCalculationInput
): RefundCalculation {
  const rawItemRefund = input.items.reduce(
    (sum, item) =>
      sum + item.paidAmount * itemRefundRate(input.reason, item.outcome),
    0
  );
  const itemRefund = roundMoney(rawItemRefund);
  const hasCustomerDamage = input.items.some(
    (item) => item.outcome === "customer_damage"
  );
  const deliveryRefund =
    input.returnedAllOrder &&
    merchantFaultReasons.has(input.reason) &&
    !hasCustomerDamage
      ? roundMoney(input.originalDelivery)
      : 0;
  const uncappedTotal = roundMoney(itemRefund + deliveryRefund);
  const totalRefund = Math.max(
    0,
    roundMoney(Math.min(uncappedTotal, input.capturedPayment))
  );

  return {
    itemRefund: roundMoney(Math.min(itemRefund, totalRefund)),
    deliveryRefund: roundMoney(Math.max(0, totalRefund - itemRefund)),
    customerCollectionDue: hasCustomerDamage
      ? roundMoney(input.collectionFee)
      : 0,
    totalRefund,
    disposition: dispositionFor(input.items.map((item) => item.outcome)),
  };
}
