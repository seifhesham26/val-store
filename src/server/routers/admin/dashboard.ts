import { router, adminProcedure } from "../../trpc";
import { container } from "@/application/container";
import { z } from "zod";

/**
 * Dashboard Router - Admin Dashboard Metrics
 *
 * Refactored to follow Onion Architecture:
 * - No direct DB queries
 * - Delegates to use cases via DI container
 * - Protected with admin-only access
 */

export const dashboardRouter = router({
  // Get key metrics
  getMetrics: adminProcedure.query(async () => {
    const useCase = container.getGetDashboardMetricsUseCase();
    return useCase.execute();
  }),

  // Get sales trend for the chart. The window is the caller's, bounded here
  // rather than left open: the value drives a per-day loop in the repository,
  // so an unbounded `days` would be an easy way to make an admin query build
  // an arbitrarily long series.
  getSalesTrend: adminProcedure
    .input(
      z
        .object({
          days: z.number().int().min(1).max(365).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const useCase = container.getGetSalesTrendUseCase();
      return useCase.execute(input?.days);
    }),

  // Get recent orders
  getRecentOrders: adminProcedure.query(async () => {
    const useCase = container.getGetRecentOrdersUseCase();
    return useCase.execute();
  }),

  // Get analytics data
  getAnalytics: adminProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }))
    .query(async ({ input }) => {
      const useCase = container.getGetAnalyticsUseCase();
      return useCase.execute(input.days);
    }),
});
