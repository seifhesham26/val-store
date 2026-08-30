"use client";

/**
 * Admin Analytics Page
 *
 * Revenue trends, top products, order status breakdown, and CSV export.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  AnalyticsHeader,
  type Period,
} from "@/components/admin/analytics/AnalyticsHeader";
import { AnalyticsKPICards } from "@/components/admin/analytics/AnalyticsKPICards";
import { RevenueTrendChart } from "@/components/admin/analytics/RevenueTrendChart";
import { OrderStatusChart } from "@/components/admin/analytics/OrderStatusChart";
import { TopProductsList } from "@/components/admin/analytics/TopProductsList";
import { formatCurrency } from "@/lib/currency";

export default function AnalyticsPage() {
  const [days, setDays] = useState<Period>(30);

  const { data, isLoading } = trpc.admin.dashboard.getAnalytics.useQuery({
    days,
  });

  const handleExportCSV = () => {
    if (!data) return;

    const rows = [
      ["Metric", "Value"],
      ["Period", `Last ${days} days`],
      ["Total Revenue", formatCurrency(data.totalRevenue)],
      ["Total Orders", String(data.totalOrders)],
      ["Avg Order Value", formatCurrency(data.avgOrderValue)],
      ["Total Customers", String(data.totalCustomers)],
      [""],
      ["Date", "Revenue", "Orders"],
      ...data.revenueTrend.map((d) => [
        d.date,
        formatCurrency(d.revenue),
        String(d.orders),
      ]),
      [""],
      ["Product", "Qty Sold", "Revenue"],
      ...data.topProducts.map((p) => [
        p.productName,
        String(p.totalQuantity),
        formatCurrency(p.totalRevenue),
      ]),
      [""],
      ["Status", "Count"],
      ...data.ordersByStatus.map((s) => [s.status, String(s.count)]),
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <AnalyticsHeader
        days={days}
        onDaysChange={setDays}
        onExport={handleExportCSV}
        exportDisabled={!data || isLoading}
      />

      {isLoading || !data ? (
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
      ) : (
        <>
          <AnalyticsKPICards
            totalRevenue={data.totalRevenue}
            totalOrders={data.totalOrders}
            avgOrderValue={data.avgOrderValue}
            totalCustomers={data.totalCustomers}
            days={days}
          />

          <div className="grid gap-4 lg:grid-cols-7">
            <RevenueTrendChart data={data.revenueTrend} />
            <OrderStatusChart data={data.ordersByStatus} />
          </div>

          <TopProductsList products={data.topProducts} />
        </>
      )}
    </div>
  );
}
