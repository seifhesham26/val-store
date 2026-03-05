/**
 * Dashboard Domain Container
 *
 * Provides singleton instances of dashboard repository and use cases.
 */

import { DrizzleDashboardRepository } from "@/infrastructure/database/repositories/dashboard.repository";
import { GetDashboardMetricsUseCase } from "./use-cases/get-metrics.use-case";
import { GetSalesTrendUseCase } from "./use-cases/get-sales-trend.use-case";
import { GetRecentOrdersUseCase } from "./use-cases/get-recent-orders.use-case";
import { GetAnalyticsUseCase } from "./use-cases/get-analytics.use-case";

export function createDashboardModule() {
  let repo: DrizzleDashboardRepository | undefined;
  const getDashboardRepository = () =>
    (repo ??= new DrizzleDashboardRepository());

  let metrics: GetDashboardMetricsUseCase | undefined;
  let salesTrend: GetSalesTrendUseCase | undefined;
  let recentOrders: GetRecentOrdersUseCase | undefined;
  let analytics: GetAnalyticsUseCase | undefined;

  return {
    getDashboardRepository,
    getGetDashboardMetricsUseCase: () =>
      (metrics ??= new GetDashboardMetricsUseCase(getDashboardRepository())),
    getGetSalesTrendUseCase: () =>
      (salesTrend ??= new GetSalesTrendUseCase(getDashboardRepository())),
    getGetRecentOrdersUseCase: () =>
      (recentOrders ??= new GetRecentOrdersUseCase(getDashboardRepository())),
    getGetAnalyticsUseCase: () =>
      (analytics ??= new GetAnalyticsUseCase(getDashboardRepository())),
  };
}

export type DashboardModule = ReturnType<typeof createDashboardModule>;
