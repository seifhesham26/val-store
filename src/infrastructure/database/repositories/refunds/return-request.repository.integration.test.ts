import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { client, db } from "@/db";
import {
  addresses,
  orderItems,
  orders,
  payments,
  productVariants,
  returnPayouts,
  products,
  returnRequestItems,
  returnRequests,
  user,
} from "@/db/schema";
import { OrderEntity } from "@/domain/orders/entities/order.entity";
import { DrizzleOrderRepository } from "../orders/order.repository";
import { DrizzleReturnRequestRepository } from "./return-request.repository";
import { DrizzleRefundPayoutRepository } from "./refund-payout.repository";

const orderRepository = new DrizzleOrderRepository();
const repository = new DrizzleReturnRequestRepository();
const payoutRepository = new DrizzleRefundPayoutRepository();
const fixtures: { userId: string; productId: string }[] = [];

async function createPaidOrder() {
  const suffix = randomUUID();
  const userId = `return-race-${suffix}`;
  const addressId = randomUUID();
  const productId = randomUUID();
  const variantId = randomUUID();
  fixtures.push({ userId, productId });

  await db.insert(user).values({
    id: userId,
    name: "Return Race Fixture",
    email: `return-race-${suffix}@example.com`,
  });
  await db.insert(addresses).values({
    id: addressId,
    userId,
    addressType: "shipping",
    fullName: "Return Race Fixture",
    addressLine1: "1 Test Street",
    city: "Cairo",
    state: "Cairo",
    postalCode: "11511",
    country: "Egypt",
    phone: "+201000000000",
  });
  await db.insert(products).values({
    id: productId,
    name: "Return Race Product",
    slug: `return-race-${suffix}`,
    sku: `RETURN-PRODUCT-${suffix}`,
    basePrice: "100.00",
  });
  await db.insert(productVariants).values({
    id: variantId,
    productId,
    sku: `RETURN-VARIANT-${suffix}`,
    stockQuantity: 4,
  });

  const now = new Date();
  const order = await orderRepository.create(
    new OrderEntity(
      randomUUID(),
      userId,
      "pending",
      [
        {
          id: "",
          productId,
          variantId,
          productName: "Return Race Product",
          variantDetails: "Test",
          quantity: 1,
          price: 100,
          refundedQuantity: 0,
        },
      ],
      100,
      0,
      5,
      105,
      addressId,
      addressId,
      "stripe",
      "pending",
      null,
      null,
      null,
      now,
      now
    )
  );
  await orderRepository.markAsPaid(order.id);
  return (await orderRepository.findById(order.id))!;
}

async function createConfirmedReturn(
  order: Awaited<ReturnType<typeof createPaidOrder>>,
  options: { restockedQuantity?: number } = {}
) {
  const request = await repository.create({
    orderId: order.id,
    customerId: order.userId,
    reason: "defective",
    pickupMethod: "courier",
    lines: [{ orderItemId: order.items[0].id, quantity: 1 }],
  });
  await db
    .update(returnRequestItems)
    .set({
      receivedQuantity: 1,
      inspectedQuantity: 1,
      approvedQuantity: 1,
      restockedQuantity: options.restockedQuantity ?? 1,
      outcome:
        (options.restockedQuantity ?? 1) > 0 ? "unworn" : "damaged_quarantine",
      fault: "valkyrie",
      itemRefund: "100.00",
    })
    .where(eq(returnRequestItems.requestId, request.id));
  await db
    .update(returnRequests)
    .set({ status: "inspection_pending" })
    .where(eq(returnRequests.id, request.id));
  await repository.saveProposal({
    requestId: request.id,
    expectedVersion: 0,
    actorId: order.userId,
    itemRefund: 100,
    deliveryRefund: 5,
    collectionDue: 0,
    totalRefund: 105,
    payoutDestination: "original_payment",
    customerCopy: "Refund approved",
    calculation: { source: "integration-test" },
  });
  await db
    .update(returnRequests)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(eq(returnRequests.id, request.id));
  return request;
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0).reverse()) {
    const ownedOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.userId, fixture.userId));
    for (const order of ownedOrders) {
      const ownedRequests = await db
        .select({ id: returnRequests.id })
        .from(returnRequests)
        .where(eq(returnRequests.orderId, order.id));
      if (ownedRequests.length > 0) {
        await db.delete(returnPayouts).where(
          inArray(
            returnPayouts.requestId,
            ownedRequests.map((request) => request.id)
          )
        );
      }
      await db
        .delete(returnRequests)
        .where(eq(returnRequests.orderId, order.id));
    }
    await db.delete(orders).where(eq(orders.userId, fixture.userId));
    await db.delete(products).where(eq(products.id, fixture.productId));
    await db.delete(user).where(eq(user.id, fixture.userId));
  }
});

