import type {
  CustomerAccessAuditRecord,
  CustomerAccessAuditRepository,
  NewCustomerAccessAuditRecord,
} from "@/domain/customer-access/customer-access-audit.repository";

export class RecordCustomerAccessUseCase {
  constructor(private readonly repository: CustomerAccessAuditRepository) {}

  async execute(
    input: NewCustomerAccessAuditRecord
  ): Promise<CustomerAccessAuditRecord> {
    if (input.action === "customer_lookup" && !input.confirmedCustomerRequest) {
      throw new Error("Customer-request confirmation is required");
    }

    if (input.reason === "other" && !input.reasonNote?.trim()) {
      throw new Error("A short note is required when the reason is other");
    }

    return this.repository.record({
      ...input,
      reasonNote: input.reasonNote?.trim() || null,
    });
  }
}
