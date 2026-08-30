import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

function KPICard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

interface AnalyticsKPICardsProps {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  totalCustomers: number;
  days: number;
}

export function AnalyticsKPICards({
  totalRevenue,
  totalOrders,
  avgOrderValue,
  totalCustomers,
  days,
}: AnalyticsKPICardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Total Revenue"
        value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        icon={DollarSign}
        description={`Last ${days} days`}
      />
      <KPICard
        title="Total Orders"
        value={String(totalOrders)}
        icon={ShoppingCart}
        description={`Last ${days} days`}
      />
      <KPICard
        title="Avg Order Value"
        value={formatCurrency(avgOrderValue)}
        icon={TrendingUp}
        description={`Last ${days} days`}
      />
      <KPICard
        title="Customers"
        value={String(totalCustomers)}
        icon={Users}
        description={`Unique customers`}
      />
    </div>
  );
}
