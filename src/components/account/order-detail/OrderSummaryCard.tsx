import { formatCurrency } from "@/lib/currency";

interface OrderSummaryCardProps {
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount?: number;
  total: number;
  /**
   * Money already returned to the customer.
   *
   * A return is not a status change, so without an explicit line a partly
   * returned order reads as untouched — which is exactly the defect the admin
   * orders list fixed and this card never received.
   */
  refundedAmount?: number;
  fullyRefunded?: boolean;
  refundedItemAmount?: number;
  refundedDeliveryAmount?: number;
  refundedCollectionFees?: number;
  returns?: Array<{
    id: string;
    physicalStatus: string;
    payoutStatus: string | null;
    carrierClaimStatus: string | null;
    receivedQuantity: number;
    missingQuantity: number;
    itemRefund: number;
    deliveryRefund: number;
    collectionDue: number;
    payoutMethod: string;
  }>;
}

export function OrderSummaryCard({
  subtotal,
  shippingCost,
  tax,
  discount = 0,
  total,
  refundedAmount = 0,
  fullyRefunded = false,
  refundedItemAmount = 0,
  refundedDeliveryAmount = 0,
  refundedCollectionFees = 0,
  returns = [],
}: OrderSummaryCardProps) {
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-lg">
      <div className="p-5 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">Order Summary</h3>
      </div>
      <div className="p-5 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Subtotal</span>
          <span className="text-white">{formatCurrency(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Discount</span>
            <span className="text-green-500">-{formatCurrency(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Shipping</span>
          <span className="text-white">{formatCurrency(shippingCost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Tax</span>
          <span className="text-white">{formatCurrency(tax)}</span>
        </div>
        <div className="border-t border-white/10 pt-2 mt-2" />
        <div className="flex justify-between font-semibold">
          <span className="text-white">Total</span>
          <span className="text-val-accent">{formatCurrency(total)}</span>
        </div>
        {refundedAmount > 0 && (
          <>
            <div className="flex justify-between text-sm pt-1">
              <span className="text-gray-500">Completed item payout</span>
              <span className="text-amber-400">
                -{formatCurrency(refundedItemAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-1">
              <span className="text-gray-500">Completed delivery payout</span>
              <span className="text-amber-400">
                -{formatCurrency(refundedDeliveryAmount)}
              </span>
            </div>
            {refundedCollectionFees > 0 && (
              <div className="flex justify-between text-sm pt-1">
                <span className="text-gray-500">Collection fee</span>
                <span className="text-gray-300">
                  +{formatCurrency(refundedCollectionFees)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-1">
              <span className="text-gray-500">Total payout completed</span>
              <span className="text-amber-400">
                -{formatCurrency(refundedAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span className="text-gray-400">
                {fullyRefunded ? "Fully refunded" : "You paid"}
              </span>
              <span className="text-white">
                {formatCurrency(Math.max(0, total - refundedAmount))}
              </span>
            </div>
          </>
        )}
        {returns.map((returnRequest) => (
          <div
            key={returnRequest.id}
            className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm"
          >
            <p className="font-medium text-white">Return status</p>
            <p className="text-gray-400">
              Physical: {returnRequest.physicalStatus.replaceAll("_", " ")} ·{" "}
              {returnRequest.receivedQuantity} received ·{" "}
              {returnRequest.missingQuantity} missing
            </p>
            <p className="text-gray-400">
              Authorized: {formatCurrency(returnRequest.itemRefund)} items +{" "}
              {formatCurrency(returnRequest.deliveryRefund)} delivery -{" "}
              {formatCurrency(returnRequest.collectionDue)} collection fee
            </p>
            <p className="text-gray-400">
              Payout: {returnRequest.payoutMethod.replaceAll("_", " ")} ·{" "}
              {returnRequest.payoutStatus ?? "not started"}
            </p>
            {returnRequest.payoutStatus !== "succeeded" && (
              <p className="text-amber-400">
                Money has not been confirmed as credited yet.
              </p>
            )}
            <p className="text-gray-400">
              Carrier claim: {returnRequest.carrierClaimStatus ?? "none"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
