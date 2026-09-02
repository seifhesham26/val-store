"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, Package, Star } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

export function MetricsCards() {
  const { data: metrics, isLoading } =
    trpc.admin.dashboard.getMetrics.useQuery();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // The first two cards carried hardcoded sub-labels — "+20.1% from last
  // month" and "+180 from yesterday" — that nothing computed. Sitting directly
  // under a live figure, in the position a real delta occupies, they read as
  // measurements. A card with no sub-label is honest; a card with a fabricated
  // one is not.
  //
  // Both are now labelled with the window they actually cover. The second used
  // to be titled "New Orders" over an unbounded COUNT(*) while the card beside
  // it was windowed to 30 days.
  const metricsData = [
    {
      title: "Revenue",
      value: formatCurrency(metrics?.revenue ?? 0),
      change: "Collected, last 30 days · net of refunds",
      icon: DollarSign,
    },
    {
      title: "Orders",
      value: `${metrics?.orders || 0}`,
      change: "Placed, last 30 days",
      icon: ShoppingCart,
    },
    {
      title: "Low Stock Items",
      value: `${metrics?.lowStock || 0}`,
      change: "Needs attention",
      icon: Package,
    },
    {
      title: "Pending Reviews",
      value: `${metrics?.pendingReviews || 0}`,
      change: "Awaiting approval",
      icon: Star,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metricsData.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground">{metric.change}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
