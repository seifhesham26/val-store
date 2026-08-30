import { OrderEntity } from "@/domain/orders/entities/order.entity";
import { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";

/**
 * List Orders Use Case
 */

export interface ListOrdersInput {
  userId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  minTotal?: number;
  maxTotal?: number;
  /** Only orders where money was captured and not yet returned. */
  refundableOnly?: boolean;
  /** Only orders that have had at least one unit sent back. */
  returnedOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface OrderListItem {
  id: string;
  /** `VLK-…`, the number the customer sees. Null only if the row predates it. */
  orderNumber: string | null;
  userId: string;
  /** Resolved from the auth `user` table; null for an orphaned or guest order. */
  customerName: string | null;
  customerEmail: string | null;
  status: string;
  totalAmount: number;
  totalItems: number;
  createdAt: Date;
  isPaid: boolean;
  isDelivered: boolean;
  paymentMethod: string | null;
  paymentStatus: string | null;
  isRefundable: boolean;
  /** Units sent back, out of `totalItems`. Zero for an untouched order. */
  refundedItems: number;
  /** Money already returned, scaled for any coupon the order used. */
  refundedAmount: number;
  /** What the order is actually worth once returns are taken off. */
  netAmount: number;
  partiallyRefunded: boolean;
  fullyRefunded: boolean;
}

export interface ListOrdersOutput {
  orders: OrderListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListOrdersUseCase {
  constructor(private readonly orderRepository: OrderRepositoryInterface) {}

  async execute(input: ListOrdersInput = {}): Promise<ListOrdersOutput> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 10;
    const offset = (page - 1) * limit;

    // Fetch orders from repository (without pagination for now - slice in memory)
    const allOrders = await this.orderRepository.findAll({
      userId: input.userId,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    // Refundability and return state are both derived (from the joined payment
    // row and from the line quantities), so they are filtered here rather than
    // in SQL. Applied before paging so counts stay correct.
    let filteredOrders = allOrders;
    if (input.refundableOnly) {
      filteredOrders = filteredOrders.filter((order) => order.canRefund());
    }
    if (input.returnedOnly) {
      filteredOrders = filteredOrders.filter(
        (order) => order.getRefundedItems() > 0
      );
    }

    // Get total count
    const total = filteredOrders.length;
    const totalPages = Math.ceil(total / limit);

    // Apply pagination
    const paginatedOrders = filteredOrders.slice(offset, offset + limit);

    // Map to DTOs
    const orderDTOs = paginatedOrders.map((order) => this.mapToDTO(order));

    return {
      orders: orderDTOs,
      total,
      page,
      limit,
      totalPages,
    };
  }

  private mapToDTO(order: OrderEntity): OrderListItem {
    const refundedAmount = order.refundedAmount();

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      customerName: order.customer?.name ?? null,
      customerEmail: order.customer?.email ?? null,
      status: order.status,
      totalAmount: order.totalAmount,
      totalItems: order.getTotalItems(),
      createdAt: order.createdAt,
      isPaid: order.isPaid(),
      isDelivered: order.isDelivered(),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      isRefundable: order.canRefund(),
      refundedItems: order.getRefundedItems(),
      refundedAmount,
      netAmount: Math.max(0, order.totalAmount - refundedAmount),
      partiallyRefunded: order.isPartiallyRefunded(),
      fullyRefunded: order.isFullyRefunded(),
    };
  }
}
