import { describe, expect, it, vi } from "vitest";

import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import type { ReturnRequestRecord } from "@/domain/refunds/return-request";
import {
  ReturnEvidenceUploadService,
  UploadThingEvidenceStorage,
} from "./uploadthing-evidence-storage.service";

const request = (
  overrides: Partial<ReturnRequestRecord> = {}
): ReturnRequestRecord => ({
  id: "return-1",
  orderId: "order-1",
  customerId: "customer-1",
  status: "awaiting_customer_evidence",
  reason: "defective",
  customerNote: null,
  pickupMethod: "courier",
  physicalStatus: "pending",
  payoutStatus: null,
  proposalVersion: 0,
  proposalOpenedAt: null,
  acknowledgedAt: null,
  confirmedAt: null,
  recordedAt: null,
  createdAt: new Date("2026-09-21T10:00:00.000Z"),
  updatedAt: new Date("2026-09-21T10:00:00.000Z"),
  items: [],
  proposal: null,
  ...overrides,
});

function repository(overrides: Partial<ReturnRequestRepositoryInterface> = {}) {
  return {
    findForCustomer: vi.fn().mockResolvedValue(request()),
    findForStaff: vi.fn().mockResolvedValue(request()),
    countEvidence: vi.fn().mockResolvedValue(0),
    attachEvidence: vi.fn().mockResolvedValue(undefined),
    findEvidence: vi.fn().mockResolvedValue({
      id: "evidence-1",
      requestId: "return-1",
      storageKey: "private/evidence.jpg",
    }),
    recordEvidenceAccess: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ReturnRequestRepositoryInterface;
}

describe("ReturnEvidenceUploadService", () => {
  it("rejects a customer photo upload for a return they do not own", async () => {
    const returns = repository({
      findForCustomer: vi.fn().mockResolvedValue(null),
    });
    const service = new ReturnEvidenceUploadService(returns);

    await expect(
      service.authorizeCustomerUpload({
        actor: { id: "customer-2", role: "customer" },
        requestId: "return-1",
        kind: "customer_product_photo",
      })
    ).rejects.toThrow(/not found/i);
  });

  it("does not let a worker upload customer evidence", async () => {
    const service = new ReturnEvidenceUploadService(repository());

    await expect(
      service.authorizeCustomerUpload({
        actor: { id: "worker-1", role: "worker" },
        requestId: "return-1",
        kind: "customer_product_photo",
      })
    ).rejects.toThrow(/customer/i);
  });

  it("does not let a customer upload the receiving inspection video", async () => {
    const service = new ReturnEvidenceUploadService(repository());

    await expect(
      service.authorizeReceivingUpload({
        actor: { id: "customer-1", role: "customer" },
        requestId: "return-1",
        kind: "receiving_inspection_video",
      })
    ).rejects.toThrow(/staff/i);
  });

  it("rejects the wrong MIME type and an extra required customer photo", async () => {
    const returns = repository({
      countEvidence: vi
        .fn()
        .mockImplementation(({ kind }) =>
          Promise.resolve(kind === "customer_product_photo" ? 1 : 0)
        ),
    });
    const service = new ReturnEvidenceUploadService(returns);

    await expect(
      service.authorizeCustomerUpload({
        actor: { id: "customer-1", role: "customer" },
        requestId: "return-1",
        kind: "customer_product_photo",
      })
    ).rejects.toThrow(/already uploaded/i);

    await expect(
      service.recordUpload({
        authorization: {
          actor: { id: "customer-1", role: "customer" },
          requestId: "return-1",
          kind: "customer_package_photo",
        },
        file: {
          key: "private/evidence.pdf",
          name: "evidence.pdf",
          type: "application/pdf",
          size: 100,
        },
      })
    ).rejects.toThrow(/image/i);

    await expect(
      service.recordUpload({
        authorization: {
          actor: { id: "customer-1", role: "customer" },
          requestId: "return-1",
          kind: "customer_package_photo",
        },
        file: {
          key: "private/evidence.svg",
          name: "evidence.svg",
          type: "image/svg+xml",
          size: 100,
        },
      })
    ).rejects.toThrow(/image/i);
  });

  it("rejects uploads after the return has been rejected or recorded", async () => {
    for (const status of ["rejected", "recorded"] as const) {
      const service = new ReturnEvidenceUploadService(
        repository({
          findForCustomer: vi.fn().mockResolvedValue(request({ status })),
        })
      );

      await expect(
        service.authorizeCustomerUpload({
          actor: { id: "customer-1", role: "customer" },
          requestId: "return-1",
          kind: "customer_package_photo",
        })
      ).rejects.toThrow(/not allowed/i);
    }
  });

  it("records only an allowed receiving video with uploader metadata", async () => {
    const returns = repository({
      findForStaff: vi
        .fn()
        .mockResolvedValue(request({ status: "inspection_pending" })),
    });
    const service = new ReturnEvidenceUploadService(returns);
    const authorization = await service.authorizeReceivingUpload({
      actor: { id: "worker-1", role: "worker" },
      requestId: "return-1",
      kind: "receiving_inspection_video",
    });

    await service.recordUpload({
      authorization,
      file: {
        key: "private/inspection.mp4",
        name: "inspection.mp4",
        type: "video/mp4",
        size: 1024,
      },
    });

    expect(returns.attachEvidence).toHaveBeenCalledWith({
      requestId: "return-1",
      uploaderId: "worker-1",
      uploaderRole: "worker",
      kind: "receiving_inspection_video",
      storageKey: "private/inspection.mp4",
      mimeType: "video/mp4",
      sizeBytes: 1024,
      originalMetadata: { fileName: "inspection.mp4" },
    });
  });
});

describe("UploadThingEvidenceStorage", () => {
  it("generates a short-lived signed URL only after a super-admin view is audited", async () => {
    const generateSignedURL = vi
      .fn()
      .mockResolvedValue({ ufsUrl: "https://private.example/evidence" });
    const returns = repository();
    const storage = new UploadThingEvidenceStorage(
      { generateSignedURL },
      returns
    );

    await expect(
      storage.getSignedUrl({
        actor: { id: "super-1", role: "super_admin" },
        requestId: "return-1",
        storageKey: "private/evidence.jpg",
      })
    ).resolves.toBe("https://private.example/evidence");

    expect(returns.recordEvidenceAccess).toHaveBeenCalledWith({
      actorId: "super-1",
      actorRole: "super_admin",
      requestId: "return-1",
      evidenceId: "evidence-1",
    });
    expect(generateSignedURL).toHaveBeenCalledWith("private/evidence.jpg", {
      expiresIn: 300,
    });
  });

  it("does not generate a signed URL for an admin or a key outside the request", async () => {
    const generateSignedURL = vi.fn();
    const storage = new UploadThingEvidenceStorage(
      { generateSignedURL },
      repository({ findEvidence: vi.fn().mockResolvedValue(null) })
    );

    await expect(
      storage.getSignedUrl({
        actor: { id: "admin-1", role: "admin" },
        requestId: "return-1",
        storageKey: "private/evidence.jpg",
      })
    ).rejects.toThrow(/super admin/i);
    await expect(
      storage.getSignedUrl({
        actor: { id: "super-1", role: "super_admin" },
        requestId: "return-1",
        storageKey: "private/unrelated.jpg",
      })
    ).rejects.toThrow(/not found/i);
    expect(generateSignedURL).not.toHaveBeenCalled();
  });
});
