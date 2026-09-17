import { describe, expect, it } from "vitest";
import type {
  CustomerAccessAuditRecord,
  CustomerAccessAuditRepository,
  NewCustomerAccessAuditRecord,
} from "@/domain/customer-access/customer-access-audit.repository";
import type {
  CustomerDataReadRepository,
  ProtectedCustomerContact,
  SupportCustomer,
} from "@/domain/customer-access/customer-data-read.repository";
import { RecordCustomerAccessUseCase } from "./record-customer-access.use-case";
import { LookupCustomerSupportUseCase } from "./lookup-customer-support.use-case";

class MemoryDataRepository implements CustomerDataReadRepository {
  customer: SupportCustomer | null = null;
  calls: Array<{ email: string; orderLimit: number }> = [];

  async findSupportCustomerByExactEmail(email: string, orderLimit: number) {
    this.calls.push({ email, orderLimit });
    return this.customer;
  }

  async findProtectedContact(): Promise<ProtectedCustomerContact | null> {
    throw new Error("not used");
  }
}

class MemoryAuditRepository implements CustomerAccessAuditRepository {
  records: NewCustomerAccessAuditRecord[] = [];

  async record(input: NewCustomerAccessAuditRecord) {
    this.records.push(input);
    return {
      ...input,
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: new Date("2026-09-14T12:00:00.000Z"),
    } satisfies CustomerAccessAuditRecord;
  }

  async listByActor() {
    return { events: [], total: 0 };
  }
}

const actor = {
  id: "worker-1",
  name: "Worker",
  email: "worker@example.com",
  role: "worker" as const,
};

describe("LookupCustomerSupportUseCase", () => {
  it("performs an exact lookup, returns its grant, and records confirmation", async () => {
    const data = new MemoryDataRepository();
    data.customer = {
      id: "customer-1",
      name: "Customer",
      email: "customer@example.com",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      orders: [],
      ordersTruncated: false,
    };
    const audits = new MemoryAuditRepository();
    const useCase = new LookupCustomerSupportUseCase(
      data,
      new RecordCustomerAccessUseCase(audits)
    );

    const result = await useCase.execute({
      actor,
      email: "customer@example.com",
      reason: "order_status",
    });

    expect(data.calls).toEqual([
      { email: "customer@example.com", orderLimit: 100 },
    ]);
    expect(result.supportAccessId).toBe("11111111-1111-4111-8111-111111111111");
    expect(audits.records[0]).toMatchObject({
      subjectUserId: "customer-1",
      action: "customer_lookup",
      confirmedCustomerRequest: true,
    });
  });

  it("records an unsuccessful exact-email attempt without inventing a subject", async () => {
    const data = new MemoryDataRepository();
    const audits = new MemoryAuditRepository();
    const useCase = new LookupCustomerSupportUseCase(
      data,
      new RecordCustomerAccessUseCase(audits)
    );

    const result = await useCase.execute({
      actor,
      email: "missing@example.com",
      reason: "delivery_problem",
    });

    expect(result.customer).toBeNull();
    expect(audits.records[0]?.subjectUserId).toBeNull();
  });
});
