import { db } from "@/db";
import { addresses, orders, user } from "@/db/schema";
import { HISTORICAL_ORDER_STATUSES } from "@/domain/customer-access/customer-access-policy";
import type {
  CustomerDataReadRepository,
  HistoricalOrderSummary,
} from "@/domain/customer-access/customer-data-read.repository";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

export class DrizzleCustomerDataReadRepository implements CustomerDataReadRepository {
  async findSupportCustomerByExactEmail(email: string, orderLimit: number) {
    const customer = await db.query.user.findFirst({
      where: sql`lower(${user.email}) = ${email}`,
      columns: { id: true, name: true, email: true, createdAt: true },
    });
    if (!customer) return null;

    const rows = await db.query.orders.findMany({
      where: and(
        eq(orders.userId, customer.id),
        inArray(orders.status, [...HISTORICAL_ORDER_STATUSES])
      ),
      orderBy: [desc(orders.createdAt), desc(orders.id)],
      limit: orderLimit + 1,
      columns: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
      },
      with: { items: { columns: { id: true } } },
    });

    const ordersPage = rows.slice(0, orderLimit).map(({ items, ...order }) => ({
      ...order,
      status: order.status as HistoricalOrderSummary["status"],
      itemCount: items.length,
    }));

    return {
      ...customer,
      orders: ordersPage,
      ordersTruncated: rows.length > orderLimit,
    };
  }

  async findProtectedContact(customerId: string) {
    const [customer, shippingAddresses] = await Promise.all([
      db.query.user.findFirst({
        where: eq(user.id, customerId),
        columns: { id: true, phone: true },
      }),
      db.query.addresses.findMany({
        where: and(
          eq(addresses.userId, customerId),
          eq(addresses.addressType, "shipping")
        ),
        columns: {
          id: true,
          isDefault: true,
          fullName: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          phone: true,
        },
      }),
    ]);

    if (!customer) return null;
    return { ...customer, shippingAddresses };
  }
}
