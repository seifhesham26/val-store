import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubmitAdjustmentRequestUseCase } from "./submit-adjustment-request.use-case";
import { CompleteInventoryInspectionUseCase } from "./complete-inventory-inspection.use-case";
import { ReviewAdjustmentRequestUseCase } from "./review-adjustment-request.use-case";
import { ListInventoryWorkUseCase } from "./list-inventory-work.use-case";
import type { InventoryRequestsRepositoryInterface } from "@/domain/inventory/interfaces/repositories/inventory-requests.repository.interface";
import type { InventoryAdjustmentRequestRecord } from "@/domain/inventory/inventory-operations";
import type { UserRole } from "@/domain/customers/value-objects/user-role";

const request: InventoryAdjustmentRequestRecord = {
  id: "request",
  variantId: "variant",
  inspectionId: null,
  productName: "Shirt",
  sku: "SHIRT-M",
  size: "M",
  color: "Black",
  requester: { id: "worker", name: "Worker" },
  category: "missing",
  requestedQuantity: 2,
  explanation: "Counted twice",
  stockAtRequest: 12,
  status: "pending",
  approvedQuantity: null,
  reviewer: null,
  decisionExplanation: null,
  reviewedAt: null,
  inventoryLogId: null,
  createdAt: new Date("2026-09-15"),
};
const actor = (role: UserRole) => ({ id: role, name: role, role });
const command = {
  variantId: "variant",
  category: "missing" as const,
  requestedQuantity: 2,
  explanation: "  Counted twice  ",
};
let repo: InventoryRequestsRepositoryInterface;
const notify = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  repo = {
    submit: vi.fn().mockResolvedValue({ success: true, request }),
    completeAllFine: vi.fn().mockResolvedValue({
      success: true,
      inspection: {
        id: "inspection",
        variantId: "variant",
        productName: "Shirt",
        sku: "SHIRT-M",
        size: "M",
        color: "Black",
        triggerStock: 12,
        status: "all_fine",
        completedBy: { id: "worker", name: "worker" },
        completedAt: new Date("2026-09-15"),
        adjustmentRequestId: null,
        cycleEndedAt: null,
        createdAt: new Date("2026-09-15"),
      },
    }),
    review: vi.fn().mockResolvedValue({
      success: true,
      request: { ...request, status: "approved" },
    }),
    listWork: vi.fn().mockResolvedValue({
      pendingInspections: [],
      pendingRequestGroups: [],
      history: [],
    }),
    countPending: vi.fn().mockResolvedValue(0),
  };
});
describe("inventory workflow authorization", () => {
  it.each(["customer", "admin", "super_admin"] as const)(
    "rejects %s worker commands before storage",
    async (role) => {
      expect(
        await new SubmitAdjustmentRequestUseCase(repo, {
          inventoryAdjustmentRequested: notify,
        }).execute({ ...command, actor: actor(role) })
      ).toEqual({ success: false, error: "forbidden" });
      expect(
        await new CompleteInventoryInspectionUseCase(repo).execute({
          inspectionId: "inspection",
          actor: actor(role),
        })
      ).toEqual({ success: false, error: "forbidden" });
      expect(repo.submit).not.toHaveBeenCalled();
      expect(repo.completeAllFine).not.toHaveBeenCalled();
    }
  );
  it.each(["customer", "worker"] as const)(
    "rejects %s review before storage",
    async (role) => {
      expect(
        await new ReviewAdjustmentRequestUseCase(repo).execute({
          requestId: "request",
          decision: "approved",
          actor: actor(role),
        })
      ).toEqual({ success: false, error: "forbidden" });
      expect(repo.review).not.toHaveBeenCalled();
    }
  );
  it.each(["admin", "super_admin"] as const)(
    "allows %s ordinary approval without explanation",
    async (role) => {
      expect(
        await new ReviewAdjustmentRequestUseCase(repo).execute({
          requestId: "request",
          decision: "approved",
          actor: actor(role),
        })
      ).toMatchObject({ success: true });
    }
  );
  it("allows workers to complete inspections", async () => {
    expect(
      await new CompleteInventoryInspectionUseCase(repo).execute({
        inspectionId: "inspection",
        actor: actor("worker"),
      })
    ).toMatchObject({ success: true });
    expect(repo.completeAllFine).toHaveBeenCalledWith({
      inspectionId: "inspection",
      worker: { id: "worker", name: "worker" },
    });
  });
  it("rejects customer work-list access", async () => {
    expect(
      await new ListInventoryWorkUseCase(repo).execute({
        actor: actor("customer"),
      })
    ).toEqual({ success: false, error: "forbidden" });
    expect(repo.listWork).not.toHaveBeenCalled();
  });
  it("returns the persistent pending work-item count for staff", async () => {
    vi.mocked(repo.countPending).mockResolvedValue(7);
    const useCase = new ListInventoryWorkUseCase(repo);
    expect(useCase).toMatchObject({ countPending: expect.any(Function) });

    await expect(
      useCase.countPending({ actor: actor("worker") })
    ).resolves.toEqual({ success: true, count: 7 });
    expect(repo.countPending).toHaveBeenCalledOnce();
  });
  it("rejects customer pending-count access before storage", async () => {
    const useCase = new ListInventoryWorkUseCase(repo);
    expect(useCase).toMatchObject({ countPending: expect.any(Function) });

    await expect(
      useCase.countPending({ actor: actor("customer") })
    ).resolves.toEqual({ success: false, error: "forbidden" });
    expect(repo.countPending).not.toHaveBeenCalled();
  });
});
describe("inventory workflow validation and atomic results", () => {
  it.each(["", " \n ", "x".repeat(501)])(
    "rejects invalid explanation",
    async (explanation) => {
      expect(
        await new SubmitAdjustmentRequestUseCase(repo, {
          inventoryAdjustmentRequested: notify,
        }).execute({ ...command, explanation, actor: actor("worker") })
      ).toEqual({ success: false, error: "invalid_explanation" });
      expect(repo.submit).not.toHaveBeenCalled();
    }
  );
  it.each([0, -1, 1.5, NaN, Infinity])(
    "rejects quantity %s for submission and approval",
    async (quantity) => {
      expect(
        await new SubmitAdjustmentRequestUseCase(repo, {
          inventoryAdjustmentRequested: notify,
        }).execute({
          ...command,
          requestedQuantity: quantity,
          actor: actor("worker"),
        })
      ).toEqual({ success: false, error: "invalid_quantity" });
      expect(
        await new ReviewAdjustmentRequestUseCase(repo).execute({
          requestId: "request",
          decision: "approved",
          approvedQuantity: quantity,
          actor: actor("admin"),
        })
      ).toEqual({ success: false, error: "invalid_quantity" });
      expect(repo.submit).not.toHaveBeenCalled();
      expect(repo.review).not.toHaveBeenCalled();
    }
  );
  it("requires a trimmed rejection reason", async () => {
    expect(
      await new ReviewAdjustmentRequestUseCase(repo).execute({
        requestId: "request",
        decision: "rejected",
        decisionExplanation: "  ",
        actor: actor("admin"),
      })
    ).toEqual({ success: false, error: "decision_explanation_required" });
    expect(repo.review).not.toHaveBeenCalled();
  });
  it("propagates corrected-approval validation from the locked original", async () => {
    vi.mocked(repo.review).mockResolvedValue({
      success: false,
      error: "decision_explanation_required",
    });
    expect(
      await new ReviewAdjustmentRequestUseCase(repo).execute({
        requestId: "request",
        decision: "approved",
        approvedQuantity: 3,
        actor: actor("admin"),
      })
    ).toEqual({ success: false, error: "decision_explanation_required" });
  });
  it.each(["conflict", "variant_deleted", "insufficient_stock"] as const)(
    "preserves atomic failure %s",
    async (error) => {
      vi.mocked(repo.review).mockResolvedValue({ success: false, error });
      expect(
        await new ReviewAdjustmentRequestUseCase(repo).execute({
          requestId: "request",
          decision: "approved",
          actor: actor("admin"),
        })
      ).toEqual({ success: false, error });
    }
  );
  it("saves the trimmed original then notifies using saved snapshots", async () => {
    const events: string[] = [];
    vi.mocked(repo.submit).mockImplementation(async () => {
      events.push("saved");
      return { success: true, request };
    });
    notify.mockImplementation(async () => {
      events.push("notified");
    });
    expect(
      await new SubmitAdjustmentRequestUseCase(repo, {
        inventoryAdjustmentRequested: notify,
      }).execute({ ...command, actor: actor("worker") })
    ).toEqual({ success: true, request });
    expect(events).toEqual(["saved", "notified"]);
    expect(repo.submit).toHaveBeenCalledWith({
      ...command,
      explanation: "Counted twice",
      requester: { id: "worker", name: "worker" },
    });
    expect(notify).toHaveBeenCalledWith({
      requestId: "request",
      sku: "SHIRT-M",
      category: "missing",
      quantity: 2,
    });
  });
  it("never notifies a failed submission", async () => {
    vi.mocked(repo.submit).mockResolvedValue({
      success: false,
      error: "variant_deleted",
    });
    expect(
      await new SubmitAdjustmentRequestUseCase(repo, {
        inventoryAdjustmentRequested: notify,
      }).execute({ ...command, actor: actor("worker") })
    ).toEqual({ success: false, error: "variant_deleted" });
    expect(notify).not.toHaveBeenCalled();
    vi.mocked(repo.submit).mockRejectedValue(new Error("database down"));
    await expect(
      new SubmitAdjustmentRequestUseCase(repo, {
        inventoryAdjustmentRequested: notify,
      }).execute({ ...command, actor: actor("worker") })
    ).rejects.toThrow("database down");
    expect(notify).not.toHaveBeenCalled();
  });
  it("returns the saved request even if the notifier throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    notify.mockRejectedValue(new Error("notification down"));
    expect(
      await new SubmitAdjustmentRequestUseCase(repo, {
        inventoryAdjustmentRequested: notify,
      }).execute({ ...command, actor: actor("worker") })
    ).toEqual({ success: true, request });
    log.mockRestore();
  });
});
