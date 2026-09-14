import type { CustomerAccessAuditRepository } from "@/domain/customer-access/customer-access-audit.repository";
import { CustomerAccessDeniedError } from "@/domain/customer-access/customer-access-denied.error";
import type { UserRole } from "@/domain/customers/value-objects/user-role";

export class ListStaffAccessAuditUseCase {
  constructor(private readonly repository: CustomerAccessAuditRepository) {}

  async execute(input: {
    viewerUserId: string;
    viewerRole: UserRole;
    actorUserId: string;
    limit: number;
    offset: number;
  }) {
    const isSelf = input.viewerUserId === input.actorUserId;
    if (!isSelf && input.viewerRole === "worker") {
      throw new CustomerAccessDeniedError(
        "You cannot review this staff member's access history"
      );
    }
    if (input.viewerRole === "customer") {
      throw new CustomerAccessDeniedError();
    }

    return this.repository.listByActor({
      actorUserId: input.actorUserId,
      actorRole: !isSelf && input.viewerRole === "admin" ? "worker" : undefined,
      limit: input.limit,
      offset: input.offset,
    });
  }
}
