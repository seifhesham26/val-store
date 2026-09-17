import type {
  AccessAction,
  AccessFieldGroup,
  AccessReason,
} from "./customer-access-policy";
import type { UserRole } from "@/domain/customers/value-objects/user-role";

export interface NewCustomerAccessAuditRecord {
  actorUserId: string;
  actorName: string | null;
  actorEmail: string;
  actorRole: UserRole;
  subjectUserId: string | null;
  orderId: string | null;
  action: AccessAction;
  fieldGroup: AccessFieldGroup;
  reason: AccessReason;
  reasonNote: string | null;
  confirmedCustomerRequest: boolean;
}

export interface CustomerAccessAuditRecord extends NewCustomerAccessAuditRecord {
  id: string;
  createdAt: Date;
}

export interface CustomerAccessAuditRepository {
  record(
    input: NewCustomerAccessAuditRecord
  ): Promise<CustomerAccessAuditRecord>;
  listByActor(input: {
    actorUserId: string;
    actorRole?: UserRole;
    limit: number;
    offset: number;
  }): Promise<{ events: CustomerAccessAuditRecord[]; total: number }>;
}
