import { describe, expect, it } from "vitest";
import type { GetOrderOutput } from "@/application/orders/use-cases/get-order.use-case";
import type { ListOrdersOutput } from "@/application/orders/use-cases/list-orders.use-case";
import {
  StaffOrderAccessService,
  maskOrderForStaff,
  redactOrderListForRole,
  type SupportAccessGrantReader,
} from "./staff-order-access.service";

class MemoryGrantReader implements SupportAccessGrantReader {
  valid = false;
  calls: Array<{
    accessId: string;
    actorUserId: string;
    subjectUserId: string;
  }> = [];

  async hasValidSupportGrant(input: {
    accessId: string;
    actorUserId: string;
    subjectUserId: string;
  }): Promise<boolean> {
    this.calls.push(input);
    return this.valid;
  }
}

const accessInput = {
  actorRole: "worker" as const,
  actorUserId: "worker-1",
  orderStatus: "delivered",
  subjectUserId: "customer-1",
  supportAccessId: null,
};

describe("StaffOrderAccessService", () => {
  it("lets a worker open an active order without a support grant", async () => {
    const grants = new MemoryGrantReader();
    const service = new StaffOrderAccessService(grants);

    await expect(
      service.canOpenOrder({ ...accessInput, orderStatus: "shipped" })
    ).resolves.toEqual({ allowed: true, usedValidatedGrant: false });
    expect(grants.calls).toEqual([]);
  });

  it("denies a worker historical access without a support grant", async () => {
    const service = new StaffOrderAccessService(new MemoryGrantReader());

    await expect(service.canOpenOrder(accessInput)).resolves.toEqual({
      allowed: false,
      usedValidatedGrant: false,
    });
  });

  it("accepts a matching support grant for a historical order", async () => {
    const grants = new MemoryGrantReader();
    grants.valid = true;
    const service = new StaffOrderAccessService(grants);

    await expect(
      service.canOpenOrder({
        ...accessInput,
        supportAccessId: "11111111-1111-4111-8111-111111111111",
      })
    ).resolves.toEqual({ allowed: true, usedValidatedGrant: true });
    expect(grants.calls).toEqual([
      {
        accessId: "11111111-1111-4111-8111-111111111111",
        actorUserId: "worker-1",
        subjectUserId: "customer-1",
      },
    ]);
  });

  it.each(["admin", "super_admin"] as const)(
    "lets %s open historical orders without a grant",
    async (actorRole) => {
      const service = new StaffOrderAccessService(new MemoryGrantReader());
      await expect(
        service.canOpenOrder({ ...accessInput, actorRole })
      ).resolves.toEqual({ allowed: true, usedValidatedGrant: false });
    }
  );

  it("never grants a customer staff order access", async () => {
    const service = new StaffOrderAccessService(new MemoryGrantReader());
    await expect(
      service.canOpenOrder({ ...accessInput, actorRole: "customer" })
    ).resolves.toEqual({ allowed: false, usedValidatedGrant: false });
  });

  it("ignores an unneeded grant id instead of treating it as confirmation", async () => {
    const grants = new MemoryGrantReader();
    grants.valid = true;
    const service = new StaffOrderAccessService(grants);

    await expect(
      service.canOpenOrder({
        ...accessInput,
        orderStatus: "processing",
        supportAccessId: "11111111-1111-4111-8111-111111111111",
      })
    ).resolves.toEqual({ allowed: true, usedValidatedGrant: false });
    expect(grants.calls).toEqual([]);
  });
});

const orderDetail: GetOrderOutput = {
  id: "11111111-1111-4111-8111-111111111111",
  orderNumber: "VLK-20260914-ABC123",
  userId: "customer-1",
  customer: {
    id: "customer-1",
    name: "Customer",
    email: "customer@example.com",
  },
  status: "shipped",
  items: [],
  subtotal: 100,
  tax: 0,
  shippingCost: 10,
  totalAmount: 110,
  discount: 0,
  shippingAddressId: "22222222-2222-4222-8222-222222222222",
  billingAddressId: "33333333-3333-4333-8333-333333333333",
  shippingAddress: {
    fullName: "Customer",
    addressLine1: "1 Nile Street",
    addressLine2: null,
    city: "Cairo",
    state: "Cairo",
    postalCode: "11511",
    country: "Egypt",
    phone: "+201000000000",
  },
  billingAddress: {
    fullName: "Customer",
    addressLine1: "2 Billing Street",
    addressLine2: null,
    city: "Cairo",
    state: "Cairo",
    postalCode: "11511",
    country: "Egypt",
    phone: "+201000000000",
  },
  paymentMethod: "cash_on_delivery",
  paymentStatus: "pending",
  hasCapturedPayment: false,
  isPaid: false,
  isShipped: true,
  isDelivered: false,
  canCancel: false,
  canRefund: false,
  awaitingPayment: false,
  refundedAmount: 0,
  partiallyRefunded: false,
  fullyRefunded: false,
  paymentDeadline: null,
  paidAt: null,
  shippedAt: new Date("2026-09-14T08:00:00.000Z"),
  deliveredAt: null,
  createdAt: new Date("2026-09-14T07:00:00.000Z"),
  updatedAt: new Date("2026-09-14T08:00:00.000Z"),
};

describe("staff order DTOs", () => {
  it("removes both address objects and ids from default order detail", () => {
    const masked = maskOrderForStaff(orderDetail, "admin");

    expect(masked.hasShippingAddress).toBe(true);
    expect(masked).not.toHaveProperty("shippingAddress");
    expect(masked).not.toHaveProperty("billingAddress");
    expect(masked).not.toHaveProperty("shippingAddressId");
    expect(masked).not.toHaveProperty("billingAddressId");
  });

  it("removes customer email from worker order detail", () => {
    const workerDetail = maskOrderForStaff(orderDetail, "worker");
    const adminDetail = maskOrderForStaff(orderDetail, "admin");

    expect(workerDetail.customer?.email).toBeNull();
    expect(adminDetail.customer?.email).toBe("customer@example.com");
    expect(orderDetail.customer?.email).toBe("customer@example.com");
  });

  it("removes email from worker rows without changing the admin result", () => {
    const page: ListOrdersOutput = {
      orders: [
        {
          id: orderDetail.id,
          orderNumber: orderDetail.orderNumber,
          userId: orderDetail.userId,
          customerName: "Customer",
          customerEmail: "customer@example.com",
          status: "shipped",
          totalAmount: 110,
          totalItems: 1,
          createdAt: orderDetail.createdAt,
          isPaid: false,
          isDelivered: false,
          paymentMethod: "cash_on_delivery",
          paymentStatus: "pending",
          isRefundable: false,
          refundedItems: 0,
          refundedAmount: 0,
          netAmount: 110,
          partiallyRefunded: false,
          fullyRefunded: false,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    const workerPage = redactOrderListForRole(page, "worker");
    const adminPage = redactOrderListForRole(page, "admin");

    expect(workerPage.orders[0]?.customerEmail).toBeNull();
    expect(adminPage.orders[0]?.customerEmail).toBe("customer@example.com");
    expect(page.orders[0]?.customerEmail).toBe("customer@example.com");
  });
});
