import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppRouter } from "@/server";
import { inferRouterOutputs } from "@trpc/server";
import { formatCurrency } from "@/lib/currency";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type OrdersList = RouterOutputs["public"]["orders"]["getMyOrders"]["orders"];

export function AccountRecentOrders({
  recentOrders,
}: {
  recentOrders: OrdersList | undefined;
}) {
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-lg">
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">Recent Orders</h3>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-gray-400 hover:text-val-accent"
        >
          <Link href="/account/orders">
            View All <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
      <div className="p-5">
        {recentOrders && recentOrders.length > 0 ? (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                <div>
                  {/* The real order number, matching /account/orders and the
                      confirmation email. A UUID fragment matched nothing. */}
                  <p className="font-mono text-sm font-medium text-white">
                    {order.orderNumber ?? `#${order.id.slice(-8)}`}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">
                    {formatCurrency(order.total)}
                  </p>
                  <p className="text-sm text-gray-500 capitalize">
                    {order.status}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No orders yet.{" "}
            <Link
              href="/collections/all"
              className="text-val-accent hover:underline"
            >
              Start shopping
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
