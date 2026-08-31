"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatCurrencyCompact } from "@/lib/currency";

type Period = "7d" | "30d" | "90d";

export function SalesChart() {
  const [period, setPeriod] = useState<Period>("30d");

  const { data: salesData, isLoading } =
    trpc.admin.dashboard.getSalesTrend.useQuery();

  // Transform data for chart
  const chartData =
    salesData?.map((item) => ({
      date: new Date(item.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      sales: item.revenue,
      orders: item.orders,
    })) ?? [];

  // Filter data based on selected period
  const filteredData = (() => {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    return chartData.slice(-days);
  })();

  // Calculate trend
  const calculateTrend = () => {
    if (filteredData.length < 2) return { value: 0, isPositive: true };
    const recent = filteredData.slice(-7).reduce((sum, d) => sum + d.sales, 0);
    const previous = filteredData
      .slice(-14, -7)
      .reduce((sum, d) => sum + d.sales, 0);
    if (previous === 0) return { value: 0, isPositive: true };
    const percentChange = ((recent - previous) / previous) * 100;
    return {
      value: Math.abs(percentChange).toFixed(1),
      isPositive: percentChange >= 0,
    };
  };

  const trend = calculateTrend();

  if (isLoading) {
    return (
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Sales Overview</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            Sales Overview
            {trend.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardTitle>
          <CardDescription>
            {trend.isPositive ? "+" : "-"}
            {trend.value}% from last period
          </CardDescription>
        </div>
        <div className="flex gap-1">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {filteredData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrencyCompact}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [formatCurrency(value), "Sales"]}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill="url(#salesGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No sales data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
