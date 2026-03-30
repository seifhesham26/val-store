/**
 * Order Repository Interface
 *
 * Defines the contract for Order data operations.
 * Implementation will be in the infrastructure layer.
 */

import { OrderEntity } from "@/domain/orders/entities/order.entity";

export interface OrderFilters {
  status?: string; // Changed to string for compatibility with use cases
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface OrderRepositoryInterface {
  /**
   * Find an order by ID
   */
  findById(orderId: string): Promise<OrderEntity | null>;

  /**
   * Find all orders with optional filters
   */
  findAll(filters?: OrderFilters): Promise<OrderEntity[]>;

  /**
   * Find orders by user ID
   */
  findByUserId(userId: string): Promise<OrderEntity[]>;

  /**
   * Find orders by status
   */
  findByStatus(status: string): Promise<OrderEntity[]>;

  /**
   * Get user's recent orders
   */
  findRecentByUserId(userId: string, limit?: number): Promise<OrderEntity[]>;

  /**
   * Create a new order
   */
  create(order: OrderEntity): Promise<OrderEntity>;

  /**
   * Update an existing order
   */
  update(order: OrderEntity): Promise<OrderEntity>;

  /**
   * Update order status
   */
  updateStatus(orderId: string, status: string): Promise<OrderEntity>;

  /**
   * Delete an order
   */
  delete(orderId: string): Promise<void>;

  /**
   * Get total revenue (sum of all paid orders)
   */
  getTotalRevenue(): Promise<number>;

  /**
   * Get order count by status
   */
  countByStatus(status: string): Promise<number>;

  /**
   * Get order count with filters
   */
  count(filters?: OrderFilters): Promise<number>;
}