afterAll(async () => {
  await client.end({ timeout: 5 });
});

describe("DrizzleReturnRequestRepository.finalize", () => {
  it("records an approved return exactly once across concurrent finalization", async () => {
    const order = await createPaidOrder();
    const request = await repository.create({
      orderId: order.id,
      customerId: order.userId,
      reason: "defective",
      customerNote: "Seam failed",
      pickupMethod: "courier",
      lines: [{ orderItemId: order.items[0].id, quantity: 1 }],
    });

    await db
      .update(returnRequestItems)
      .set({
        receivedQuantity: 1,
        inspectedQuantity: 1,
        approvedQuantity: 1,
        restockedQuantity: 1,
        outcome: "defective",
        fault: "valkyrie",
        itemRefund: "100.00",
      })
      .where(eq(returnRequestItems.requestId, request.id));
    await db
      .update(returnRequests)
      .set({ status: "inspection_pending" })
      .where(eq(returnRequests.id, request.id));
    await repository.saveProposal({
      requestId: request.id,
      expectedVersion: 0,
      actorId: order.userId,
      itemRefund: 100,
      deliveryRefund: 5,
      collectionDue: 0,
      totalRefund: 105,
      payoutDestination: "original_payment",
      customerCopy: "Refund approved",
      calculation: { source: "integration-test" },
    });
    await db
      .update(returnRequests)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(returnRequests.id, request.id));

    const results = await Promise.allSettled([
      repository.finalize({
        requestId: request.id,
        customerId: order.userId,
        proposalVersion: 1,
      }),
      repository.finalize({
        requestId: request.id,
        customerId: order.userId,
        proposalVersion: 1,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(2);
    const [line] = await db
      .select({ refundedQuantity: orderItems.refundedQuantity })
      .from(orderItems)
      .where(eq(orderItems.id, order.items[0].id));
    const [recordedOrder] = await db
      .select({ refundedShippingAmount: orders.refundedShippingAmount })
      .from(orders)
      .where(eq(orders.id, order.id));
    const [recordedReturnLine] = await db
      .select({ returnedQuantity: returnRequestItems.returnedQuantity })
      .from(returnRequestItems)
      .where(eq(returnRequestItems.requestId, request.id));
    const [recordedRequest] = await db
      .select({
        status: returnRequests.status,
        physicalStatus: returnRequests.physicalStatus,
        payoutStatus: returnRequests.payoutStatus,
      })
      .from(returnRequests)
      .where(eq(returnRequests.id, request.id));

    expect(line.refundedQuantity).toBe(0);
    expect(recordedReturnLine.returnedQuantity).toBe(1);
    expect(recordedOrder.refundedShippingAmount).toBe("0.00");
    expect(recordedRequest).toMatchObject({
      status: "recorded",
      physicalStatus: "resellable",
      payoutStatus: "pending",
    });
  });

  it("records financial totals only after verified payout success is persisted", async () => {
    const order = await createPaidOrder();
    await db
      .update(payments)
      .set({ paymentMethod: "credit_card", transactionId: "opay-payment-1" })
      .where(eq(payments.orderId, order.id));
    const request = await repository.create({
      orderId: order.id,
      customerId: order.userId,
      reason: "defective",
      pickupMethod: "in_store",
      lines: [{ orderItemId: order.items[0].id, quantity: 1 }],
    });
    await db
      .update(returnRequestItems)
      .set({
        receivedQuantity: 1,
        inspectedQuantity: 1,
        approvedQuantity: 1,
        restockedQuantity: 0,
        outcome: "damaged_quarantine",
        fault: "valkyrie",
        itemRefund: "100.00",
      })
      .where(eq(returnRequestItems.requestId, request.id));
    await db
      .update(returnRequests)
      .set({ status: "inspection_pending" })
      .where(eq(returnRequests.id, request.id));
    await repository.saveProposal({
      requestId: request.id,
      expectedVersion: 0,
      actorId: order.userId,
      itemRefund: 100,
      deliveryRefund: 5,
      collectionDue: 0,
      totalRefund: 105,
      payoutDestination: "original_payment",
      customerCopy: "Refund approved",
      calculation: { source: "integration-test" },
    });
    await db
      .update(returnRequests)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(returnRequests.id, request.id));
    await repository.finalize({
      requestId: request.id,
      customerId: order.userId,
      proposalVersion: 1,
    });

    const prepared = await payoutRepository.prepare(request.id);
    expect(prepared.action).toBe("initiate");
    if (prepared.action !== "initiate") throw new Error("Expected payout");
    expect(prepared.payout).toMatchObject({
      amount: 105,
      originalPaymentReference: "opay-payment-1",
      status: "pending",
    });
    await payoutRepository.recordObservation({
      payoutId: prepared.payout.id,
      status: "succeeded",
      providerReference: "opay-refund-1",
    });
    // Replaying the verified webhook/result is idempotent.
    await payoutRepository.recordObservation({
      payoutId: prepared.payout.id,
      status: "succeeded",
      providerReference: "opay-refund-1",
    });

    const [line] = await db
      .select({ refundedQuantity: orderItems.refundedQuantity })
      .from(orderItems)
      .where(eq(orderItems.id, order.items[0].id));
    const [recordedOrder] = await db
      .select({ refundedShippingAmount: orders.refundedShippingAmount })
      .from(orders)
      .where(eq(orders.id, order.id));
    const [payout] = await db
      .select({ status: returnPayouts.status })
      .from(returnPayouts)
      .where(eq(returnPayouts.requestId, request.id));
    expect(line.refundedQuantity).toBe(1);
    expect(recordedOrder.refundedShippingAmount).toBe("5.00");
    expect(payout.status).toBe("succeeded");
  });

  it("lets cancellation or physical finalization win without restocking twice", async () => {
    const order = await createPaidOrder();
    const request = await createConfirmedReturn(order);

    const results = await Promise.allSettled([
      repository.finalize({
        requestId: request.id,
        customerId: order.userId,
        proposalVersion: 1,
      }),
      orderRepository.updateStatus(order.id, "cancelled", { force: true }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    const [variant] = await db
      .select({ stockQuantity: productVariants.stockQuantity })
      .from(productVariants)
      .where(eq(productVariants.id, order.items[0].variantId!));
    expect(variant.stockQuantity).toBe(4);
  });

  it("rejects a confirmed proposal when stored inspection money changed", async () => {
    const order = await createPaidOrder();
    const request = await createConfirmedReturn(order);
    await db
      .update(returnRequestItems)
      .set({ itemRefund: "90.00" })
      .where(eq(returnRequestItems.requestId, request.id));

    await expect(
      repository.finalize({
        requestId: request.id,
        customerId: order.userId,
        proposalVersion: 1,
      })
    ).rejects.toThrow(/inspection facts changed/i);
  });
});
