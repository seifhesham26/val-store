import type { GetOrderOutput } from "@/application/orders/use-cases/get-order.use-case";
import type { ListOrdersOutput } from "@/application/orders/use-cases/list-orders.use-case";
import { isActiveFulfillmentStatus } from "@/domain/customer-access/customer-access-policy";
import type { UserRole } from "@/domain/customers/value-objects/user-role";

export interface SupportAccessGrantReader {
  hasValidSupportGrant(input: {
    accessId: string;
    actorUserId: string;
    subjectUserId: string;
  }): Promise<boolean>;
}

export interface StaffOrderAccessDecision {
  allowed: boolean;
  usedValidatedGrant: boolean;
}

export class StaffOrderAccessService {
  constructor(private readonly grants: SupportAccessGrantReader) {}

  async canOpenOrder(input: {
    actorRole: UserRole;
    actorUserId: string;
    orderStatus: string;
    subjectUserId: string | null;
    supportAccessId: string | null;
  }): Promise<StaffOrderAccessDecision> {
    if (input.actorRole === "admin" || input.actorRole === "super_admin") {
      return { allowed: true, usedValidatedGrant: false };
    }

    if (input.actorRole !== "worker") {
      return { allowed: false, usedValidatedGrant: false };
    }
    if (isActiveFulfillmentStatus(input.orderStatus)) {
      return { allowed: true, usedValidatedGrant: false };
    }
    if (!input.supportAccessId || !input.subjectUserId) {
      return { allowed: false, usedValidatedGrant: false };
    }

    const valid = await this.grants.hasValidSupportGrant({
      accessId: input.supportAccessId,
      actorUserId: input.actorUserId,
      subjectUserId: input.subjectUserId,
    });

    return { allowed: valid, usedValidatedGrant: valid };
  }
}

export type StaffOrderDetail = Omit<
  GetOrderOutput,
  | "shippingAddressId"
  | "billingAddressId"
  | "shippingAddress"
  | "billingAddress"
  | "customer"
> & {
  hasShippingAddress: boolean;
  customer: null | {
    id: string;
    name: string;
    email: string | null;
  };
  returns: Array<{
    id: string;
    physicalStatus: string;
    payoutStatus: string | null;
    carrierClaimStatus: string | null;
    receivedQuantity: number;
    missingQuantity: number;
    itemRefund: number;
    deliveryRefund: number;
    collectionDue: number;
    payoutMethod: string;
  }>;
};

export function maskOrderForStaff(
  order: GetOrderOutput,
  role: UserRole,
  hasShippingAddress = order.shippingAddress !== null,
  returns: StaffOrderDetail["returns"] = []
): StaffOrderDetail {
  const customer = order.customer;
  const safeOrder: Partial<GetOrderOutput> = { ...order };
  delete safeOrder.shippingAddressId;
  delete safeOrder.billingAddressId;
  delete safeOrder.shippingAddress;
  delete safeOrder.billingAddress;
  delete safeOrder.customer;

  return {
    ...safeOrder,
    hasShippingAddress,
    returns,
    customer:
      customer && role === "worker" ? { ...customer, email: null } : customer,
  } as StaffOrderDetail;
}

export function redactOrderListForRole(
  page: ListOrdersOutput,
  role: UserRole
): ListOrdersOutput {
  if (role !== "worker") return page;

  return {
    ...page,
    orders: page.orders.map((order) => ({
      ...order,
      customerEmail: null,
    })),
  };
}
