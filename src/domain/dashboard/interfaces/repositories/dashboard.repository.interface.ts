/**
 * Dashboard Repository Interface
 *
 * Defines contracts for dashboard metrics queries.
 * Implementation should be in infrastructure layer.
 */

export interface DashboardMetrics {
  revenue: number;
  orders: number;
  lowStock: number;
  pendingReviews: number;
}

export interface SalesTrendItem {
  date: string;
  revenue: number;
  orders: number;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: string;
  createdAt: Date;
}

export interface TopProduct {
  productId: string | null;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface OrderStatusCount {
  status: string;
  count: number;
}

export interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  totalCustomers: number;
  revenueTrend: SalesTrendItem[];
  topProducts: TopProduct[];
  ordersByStatus: OrderStatusCount[];
}

export interface DashboardRepositoryInterface {
  /**
   * Get key metrics for the dashboard (last 30 days)
   */
  getMetrics(): Promise<DashboardMetrics>;

  /**
   * Get sales trend data for charts (last 30 days)
   */
  getSalesTrend(): Promise<SalesTrendItem[]>;

  /**
   * Get recent orders for the dashboard
   */
  getRecentOrders(limit?: number): Promise<RecentOrder[]>;

  /**
   * Get analytics data for the analytics page
   */
  getAnalytics(days: number): Promise<AnalyticsData>;
}
