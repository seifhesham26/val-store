import { formatCurrency } from "@/lib/currency";

interface OrderSummaryCardProps {
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount?: number;
  total: number;
}

export function OrderSummaryCard({
  subtotal,
  shippingCost,
  tax,
  discount = 0,
  total,
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
      </div>
    </div>
  );
}
