import { describe, expect, it } from "vitest";
import type {
  CustomerAccessAuditRecord,
  CustomerAccessAuditRepository,
  NewCustomerAccessAuditRecord,
} from "@/domain/customer-access/customer-access-audit.repository";
import { RecordCustomerAccessUseCase } from "./record-customer-access.use-case";

class MemoryAuditRepository implements CustomerAccessAuditRepository {
  recorded: NewCustomerAccessAuditRecord[] = [];
  error: Error | null = null;

  async record(
    input: NewCustomerAccessAuditRecord
  ): Promise<CustomerAccessAuditRecord> {
    if (this.error) throw this.error;
    this.recorded.push(input);
    return {
      ...input,
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: new Date("2026-09-14T10:00:00.000Z"),
    };
  }

  async listByActor() {
    return { events: [], total: 0 };
  }

  async findLatestActorRole() {
    return null;
  }
}

const baseInput = {
  actorUserId: "staff-1",
  actorName: "Staff Member",
  actorEmail: "staff@example.com",
  actorRole: "worker" as const,
  subjectUserId: "customer-1",
  orderId: null,
  action: "customer_lookup" as const,
  fieldGroup: "customer_history" as const,
  reason: "order_status" as const,
  reasonNote: null,
  confirmedCustomerRequest: true,
};

describe("RecordCustomerAccessUseCase", () => {
  it("records a confirmed support lookup", async () => {
    const repository = new MemoryAuditRepository();
    const useCase = new RecordCustomerAccessUseCase(repository);

    const result = await useCase.execute(baseInput);

    expect(result.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(repository.recorded).toEqual([baseInput]);
  });

  it("rejects a support lookup without explicit customer confirmation", async () => {
    const repository = new MemoryAuditRepository();
    const useCase = new RecordCustomerAccessUseCase(repository);

    await expect(
      useCase.execute({
        ...baseInput,
        confirmedCustomerRequest: false,
      })
    ).rejects.toThrow("Customer-request confirmation is required");
    expect(repository.recorded).toEqual([]);
  });

  it("requires a note when the reason is other", async () => {
    const repository = new MemoryAuditRepository();
    const useCase = new RecordCustomerAccessUseCase(repository);

    await expect(
      useCase.execute({
        ...baseInput,
        reason: "other",
        reasonNote: "  ",
      })
    ).rejects.toThrow("A short note is required");
    expect(repository.recorded).toEqual([]);
  });

  it("propagates persistence failure so protected data cannot be returned", async () => {
    const repository = new MemoryAuditRepository();
    repository.error = new Error("audit database unavailable");
    const useCase = new RecordCustomerAccessUseCase(repository);

    await expect(useCase.execute(baseInput)).rejects.toThrow(
      "audit database unavailable"
    );
  });
});
