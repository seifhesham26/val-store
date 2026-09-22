import { describe, expect, it, vi } from "vitest";
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
  HashedRefundOtpService,
  type RefundOtpChallengeStore,
} from "./refund-otp.service";
import type { RefundOtpProvider } from "../interfaces/refund-otp-provider.interface";

type Challenge = {
  id: string;
  requestId: string;
  proposalVersion: number;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  invalidatedAt: Date | null;
  createdAt: Date;
};

class MemoryChallengeStore implements RefundOtpChallengeStore {
  readonly challenges: Challenge[] = [];

  async replaceActive(
    input: Omit<Challenge, "id" | "attempts" | "consumedAt" | "invalidatedAt">
  ) {
    for (const challenge of this.challenges) {
      if (
        challenge.requestId === input.requestId &&
        !challenge.consumedAt &&
        !challenge.invalidatedAt
      ) {
        challenge.invalidatedAt = input.createdAt;
      }
    }
    const challenge: Challenge = {
      id: `challenge-${this.challenges.length + 1}`,
      ...input,
      attempts: 0,
      consumedAt: null,
      invalidatedAt: null,
    };
    this.challenges.push(challenge);
    return { id: challenge.id };
  }

  async invalidate(id: string, now: Date) {
    const challenge = this.challenges.find((item) => item.id === id);
    if (challenge) challenge.invalidatedAt = now;
  }

  async verify(input: {
    id: string;
    requestId: string;
    proposalVersion: number;
    codeHash: string;
    now: Date;
    maxAttempts: number;
  }) {
    const challenge = this.challenges.find((item) => item.id === input.id);
    if (
      !challenge ||
      challenge.requestId !== input.requestId ||
      challenge.proposalVersion !== input.proposalVersion ||
      challenge.invalidatedAt ||
      challenge.consumedAt ||
      challenge.expiresAt <= input.now ||
      challenge.attempts >= input.maxAttempts
    ) {
      return { status: "invalid" as const };
    }
    if (challenge.codeHash !== input.codeHash) {
      challenge.attempts += 1;
      return { status: "incorrect" as const, attempts: challenge.attempts };
    }
    challenge.consumedAt = input.now;
    return { status: "confirmed" as const, id: challenge.id };
  }
}

const phone = "+201000000000";
const request = { requestId: "request-1", proposalVersion: 1, phone };

function setup(options?: { now?: Date; provider?: RefundOtpProvider }) {
  let now = options?.now ?? new Date("2026-09-21T12:00:00.000Z");
  const store = new MemoryChallengeStore();
  const provider = options?.provider ?? {
    send: vi.fn().mockResolvedValue(undefined),
  };
  const service = new HashedRefundOtpService({
    store,
    provider,
    secret: "test-secret",
    now: () => now,
    generateCode: () => "123456",
  });
  return { service, store, provider, setNow: (value: Date) => (now = value) };
}

describe("HashedRefundOtpService", () => {
  it("delivers a one-minute code and confirms the correct code once", async () => {
    const { service, provider } = setup();
    const challenge = await service.request(request);

    expect(provider.send).toHaveBeenCalledWith({
      phone,
      requestId: request.requestId,
      code: "123456",
    });
    await expect(
      service.verify({ ...request, challengeId: challenge.id, code: "123456" })
    ).resolves.toEqual({ id: challenge.id });
    await expect(
      service.verify({ ...request, challengeId: challenge.id, code: "123456" })
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
  });

  it("increments wrong attempts and locks the fifth failed attempt", async () => {
    const { service, store } = setup();
    const challenge = await service.request(request);
    for (let attempt = 1; attempt <= OTP_MAX_ATTEMPTS; attempt += 1) {
      await expect(
        service.verify({
          ...request,
          challengeId: challenge.id,
          code: "000000",
        })
      ).rejects.toMatchObject({ code: "OTP_INVALID" });
      expect(store.challenges[0]?.attempts).toBe(attempt);
    }
    await expect(
      service.verify({ ...request, challengeId: challenge.id, code: "123456" })
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
  });

  it("expires exactly at sixty seconds", async () => {
    const { service, setNow } = setup();
    const challenge = await service.request(request);
    setNow(new Date("2026-09-21T12:01:00.000Z"));
    await expect(
      service.verify({ ...request, challengeId: challenge.id, code: "123456" })
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
  });

  it("invalidates the previous challenge when a code is resent", async () => {
    const { service } = setup();
    const first = await service.request(request);
    const second = await service.request(request);
    await expect(
      service.verify({ ...request, challengeId: first.id, code: "123456" })
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
    await expect(
      service.verify({ ...request, challengeId: second.id, code: "123456" })
    ).resolves.toEqual({ id: second.id });
  });

  it("fails closed and invalidates delivery that cannot be verified", async () => {
    const provider: RefundOtpProvider = {
      send: vi.fn().mockRejectedValue(new Error("not configured")),
    };
    const { service, store } = setup({ provider });
    await expect(service.request(request)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
    expect(store.challenges[0]?.invalidatedAt).toBeInstanceOf(Date);
  });

  it("keeps OTP lifetime and attempt limits hardcoded", () => {
    expect(OTP_TTL_SECONDS).toBe(60);
    expect(OTP_MAX_ATTEMPTS).toBe(5);
  });
});
