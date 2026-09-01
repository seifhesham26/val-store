import dynamic from "next/dynamic";
import { MetricsCards } from "@/components/admin/dashboard/MetricsCards";
import { RecentOrders } from "@/components/admin/dashboard/RecentOrders";

/**
 * Split recharts out of the dashboard's initial bundle. The metric cards and
 * the recent-orders table are what an admin actually opens this page for, and
 * neither needs the charting library to render.
 *
 * No `ssr: false` here — this is a server component, where that option is not
 * allowed. The split still happens; the chart is simply also rendered on the
 * server first.
 */
const SalesChart = dynamic(() =>
  import("@/components/admin/dashboard/SalesChart").then((m) => m.SalesChart)
);

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s what&apos;s happening with your store today.
        </p>
      </div>

      {/* Key Metrics */}
      <MetricsCards />

      {/* Charts & Activities */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <SalesChart />
        <RecentOrders />
      </div>
    </div>
  );
}
