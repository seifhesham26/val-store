import { createHmac, randomInt } from "node:crypto";

import type { RefundOtpProvider } from "../interfaces/refund-otp-provider.interface";

export const OTP_TTL_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

export class RefundOtpError extends Error {
  constructor(public readonly code: "OTP_INVALID" | "PROVIDER_UNAVAILABLE") {
    super(
      code === "PROVIDER_UNAVAILABLE"
        ? "Refund OTP provider unavailable"
        : "Invalid or expired OTP"
    );
    this.name = "RefundOtpError";
  }
}

/** Atomic persistence operations for hashed challenges. */
export interface RefundOtpChallengeStore {
  replaceActive(input: {
    requestId: string;
    proposalVersion: number;
    codeHash: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<{ id: string }>;
  invalidate(id: string, now: Date): Promise<void>;
  verify(input: {
    id: string;
    requestId: string;
    proposalVersion: number;
    codeHash: string;
    now: Date;
    maxAttempts: number;
  }): Promise<
    | { status: "confirmed"; id: string }
    | { status: "incorrect"; attempts: number }
    | { status: "invalid" }
  >;
}

/** Boundary for the customer-confirmation challenge. */
export interface RefundOtpService {
  request(input: {
    requestId: string;
    proposalVersion: number;
    phone: string;
  }): Promise<{ id: string }>;
  verify(input: {
    requestId: string;
    proposalVersion: number;
    challengeId: string;
    code: string;
  }): Promise<{ id: string }>;
}

/**
 * Creates only hashed challenges. Plaintext codes cross this class solely to
 * the delivery provider and are never returned or persisted.
 */
export class HashedRefundOtpService implements RefundOtpService {
  constructor(
    private readonly deps: {
      store: RefundOtpChallengeStore;
      provider: RefundOtpProvider;
      secret: string;
      now?: () => Date;
      generateCode?: () => string;
    }
  ) {}

  async request(input: {
    requestId: string;
    proposalVersion: number;
    phone: string;
  }): Promise<{ id: string }> {
    if (!this.deps.secret) throw new RefundOtpError("PROVIDER_UNAVAILABLE");
    const now = this.now();
    const code = this.generateCode();
    const challenge = await this.deps.store.replaceActive({
      requestId: input.requestId,
      proposalVersion: input.proposalVersion,
      codeHash: this.hash(input.requestId, input.proposalVersion, code),
      expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1_000),
      createdAt: now,
    });

    try {
      await this.deps.provider.send({
        phone: input.phone,
        code,
        requestId: input.requestId,
      });
    } catch {
      // A code whose delivery was not verified must never be usable.
      await this.deps.store.invalidate(challenge.id, now);
      throw new RefundOtpError("PROVIDER_UNAVAILABLE");
    }
    return challenge;
  }

  async verify(input: {
    requestId: string;
    proposalVersion: number;
    challengeId: string;
    code: string;
  }): Promise<{ id: string }> {
    const result = await this.deps.store.verify({
      id: input.challengeId,
      requestId: input.requestId,
      proposalVersion: input.proposalVersion,
      codeHash: this.hash(input.requestId, input.proposalVersion, input.code),
      now: this.now(),
      maxAttempts: OTP_MAX_ATTEMPTS,
    });
    if (result.status !== "confirmed") throw new RefundOtpError("OTP_INVALID");
    return { id: result.id };
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  private generateCode(): string {
    return (
      this.deps.generateCode?.() ??
      randomInt(0, 1_000_000).toString().padStart(6, "0")
    );
  }

  private hash(
    requestId: string,
    proposalVersion: number,
    code: string
  ): string {
    return createHmac("sha256", this.deps.secret)
      .update(`${requestId}:${proposalVersion}:${code}`)
      .digest("hex");
  }
}

/** A missing WhatsApp integration is a deliberate fail-closed boundary. */
export class UnavailableRefundOtpService implements RefundOtpService {
  async request(
    _input: Parameters<RefundOtpService["request"]>[0]
  ): Promise<{ id: string }> {
    void _input;
    throw new RefundOtpError("PROVIDER_UNAVAILABLE");
  }

  async verify(
    _input: Parameters<RefundOtpService["verify"]>[0]
  ): Promise<{ id: string }> {
    void _input;
    throw new RefundOtpError("PROVIDER_UNAVAILABLE");
  }
}
