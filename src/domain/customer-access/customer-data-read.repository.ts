import type { AccessReason } from "./customer-access-policy";
import type { UserRole } from "@/domain/customers/value-objects/user-role";

export interface HistoricalOrderSummary {
  id: string;
  orderNumber: string | null;
  status: "delivered" | "cancelled" | "refunded";
  totalAmount: string;
  createdAt: Date;
  itemCount: number;
}

export interface SupportCustomer {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  orders: HistoricalOrderSummary[];
  ordersTruncated: boolean;
}

export interface ProtectedCustomerContact {
  id: string;
  phone: string | null;
  shippingAddresses: Array<{
    id: string;
    isDefault: boolean;
    fullName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
  }>;
}

export interface CustomerDataReadRepository {
  findSupportCustomerByExactEmail(
    email: string,
    orderLimit: number
  ): Promise<SupportCustomer | null>;
  findProtectedContact(
    customerId: string
  ): Promise<ProtectedCustomerContact | null>;
}

export interface CustomerAccessActor {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
}

export interface CustomerAccessReasonInput {
  reason: AccessReason;
  reasonNote?: string;
}
