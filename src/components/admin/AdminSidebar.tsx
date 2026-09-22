"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  Warehouse,
  Star,
  Tag,
  Scale,
  ExternalLink,
  History,
  RotateCcw,
} from "lucide-react";
import { useAdminWriteAccess } from "@/hooks/use-admin-write-access";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";

const navItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Products",
    href: "/admin/products",
    icon: Package,
  },
  {
    title: "Categories",
    href: "/admin/categories",
    icon: FolderTree,
  },
  {
    title: "Orders",
    href: "/admin/orders",
    icon: ShoppingCart,
  },
  {
    title: "Coupons",
    href: "/admin/coupons",
    icon: Tag,
  },
  {
    title: "Reviews",
    href: "/admin/reviews",
    icon: Star,
  },
  {
    title: "Inventory",
    href: "/admin/inventory",
    icon: Warehouse,
  },
  {
    title: "Returns",
    href: "/admin/returns",
    icon: RotateCcw,
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
  {
    title: "Customers",
    href: "/admin/customers",
    icon: Users,
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
  },
  {
    title: "Legal",
    href: "/admin/legal",
    icon: Scale,
  },
  {
    title: "My Access History",
    href: "/admin/access-history",
    icon: History,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { role } = useAdminWriteAccess();
  const { data: pendingInventoryWork = 0 } =
    trpc.admin.inventory.pendingCount.useQuery(undefined, {
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    });
  const { data: pendingReturnWork = 0 } =
    trpc.admin.returns.pendingCount.useQuery(undefined, {
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    });

  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/admin" className="flex items-center gap-2 font-semibold">
          <Package className="h-6 w-6" />
          <span>Valkyrie Admin</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          // Special case: Dashboard should only be active on exact /admin match
          // Other items should be active on prefix match (e.g., /admin/products/123)
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>
                {role === "worker" && item.href === "/admin/customers"
                  ? "Customer Support"
                  : item.title}
              </span>
              {item.href === "/admin/inventory" && pendingInventoryWork > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-auto min-w-5 justify-center px-1.5 py-0 text-[11px]"
                >
                  {pendingInventoryWork}
                </Badge>
              )}
              {item.href === "/admin/returns" && pendingReturnWork > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-auto min-w-5 justify-center px-1.5 py-0 text-[11px]"
                >
                  {pendingReturnWork}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4 space-y-2">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          View Store
        </Link>
        <p className="text-xs text-muted-foreground">Logged in as Admin</p>
      </div>
    </div>
  );
}
