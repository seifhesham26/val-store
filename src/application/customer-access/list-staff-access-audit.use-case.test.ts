import { describe, expect, it } from "vitest";
import type {
  CustomerAccessAuditRecord,
  CustomerAccessAuditRepository,
} from "@/domain/customer-access/customer-access-audit.repository";
import { ListStaffAccessAuditUseCase } from "./list-staff-access-audit.use-case";

class MemoryAuditRepository implements CustomerAccessAuditRepository {
  listInputs: Parameters<CustomerAccessAuditRepository["listByActor"]>[0][] =
    [];

  async record(): Promise<CustomerAccessAuditRecord> {
    throw new Error("not used");
  }

  async listByActor(
    input: Parameters<CustomerAccessAuditRepository["listByActor"]>[0]
  ) {
    this.listInputs.push(input);
    return { events: [], total: 0 };
  }
}

describe("ListStaffAccessAuditUseCase", () => {
  it("returns every retained event when staff review themselves", async () => {
    const repository = new MemoryAuditRepository();
    const useCase = new ListStaffAccessAuditUseCase(repository);

    await useCase.execute({
      viewerUserId: "admin-1",
      viewerRole: "admin",
      actorUserId: "admin-1",
      limit: 25,
      offset: 0,
    });

    expect(repository.listInputs).toEqual([
      { actorUserId: "admin-1", actorRole: undefined, limit: 25, offset: 0 },
    ]);
  });

  it("limits an admin reviewing another account to worker-era events", async () => {
    const repository = new MemoryAuditRepository();
    const useCase = new ListStaffAccessAuditUseCase(repository);

    await useCase.execute({
      viewerUserId: "admin-1",
      viewerRole: "admin",
      actorUserId: "staff-2",
      limit: 25,
      offset: 0,
    });

    expect(repository.listInputs).toEqual([
      { actorUserId: "staff-2", actorRole: "worker", limit: 25, offset: 0 },
    ]);
  });

  it("lets a super admin review all retained role snapshots", async () => {
    const repository = new MemoryAuditRepository();
    const useCase = new ListStaffAccessAuditUseCase(repository);

    await useCase.execute({
      viewerUserId: "super-1",
      viewerRole: "super_admin",
      actorUserId: "staff-2",
      limit: 25,
      offset: 0,
    });

    expect(repository.listInputs[0]?.actorRole).toBeUndefined();
  });

  it("denies a worker trying to inspect another account", async () => {
    const repository = new MemoryAuditRepository();
    const useCase = new ListStaffAccessAuditUseCase(repository);

    await expect(
      useCase.execute({
        viewerUserId: "worker-1",
        viewerRole: "worker",
        actorUserId: "worker-2",
        limit: 25,
        offset: 0,
      })
    ).rejects.toMatchObject({ name: "CustomerAccessDeniedError" });
    expect(repository.listInputs).toEqual([]);
  });
});
