/**
 * Dashboard Repository Implementation
 *
 * Implements dashboard metrics queries using Drizzle ORM.
 */

import { db } from "@/db";
import {
  orders,
  reviews,
  productVariants,
  user,
  orderItems,
} from "@/db/schema";
import { sql, desc, gte, eq, and } from "drizzle-orm";
import {
  SUM_NET_REVENUE,
  COLLECTED_PAYMENT,
} from "@/infrastructure/database/queries/revenue";
import {
  DashboardRepositoryInterface,
  DashboardMetrics,
  SalesTrendItem,
  RecentOrder,
  AnalyticsData,
  TopProduct,
  OrderStatusCount,
} from "@/domain/dashboard/interfaces/repositories/dashboard.repository.interface";

export class DrizzleDashboardRepository implements DashboardRepositoryInterface {
  /**
   * Get key metrics for the dashboard (last 30 days)
   */
  async getMetrics(): Promise<DashboardMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Four independent queries with no data dependency between them, issued
    // together so postgres.js pipelines them down one connection instead of
    // paying a round trip each — the same reasoning `getAnalytics` below
    // already applies. This used to await each in turn: about four round
    // trips (~230ms on Neon warm) for what pipelines into roughly one.
    const [revenueResult, ordersResult, lowStockResult, reviewsResult] =
      await Promise.all([
        // Revenue actually collected in the window, net of returns. This used
        // to be an unfiltered SUM over every order, so abandoned checkouts,
        // cancelled orders and fully refunded orders all counted at face
        // value.
        db
          .select({
            total: sql<string>`${SUM_NET_REVENUE}`,
          })
          .from(orders)
          .where(gte(orders.createdAt, thirtyDaysAgo))
          .then(([r]) => r),

        // Bounded to the same 30 days as revenue. It used to be COUNT(*) over
        // the whole table while the card beside it was windowed, so two
        // cards on the same row reported two different time ranges and
        // neither said so.
        db
          .select({
            count: sql<number>`COUNT(*)::int`,
          })
          .from(orders)
          .where(gte(orders.createdAt, thirtyDaysAgo))
          .then(([r]) => r),

        // Get low stock count (stock < 10)
        db
          .select({
            count: sql<number>`COUNT(*)::int`,
          })
          .from(productVariants)
          .where(sql`${productVariants.stockQuantity} < 10`)
          .then(([r]) => r),

        // Get pending reviews count
        db
          .select({
            count: sql<number>`COUNT(*)::int`,
          })
          .from(reviews)
          .where(sql`${reviews.isApproved} = false`)
          .then(([r]) => r),
      ]);

    return {
      revenue: parseFloat(revenueResult.total || "0"),
      orders: ordersResult.count || 0,
      lowStock: lowStockResult.count || 0,
      pendingReviews: reviewsResult.count || 0,
    };
  }

  /**
   * Get sales trend data for charts (last 30 days)
   */
  async getSalesTrend(): Promise<SalesTrendItem[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesData = await db
      .select({
        date: sql<string>`DATE(${orders.createdAt})`,
        total: sql<string>`${SUM_NET_REVENUE}`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(orders)
      .where(gte(orders.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE(${orders.createdAt})`)
      .orderBy(sql`DATE(${orders.createdAt})`);

    return salesData.map((row) => ({
      date: row.date,
      revenue: parseFloat(row.total || "0"),
      orders: row.count,
    }));
  }

  /**
   * Get recent orders for the dashboard
   */
  async getRecentOrders(limit: number = 5): Promise<RecentOrder[]> {
    // One query with a join, not one per row. There is no `orders → user`
    // relation to lean on, so the join is explicit — but it is still a join.
    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        totalAmount: orders.totalAmount,
        createdAt: orders.createdAt,
        userId: orders.userId,
        customerName: user.name,
      })
      .from(orders)
      .leftJoin(user, eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt))
      .limit(limit);

    return rows.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      // No user id means a guest order; a user id with no row means the account
      // was deleted (orders.userId is ON DELETE SET NULL, so this is rare).
      customerName: order.userId ? (order.customerName ?? "Unknown") : "Guest",
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    }));
  }

  /**
   * Get analytics data for the analytics page
   */
  async getAnalytics(days: number): Promise<AnalyticsData> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Run all queries in parallel for performance
    const [
      revenueAndOrders,
      revenueTrend,
      topProducts,
      statusBreakdown,
      customerCount,
    ] = await Promise.all([
      // 1. Total revenue & order count for the period
      db
        .select({
          totalRevenue: sql<string>`${SUM_NET_REVENUE}`,
          totalOrders: sql<number>`COUNT(*)::int`,
        })
        .from(orders)
        .where(gte(orders.createdAt, startDate))
        .then(([r]) => r),

      // 2. Revenue trend by day
      db
        .select({
          date: sql<string>`DATE(${orders.createdAt})`,
          total: sql<string>`${SUM_NET_REVENUE}`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(orders)
        .where(gte(orders.createdAt, startDate))
        .groupBy(sql`DATE(${orders.createdAt})`)
        .orderBy(sql`DATE(${orders.createdAt})`),

      // 3. Top 5 products by quantity sold
      db
        .select({
          productId: orderItems.productId,
          productName: orderItems.productName,
          totalQuantity: sql<number>`SUM(${orderItems.quantity})::int`,
          totalRevenue: sql<string>`SUM(${orderItems.totalPrice})`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        // Same gate as the revenue figures: a "top product" built from
        // abandoned checkouts is not a top product.
        .where(and(gte(orders.createdAt, startDate), COLLECTED_PAYMENT))
        .groupBy(orderItems.productId, orderItems.productName)
        .orderBy(sql`SUM(${orderItems.quantity}) DESC`)
        .limit(5),

      // 4. Orders by status
      db
        .select({
          status: orders.status,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(orders)
        .where(gte(orders.createdAt, startDate))
        .groupBy(orders.status),

      // 5. Unique customers
      db
        .select({
          count: sql<number>`COUNT(DISTINCT ${orders.userId})::int`,
        })
        .from(orders)
        .where(gte(orders.createdAt, startDate))
        .then(([r]) => r),
    ]);

    const totalRevenue = parseFloat(revenueAndOrders.totalRevenue || "0");
    const totalOrders = revenueAndOrders.totalOrders || 0;

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      totalCustomers: customerCount.count || 0,
      revenueTrend: revenueTrend.map((row) => ({
        date: row.date,
        revenue: parseFloat(row.total || "0"),
        orders: row.count,
      })),
      topProducts: topProducts.map(
        (row): TopProduct => ({
          productId: row.productId,
          productName: row.productName,
          totalQuantity: row.totalQuantity || 0,
          totalRevenue: parseFloat(row.totalRevenue || "0"),
        })
      ),
      ordersByStatus: statusBreakdown.map(
        (row): OrderStatusCount => ({
          status: row.status,
          count: row.count || 0,
        })
      ),
    };
  }
}
