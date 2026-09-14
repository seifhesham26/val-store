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
import { RevealCustomerContactUseCase } from "./reveal-customer-contact.use-case";

class MemoryDataRepository implements CustomerDataReadRepository {
  contact: ProtectedCustomerContact | null = null;

  async findSupportCustomerByExactEmail(): Promise<SupportCustomer | null> {
    throw new Error("not used");
  }

  async findProtectedContact() {
    return this.contact;
  }
}

class MemoryAuditRepository implements CustomerAccessAuditRepository {
  records: NewCustomerAccessAuditRecord[] = [];

  async record(input: NewCustomerAccessAuditRecord) {
    this.records.push(input);
    return {
      ...input,
      id: "audit-1",
      createdAt: new Date("2026-09-14T12:00:00.000Z"),
    } satisfies CustomerAccessAuditRecord;
  }

  async listByActor() {
    return { events: [], total: 0 };
  }
}

describe("RevealCustomerContactUseCase", () => {
  it("records the reveal before returning shipping contact data", async () => {
    const data = new MemoryDataRepository();
    data.contact = {
      id: "customer-1",
      phone: "+201000000000",
      shippingAddresses: [],
    };
    const audits = new MemoryAuditRepository();
    const useCase = new RevealCustomerContactUseCase(
      data,
      new RecordCustomerAccessUseCase(audits)
    );

    const result = await useCase.execute({
      actor: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
        role: "admin",
      },
      customerId: "customer-1",
      reason: "delivery_issue",
    });

    expect(result?.phone).toBe("+201000000000");
    expect(audits.records[0]).toMatchObject({
      subjectUserId: "customer-1",
      action: "customer_reveal",
      fieldGroup: "customer_contact",
      reason: "delivery_issue",
    });
  });

  it("does not write a reveal event for a missing customer", async () => {
    const data = new MemoryDataRepository();
    const audits = new MemoryAuditRepository();
    const useCase = new RevealCustomerContactUseCase(
      data,
      new RecordCustomerAccessUseCase(audits)
    );

    await expect(
      useCase.execute({
        actor: {
          id: "admin-1",
          name: null,
          email: "admin@example.com",
          role: "admin",
        },
        customerId: "missing",
        reason: "customer_support",
      })
    ).resolves.toBeNull();
    expect(audits.records).toEqual([]);
  });
});
