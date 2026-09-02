import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
  processing: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  shipped: "bg-purple-500/15 text-purple-400 border border-purple-500/20",
  delivered: "bg-green-500/15 text-green-400 border border-green-500/20",
  cancelled: "bg-red-500/15 text-red-400 border border-red-500/20",
};

interface OrderDetailHeaderProps {
  orderId: string;
  /**
   * The real VLK-YYYYMMDD-XXXXXX identifier.
   *
   * This header used to render `orderId.slice(-8)` — a UUID fragment — while
   * the orders list one click earlier showed the real number, so the same
   * order had two identities depending on the screen and the one a customer
   * would quote to support was on the wrong one.
   */
  orderNumber: string | null;
  status: string;
  createdAt: Date;
}

export function OrderDetailHeader({
  orderId,
  orderNumber,
  status,
  createdAt,
}: OrderDetailHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <Button
        variant="ghost"
        size="icon"
        asChild
        className="text-gray-400 hover:text-white hover:bg-white/[0.04]"
      >
        <Link href="/account/orders">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Button>
      <div>
        <h2 className="text-2xl font-bold text-white">
          {orderNumber ?? `Order #${orderId.slice(-8)}`}
        </h2>
        <p className="text-gray-500">
          Placed on{" "}
          {new Date(createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>
      <span
        className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
          statusColors[status] || "bg-white/10 text-gray-400"
        }`}
      >
        {status}
      </span>
    </div>
  );
}
