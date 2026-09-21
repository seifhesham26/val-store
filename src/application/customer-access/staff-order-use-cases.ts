import { mapOrderToOutput } from "@/application/orders/use-cases/get-order.use-case";
import { CustomerAccessDeniedError } from "@/domain/customer-access/customer-access-denied.error";
import type { CustomerAccessActor } from "@/domain/customer-access/customer-data-read.repository";
import { OrderNotFoundException } from "@/domain/orders/exceptions/order-not-found.exception";
import type { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import { isActiveFulfillmentStatus } from "@/domain/customer-access/customer-access-policy";
import type { RecordCustomerAccessUseCase } from "./record-customer-access.use-case";
import {
  maskOrderForStaff,
  type StaffOrderAccessService,
} from "./staff-order-access.service";

interface StaffOrderInput {
  actor: CustomerAccessActor;
  orderId: string;
  supportAccessId: string | null;
}

async function authorize(
  orders: OrderRepositoryInterface,
  access: StaffOrderAccessService,
  input: StaffOrderInput
) {
  const safe = await orders.findByIdForStaff(
    input.orderId,
    input.actor.role !== "worker"
  );
  if (!safe) throw new OrderNotFoundException(input.orderId);

  const decision = await access.canOpenOrder({
    actorRole: input.actor.role,
    actorUserId: input.actor.id,
    orderStatus: safe.order.status,
    subjectUserId: safe.order.customer?.id ?? safe.order.userId ?? null,
    supportAccessId: input.supportAccessId,
  });
  if (!decision.allowed) {
    throw new CustomerAccessDeniedError(
      "Use customer-requested support lookup for historical orders"
    );
  }

  return { ...safe, decision };
}

function auditInput(
  input: StaffOrderInput,
  order: Awaited<ReturnType<typeof authorize>>["order"],
  confirmedCustomerRequest: boolean,
  action: "order_view" | "delivery_reveal"
) {
  return {
    actorUserId: input.actor.id,
    actorName: input.actor.name,
    actorEmail: input.actor.email,
    actorRole: input.actor.role,
    subjectUserId: order.customer?.id ?? order.userId ?? null,
    orderId: order.id,
    action,
    fieldGroup:
      action === "order_view"
        ? ("order_summary" as const)
        : ("shipping_contact" as const),
    reason: isActiveFulfillmentStatus(order.status)
      ? ("order_fulfillment" as const)
      : ("customer_support" as const),
    reasonNote: null,
    confirmedCustomerRequest,
  };
}

export class OpenStaffOrderUseCase {
  constructor(
    private readonly orders: OrderRepositoryInterface,
    private readonly access: StaffOrderAccessService,
    private readonly recordAccess: RecordCustomerAccessUseCase,
    private readonly returns?: Pick<
      ReturnRequestRepositoryInterface,
      "listForStaffOrder"
    >
  ) {}

  async execute(input: StaffOrderInput) {
    const safe = await authorize(this.orders, this.access, input);
    await this.recordAccess.execute(
      auditInput(
        input,
        safe.order,
        safe.decision.usedValidatedGrant,
        "order_view"
      )
    );
    const returns = this.returns
      ? await this.returns.listForStaffOrder(safe.order.id)
      : [];
    return maskOrderForStaff(
      mapOrderToOutput(safe.order),
      input.actor.role,
      safe.hasShippingAddress,
      returns.map((request) => ({
        id: request.id,
        physicalStatus: request.physicalStatus,
        payoutStatus: request.payoutStatus,
        carrierClaimStatus: request.carrierClaimStatus ?? null,
        receivedQuantity: request.items.reduce(
          (sum, line) => sum + line.returnedQuantity,
          0
        ),
        missingQuantity: request.items.reduce(
          (sum, line) =>
            sum + Math.max(0, line.requestedQuantity - line.returnedQuantity),
          0
        ),
        itemRefund: request.proposal?.itemRefund ?? 0,
        deliveryRefund: request.proposal?.deliveryRefund ?? 0,
        collectionDue: request.proposal?.collectionDue ?? 0,
        payoutMethod: request.proposal?.payoutDestination ?? "not selected",
      }))
    );
  }
}

export class RevealOrderDeliveryUseCase {
  constructor(
    private readonly orders: OrderRepositoryInterface,
    private readonly access: StaffOrderAccessService,
    private readonly recordAccess: RecordCustomerAccessUseCase
  ) {}

  async execute(input: StaffOrderInput) {
    const safe = await authorize(this.orders, this.access, input);
    await this.recordAccess.execute(
      auditInput(
        input,
        safe.order,
        safe.decision.usedValidatedGrant,
        "delivery_reveal"
      )
    );
    return this.orders.findShippingAddress(input.orderId);
  }
}
