import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("../../utils/auth-helpers", () => ({
  getUserRole: async () => "customer",
  requireAuth: (user: unknown) => {
    if (!user) throw new Error("UNAUTHORIZED");
  },
  requireAdmin: () => {},
  requireAdminArea: () => {},
  requireSuperAdmin: () => {},
}));

const request = {
  id: "d6c1e931-0dc7-4fc9-9012-0d8270ebf8d1",
  orderId: "a3f74d6a-343d-47c5-bfe7-8cb3966aa5e9",
  customerId: "customer-one",
  status: "awaiting_customer_confirmation" as const,
  proposalVersion: 1,
  proposalOpenedAt: null,
  acknowledgedAt: null,
  proposal: { totalRefund: 100 },
};

const repository = {
  findForCustomer: vi.fn(),
  listForOrder: vi.fn(),
  markProposalOpened: vi.fn(),
};
const create = { execute: vi.fn() };
const acknowledge = { execute: vi.fn() };
const requestOtp = { execute: vi.fn() };
const confirmOtp = { execute: vi.fn() };

vi.mock("@/application/container", () => ({
  container: {
    getReturnRequestRepository: () => repository,
    getCreateReturnRequestUseCase: () => create,
    getAcknowledgeReturnProposalUseCase: () => acknowledge,
    getRequestReturnOtpUseCase: () => requestOtp,
    getConfirmReturnOtpUseCase: () => confirmOtp,
  },
}));

const { returnsRouter } = await import("./returns");
const { createDirectContext } = await import("../../trpc");

const owner = returnsRouter.createCaller(
  createDirectContext({
    id: "customer-one",
    email: "owner@example.com",
    name: "Owner",
    role: "customer",
  })
);
const stranger = returnsRouter.createCaller(
  createDirectContext({
    id: "customer-two",
    email: "stranger@example.com",
    name: "Stranger",
    role: "customer",
  })
);

beforeEach(() => {
  vi.clearAllMocks();
  repository.findForCustomer.mockResolvedValue(null);
});

describe("returnsRouter customer ownership", () => {
  it("does not disclose a return request to another customer", async () => {
    await expect(stranger.getById({ requestId: request.id })).rejects.toThrow(
      "Return request not found"
    );
  });

  it("does not list another customer's request under their order", async () => {
    repository.listForOrder.mockResolvedValue([]);

    await expect(
      stranger.listForOrder({ orderId: request.orderId })
    ).resolves.toEqual([]);
    expect(repository.listForOrder).toHaveBeenCalledWith(
      request.orderId,
      "customer-two"
    );
  });

  it("does not let another customer acknowledge a proposal", async () => {
    acknowledge.execute.mockRejectedValue(
      new Error("Return request not found")
    );

    await expect(
      stranger.acknowledge({ requestId: request.id, proposalVersion: 1 })
    ).rejects.toThrow("Return request not found");
  });

  it("does not let another customer request an OTP", async () => {
    requestOtp.execute.mockRejectedValue(new Error("Return request not found"));

    await expect(
      stranger.requestOtp({ requestId: request.id, proposalVersion: 1 })
    ).rejects.toThrow("Return request not found");
  });

  it("does not let another customer confirm an OTP", async () => {
    confirmOtp.execute.mockRejectedValue(new Error("Return request not found"));

    await expect(
      stranger.confirmOtp({
        requestId: request.id,
        proposalVersion: 1,
        challengeId: "0ca37d2b-9af2-4d4a-ad1d-c702f3e08751",
        code: "123456",
      })
    ).rejects.toThrow("Return request not found");
  });

  it("rejects customer-supplied refund values", async () => {
    await expect(
      owner.create({
        orderId: request.orderId,
        reason: "change_of_mind",
        pickupMethod: "courier",
        lines: [
          { orderItemId: "5d61c0b6-5345-4aec-833d-cf3f2852d3d5", quantity: 1 },
        ],
        // @ts-expect-error A malicious untyped client may still send this.
        itemRefund: 999999,
        collectionFee: 0,
      })
    ).rejects.toThrow();
  });
});
