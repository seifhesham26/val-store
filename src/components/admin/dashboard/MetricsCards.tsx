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

  const metricsData = [
    {
      title: "Total Revenue",
      value: formatCurrency(metrics?.revenue ?? 0),
      change: "+20.1% from last month",
      icon: DollarSign,
    },
    {
      title: "New Orders",
      value: `${metrics?.orders || 0}`,
      change: "+180 from yesterday",
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
