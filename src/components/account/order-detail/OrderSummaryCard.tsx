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
}

export function OrderSummaryCard({
  subtotal,
  shippingCost,
  tax,
  discount = 0,
  total,
  refundedAmount = 0,
  fullyRefunded = false,
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
              <span className="text-gray-500">Refunded</span>
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
      </div>
    </div>
  );
}
