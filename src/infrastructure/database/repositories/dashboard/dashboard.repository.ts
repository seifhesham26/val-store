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
import { sql, desc, gte, eq } from "drizzle-orm";
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

    // Get total revenue (last 30 days)
    const [revenueResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
      })
      .from(orders)
      .where(gte(orders.createdAt, thirtyDaysAgo));

    // Get order count
    const [ordersResult] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(orders);

    // Get low stock count (stock < 10)
    const [lowStockResult] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(productVariants)
      .where(sql`${productVariants.stockQuantity} < 10`);

    // Get pending reviews count
    const [reviewsResult] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(reviews)
      .where(sql`${reviews.isApproved} = false`);

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
        total: sql<string>`SUM(${orders.totalAmount})`,
        count: sql<number>`COUNT(*)`,
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
    const recentOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        totalAmount: orders.totalAmount,
        createdAt: orders.createdAt,
        userId: orders.userId,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(limit);

    // Fetch customer names for each order
    const ordersWithCustomers = await Promise.all(
      recentOrders.map(async (order) => {
        let customerName = "Guest";
        if (order.userId) {
          const [customer] = await db
            .select({ name: user.name })
            .from(user)
            .where(eq(user.id, order.userId))
            .limit(1);
          customerName = customer?.name || "Unknown";
        }
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
        };
      })
    );

    return ordersWithCustomers;
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
          totalRevenue: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
          totalOrders: sql<number>`COUNT(*)`,
        })
        .from(orders)
        .where(gte(orders.createdAt, startDate))
        .then(([r]) => r),

      // 2. Revenue trend by day
      db
        .select({
          date: sql<string>`DATE(${orders.createdAt})`,
          total: sql<string>`SUM(${orders.totalAmount})`,
          count: sql<number>`COUNT(*)`,
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
        .where(gte(orders.createdAt, startDate))
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
