"use client";

/**
 * Admin Analytics Page
 *
 * Revenue trends, top products, order status breakdown, and CSV export.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  AnalyticsHeader,
  type Period,
} from "@/components/admin/analytics/AnalyticsHeader";
import { AnalyticsKPICards } from "@/components/admin/analytics/AnalyticsKPICards";
import { TopProductsList } from "@/components/admin/analytics/TopProductsList";
import { formatCurrency } from "@/lib/currency";

/**
 * Charts are loaded on demand.
 *
 * Recharts is by some distance the largest thing in the admin bundle, and it
 * was imported statically into a page whose KPI cards, header and top-products
 * list can all render without it. Splitting it means the page paints its
 * numbers first and pulls the charting library alongside, rather than behind.
 *
 * `ssr: false` because these render nothing useful on the server anyway — they
 * are driven entirely by a client-side query — and skipping them avoids the
 * usual recharts hydration warnings about measured container sizes.
 */
const RevenueTrendChart = dynamic(
  () =>
    import("@/components/admin/analytics/RevenueTrendChart").then(
      (m) => m.RevenueTrendChart
    ),
  { ssr: false, loading: () => <ChartPlaceholder className="lg:col-span-5" /> }
);

const OrderStatusChart = dynamic(
  () =>
    import("@/components/admin/analytics/OrderStatusChart").then(
      (m) => m.OrderStatusChart
    ),
  { ssr: false, loading: () => <ChartPlaceholder className="lg:col-span-2" /> }
);

/** Holds the chart's footprint so the grid does not reflow when it arrives. */
function ChartPlaceholder({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="h-5 w-40 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-[300px] rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

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
