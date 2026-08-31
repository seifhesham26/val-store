import Link from "next/link";
import { Package, MapPin, Heart } from "lucide-react";

export function AccountQuickLinks({ ordersTotal }: { ordersTotal: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <QuickLinkCard
        href="/account/orders"
        icon={Package}
        label="Orders"
        value={ordersTotal}
        description="View order history"
      />
      <QuickLinkCard
        href="/account/addresses"
        icon={MapPin}
        label="Addresses"
        value="Manage"
        description="Shipping addresses"
      />
      <QuickLinkCard
        href="/account/wishlist"
        icon={Heart}
        label="Wishlist"
        value="View"
        description="Saved items"
      />
    </div>
  );
}

function QuickLinkCard({
  href,
  icon: Icon,
  label,
  value,
  description,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  value: string | number;
  description: string;
}) {
  // The <a> is the grid item, so h-full has to live on the Link for cards to
  // match heights.
  return (
    <Link href={href} className="block h-full">
      <div className="bg-zinc-900 border border-white/10 rounded-lg p-4 hover:border-white/20 transition-colors cursor-pointer h-full">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-val-accent/10 rounded-lg">
            <Icon className="h-5 w-5 text-val-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
