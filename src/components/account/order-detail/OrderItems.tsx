import { Package } from "lucide-react";
import { AppRouter } from "@/server";
import { inferRouterOutputs } from "@trpc/server";
import { formatCurrency } from "@/lib/currency";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type OrderDetail = NonNullable<
  RouterOutputs["public"]["orders"]["getOrderById"]
>;
type OrderItem = OrderDetail["items"][number];

export function OrderItems({ items }: { items: OrderItem[] }) {
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-lg">
      <div className="p-5 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">Items</h3>
      </div>
      <div className="p-5">
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/[0.06] rounded flex items-center justify-center">
                <Package className="h-6 w-6 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">{item.productName}</p>
                {item.variantDetails && (
                  <p className="text-sm text-gray-400">{item.variantDetails}</p>
                )}
                <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
              </div>
              <p className="font-medium text-white">
                {formatCurrency(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
