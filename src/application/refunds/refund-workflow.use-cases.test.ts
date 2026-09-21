import { describe, expect, it, vi } from "vitest";

import type { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import type { ReturnRequestRecord } from "@/domain/refunds/return-request";
import { CreateReturnRequestUseCase } from "./use-cases/create-return-request.use-case";
import { AuthorizeReturnPickupUseCase } from "./use-cases/authorize-return-pickup.use-case";
import { AcknowledgeReturnProposalUseCase } from "./use-cases/acknowledge-return-proposal.use-case";
import { RejectReturnUseCase } from "./use-cases/reject-return.use-case";
import { RecordReturnInspectionUseCase } from "./use-cases/record-return-inspection.use-case";
import { RequestReturnOtpUseCase } from "./use-cases/request-return-otp.use-case";
import { ConfirmReturnOtpUseCase } from "./use-cases/confirm-return-otp.use-case";
import { UnavailableRefundOtpService } from "./refund-otp.service";
import type { RefundOtpService } from "./refund-otp.service";

const request = (
  overrides: Partial<ReturnRequestRecord> = {}
): ReturnRequestRecord => ({
  id: "return-1",
  orderId: "order-1",
  customerId: "customer-1",
  status: "awaiting_customer_confirmation",
  reason: "defective",
  customerNote: null,
  pickupMethod: "courier",
  physicalStatus: "received",
  payoutStatus: null,
  proposalVersion: 1,
  proposalOpenedAt: new Date("2026-09-20T10:00:00.000Z"),
  acknowledgedAt: null,
  confirmedAt: null,
  recordedAt: null,
  createdAt: new Date("2026-09-19T10:00:00.000Z"),
  updatedAt: new Date("2026-09-20T10:00:00.000Z"),
  items: [],
  proposal: null,
  ...overrides,
});

describe("refund workflow use cases", () => {
  it("fails closed while the WhatsApp OTP provider is not configured", async () => {
    const otp = new UnavailableRefundOtpService();
    await expect(
      otp.request({
        requestId: "return-1",
        proposalVersion: 1,
        phone: "+201000000000",
      })
    ).rejects.toThrow(/provider unavailable/i);
  });

  it("rejects creation for an order owned by another customer", async () => {
    const orderRepository = {
      findById: vi.fn().mockResolvedValue({ userId: "someone-else" }),
    } as unknown as OrderRepositoryInterface;
    const returnRepository = {
      create: vi.fn(),
    } as unknown as ReturnRequestRepositoryInterface;

    await expect(
      new CreateReturnRequestUseCase(orderRepository, returnRepository).execute(
        {
          userId: "customer-1",
          orderId: "order-1",
          reason: "change_of_mind",
          pickupMethod: "courier",
          lines: [{ orderItemId: "line-1", quantity: 1 }],
        }
      )
    ).rejects.toThrow(/not found/i);
  });

  it("does not let a worker authorize pickup or reject an outcome", async () => {
    const repository = {
      findForStaff: vi.fn().mockResolvedValue(request({ status: "requested" })),
      transition: vi.fn(),
      reject: vi.fn(),
    } as unknown as ReturnRequestRepositoryInterface;

    await expect(
      new AuthorizeReturnPickupUseCase(repository).execute({
        actor: { id: "worker-1", role: "worker" },
        requestId: "return-1",
      })
    ).rejects.toThrow(/admin/i);
    await expect(
      new RejectReturnUseCase(repository).execute({
        actor: { id: "worker-1", role: "worker" },
        requestId: "return-1",
        reason: "Not eligible",
      })
    ).rejects.toThrow(/admin/i);
  });

  it("enforces the ten-second server read interval", async () => {
    const repository = {
      findForCustomer: vi.fn().mockResolvedValue(request()),
      acknowledgeProposal: vi
        .fn()
        .mockResolvedValue(request({ acknowledgedAt: new Date() })),
    } as unknown as ReturnRequestRepositoryInterface;
    const useCase = new AcknowledgeReturnProposalUseCase(
      repository,
      () => new Date("2026-09-20T10:00:09.999Z")
    );

    await expect(
      useCase.execute({
        userId: "customer-1",
        requestId: "return-1",
        proposalVersion: 1,
      })
    ).rejects.toThrow(/10 seconds/i);
  });

  it("acknowledges the current proposal after ten seconds", async () => {
    const acknowledged = request({
      acknowledgedAt: new Date("2026-09-20T10:00:10.000Z"),
    });
    const repository = {
      findForCustomer: vi.fn().mockResolvedValue(request()),
      acknowledgeProposal: vi.fn().mockResolvedValue(acknowledged),
    } as unknown as ReturnRequestRepositoryInterface;
    const useCase = new AcknowledgeReturnProposalUseCase(
      repository,
      () => new Date("2026-09-20T10:00:10.000Z")
    );

    await expect(
      useCase.execute({
        userId: "customer-1",
        requestId: "return-1",
        proposalVersion: 1,
      })
    ).resolves.toBe(acknowledged);
  });

  it("does not let a worker classify inspection fault or calculate money", async () => {
    const repository = {} as ReturnRequestRepositoryInterface;
    await expect(
      new RecordReturnInspectionUseCase(repository).execute({
        actor: { id: "worker-1", role: "worker" },
        requestId: "return-1",
        expectedStatus: "inspection_pending",
        evidenceComplete: true,
        auditedMediaException: false,
        returnedAllOrder: true,
        originalDelivery: 80,
        collectionFee: 60,
        capturedPayment: 1080,
        payoutDestination: "original_payment",
        customerCopy: "Inspection complete",
        lines: [
          {
            requestItemId: "request-line-1",
            paidAmount: 1000,
            receivedQuantity: 1,
            inspectedQuantity: 1,
            approvedQuantity: 1,
            restockedQuantity: 1,
            outcome: "defective",
            fault: "valkyrie",
          },
        ],
      })
    ).rejects.toThrow(/admin/i);
  });

  it("requires receiving-video evidence or an audited exception before inspection", async () => {
    const repository = {} as ReturnRequestRepositoryInterface;

    await expect(
      new RecordReturnInspectionUseCase(repository).execute({
        actor: { id: "admin-1", role: "admin" },
        requestId: "return-1",
        expectedStatus: "inspection_pending",
        evidenceComplete: false,
        auditedMediaException: false,
        returnedAllOrder: true,
        originalDelivery: 80,
        collectionFee: 60,
        capturedPayment: 1080,
        payoutDestination: "original_payment",
        customerCopy: "Inspection complete",
        lines: [],
      })
    ).rejects.toThrow(/receiving video/i);
  });

  it("issues an OTP only for the acknowledged current positive proposal", async () => {
    const otp = { request: vi.fn().mockResolvedValue({ id: "challenge-1" }) };
    const repository = {
      findForCustomer: vi.fn().mockResolvedValue(
        request({
          acknowledgedAt: new Date("2026-09-20T10:00:10.000Z"),
          proposal: {
            id: "proposal-1",
            version: 1,
            itemRefund: 100,
            deliveryRefund: 0,
            collectionDue: 0,
            totalRefund: 100,
            payoutDestination: "original_payment",
            customerCopy: "Approved",
            calculation: {},
            createdAt: new Date(),
          },
        })
      ),
    } as unknown as ReturnRequestRepositoryInterface;

    await expect(
      new RequestReturnOtpUseCase(
        repository,
        otp as unknown as RefundOtpService,
        { findVerifiedPhone: vi.fn().mockResolvedValue("+201000000000") }
      ).execute({
        userId: "customer-1",
        requestId: "return-1",
        proposalVersion: 1,
      })
    ).resolves.toEqual({ id: "challenge-1" });
    expect(otp.request).toHaveBeenCalledWith({
      requestId: "return-1",
      proposalVersion: 1,
      phone: "+201000000000",
    });
  });

  it("uses only the verified account phone for OTP delivery", async () => {
    const otp = { request: vi.fn() };
    const repository = {
      findForCustomer: vi.fn().mockResolvedValue(
        request({
          acknowledgedAt: new Date(),
          proposal: {
            id: "proposal-1",
            version: 1,
            itemRefund: 100,
            deliveryRefund: 0,
            collectionDue: 0,
            totalRefund: 100,
            payoutDestination: "original_payment",
            customerCopy: "Approved",
            calculation: {},
            createdAt: new Date(),
          },
        })
      ),
    } as unknown as ReturnRequestRepositoryInterface;

    await expect(
      new RequestReturnOtpUseCase(
        repository,
        otp as unknown as RefundOtpService,
        {
          findVerifiedPhone: vi.fn().mockResolvedValue(null),
        }
      ).execute({
        userId: "customer-1",
        requestId: "return-1",
        proposalVersion: 1,
      })
    ).rejects.toThrow(/verified phone/i);
    expect(otp.request).not.toHaveBeenCalled();
  });

  it("finalizes only after OTP verification for the stored acknowledged proposal", async () => {
    const otp = { verify: vi.fn().mockResolvedValue({ id: "confirmation-1" }) };
    const finalized = request({ status: "recorded", recordedAt: new Date() });
    const repository = {
      findForCustomer: vi.fn().mockResolvedValue(
        request({
          acknowledgedAt: new Date(),
          proposal: {
            id: "proposal-1",
            version: 1,
            itemRefund: 100,
            deliveryRefund: 0,
            collectionDue: 0,
            totalRefund: 100,
            payoutDestination: "original_payment",
            customerCopy: "Approved",
            calculation: {},
            createdAt: new Date(),
          },
        })
      ),
      transition: vi.fn().mockResolvedValue(request({ status: "confirmed" })),
      finalize: vi.fn().mockResolvedValue(finalized),
    } as unknown as ReturnRequestRepositoryInterface;

    await expect(
      new ConfirmReturnOtpUseCase(
        repository,
        otp as unknown as RefundOtpService
      ).execute({
        userId: "customer-1",
        requestId: "return-1",
        proposalVersion: 1,
        challengeId: "challenge-1",
        code: "123456",
      })
    ).resolves.toBe(finalized);
    expect(otp.verify).toHaveBeenCalledWith({
      requestId: "return-1",
      proposalVersion: 1,
      challengeId: "challenge-1",
      code: "123456",
    });
    expect(repository.finalize).toHaveBeenCalledWith({
      requestId: "return-1",
      customerId: "customer-1",
      proposalVersion: 1,
    });
  });
});
