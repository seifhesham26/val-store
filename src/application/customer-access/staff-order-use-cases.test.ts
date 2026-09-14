import { describe, expect, it, vi } from "vitest";
import { OrderEntity } from "@/domain/orders/entities/order.entity";
import type { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import type {
  CustomerAccessAuditRecord,
  CustomerAccessAuditRepository,
  NewCustomerAccessAuditRecord,
} from "@/domain/customer-access/customer-access-audit.repository";
import { RecordCustomerAccessUseCase } from "./record-customer-access.use-case";
import {
  OpenStaffOrderUseCase,
  RevealOrderDeliveryUseCase,
} from "./staff-order-use-cases";
import {
  StaffOrderAccessService,
  type SupportAccessGrantReader,
} from "./staff-order-access.service";

function order(status: OrderEntity["status"] = "shipped") {
  return new OrderEntity(
    "order-1",
    "customer-1",
    status,
    [],
    100,
    0,
    10,
    110,
    "",
    "",
    "cash_on_delivery",
    "pending",
    null,
    status === "shipped" ? new Date("2026-09-14T08:00:00.000Z") : null,
    status === "delivered" ? new Date("2026-09-14T09:00:00.000Z") : null,
    new Date("2026-09-14T07:00:00.000Z"),
    new Date("2026-09-14T08:00:00.000Z"),
    0,
    null,
    null,
    null,
    null,
    "VLK-20260914-ABC123",
    { id: "customer-1", name: "Customer", email: null }
  );
}

class MemoryAudits implements CustomerAccessAuditRepository {
  records: NewCustomerAccessAuditRecord[] = [];
  sequence: string[];

  constructor(sequence: string[] = []) {
    this.sequence = sequence;
  }

  async record(input: NewCustomerAccessAuditRecord) {
    this.sequence.push("audit");
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

const actor = {
  id: "worker-1",
  name: "Worker",
  email: "worker@example.com",
  role: "worker" as const,
};

describe("staff order use cases", () => {
  it("opens an active worker order from the safe read without claiming confirmation", async () => {
    const audits = new MemoryAudits();
    const repository = {
      findByIdForStaff: vi.fn().mockResolvedValue({
        order: order(),
        hasShippingAddress: true,
      }),
    } as unknown as OrderRepositoryInterface;
    const grants: SupportAccessGrantReader = {
      hasValidSupportGrant: vi.fn(),
    };
    const useCase = new OpenStaffOrderUseCase(
      repository,
      new StaffOrderAccessService(grants),
      new RecordCustomerAccessUseCase(audits)
    );

    const result = await useCase.execute({
      actor,
      orderId: "order-1",
      supportAccessId: "11111111-1111-4111-8111-111111111111",
    });

    expect(repository.findByIdForStaff).toHaveBeenCalledWith("order-1", false);
    expect(result.hasShippingAddress).toBe(true);
    expect(result.customer?.email).toBeNull();
    expect(audits.records[0]?.confirmedCustomerRequest).toBe(false);
    expect(grants.hasValidSupportGrant).not.toHaveBeenCalled();
  });

  it("records a validated historical grant as customer-confirmed", async () => {
    const audits = new MemoryAudits();
    const repository = {
      findByIdForStaff: vi.fn().mockResolvedValue({
        order: order("delivered"),
        hasShippingAddress: true,
      }),
    } as unknown as OrderRepositoryInterface;
    const grants: SupportAccessGrantReader = {
      hasValidSupportGrant: vi.fn().mockResolvedValue(true),
    };
    const useCase = new OpenStaffOrderUseCase(
      repository,
      new StaffOrderAccessService(grants),
      new RecordCustomerAccessUseCase(audits)
    );

    await useCase.execute({
      actor,
      orderId: "order-1",
      supportAccessId: "11111111-1111-4111-8111-111111111111",
    });

    expect(audits.records[0]?.confirmedCustomerRequest).toBe(true);
  });

  it("persists the reveal audit before loading the shipping address", async () => {
    const sequence: string[] = [];
    const audits = new MemoryAudits(sequence);
    const repository = {
      findByIdForStaff: vi.fn().mockResolvedValue({
        order: order(),
        hasShippingAddress: true,
      }),
      findShippingAddress: vi.fn().mockImplementation(async () => {
        sequence.push("shipping");
        return {
          fullName: "Customer",
          addressLine1: "1 Nile Street",
          addressLine2: null,
          city: "Cairo",
          state: "Cairo",
          postalCode: "11511",
          country: "Egypt",
          phone: "+201000000000",
        };
      }),
    } as unknown as OrderRepositoryInterface;
    const useCase = new RevealOrderDeliveryUseCase(
      repository,
      new StaffOrderAccessService({
        hasValidSupportGrant: vi.fn(),
      }),
      new RecordCustomerAccessUseCase(audits)
    );

    const result = await useCase.execute({
      actor,
      orderId: "order-1",
      supportAccessId: null,
    });

    expect(sequence).toEqual(["audit", "shipping"]);
    expect(result?.phone).toBe("+201000000000");
  });
});
