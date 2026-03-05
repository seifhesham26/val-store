import { OrderEntity } from "@/domain/entities/order.entity";
import { OrderRepositoryInterface } from "@/domain/interfaces/repositories/order.repository.interface";

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
  page?: number;
  limit?: number;
}

export interface OrderListItem {
  id: string;
  userId: string;
  status: string;
  totalAmount: number;
  totalItems: number;
  createdAt: Date;
  isPaid: boolean;
  isDelivered: boolean;
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

    // Get total count
    const total = allOrders.length;
    const totalPages = Math.ceil(total / limit);

    // Apply pagination
    const paginatedOrders = allOrders.slice(offset, offset + limit);

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
    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      totalAmount: order.totalAmount,
      totalItems: order.getTotalItems(),
      createdAt: order.createdAt,
      isPaid: order.isPaid(),
      isDelivered: order.isDelivered(),
    };
  }
}
