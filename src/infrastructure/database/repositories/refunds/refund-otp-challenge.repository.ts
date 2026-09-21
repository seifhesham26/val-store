import { db } from "@/db";
import { returnOtpChallenges } from "@/db/schema";
import { and, eq, isNull, lt, ne, sql } from "drizzle-orm";

import type { RefundOtpChallengeStore } from "@/application/refunds/refund-otp.service";

/** Postgres-backed, guarded OTP challenge transitions using the database clock. */
export class DrizzleRefundOtpChallengeRepository implements RefundOtpChallengeStore {
  async replaceActive(input: {
    requestId: string;
    proposalVersion: number;
    codeHash: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<{ id: string }> {
    return db.transaction(async (tx) => {
      await tx
        .update(returnOtpChallenges)
        .set({ invalidatedAt: sql`CURRENT_TIMESTAMP` })
        .where(
          and(
            eq(returnOtpChallenges.requestId, input.requestId),
            isNull(returnOtpChallenges.consumedAt),
            isNull(returnOtpChallenges.invalidatedAt)
          )
        );
      const [challenge] = await tx
        .insert(returnOtpChallenges)
        .values({
          requestId: input.requestId,
          proposalVersion: input.proposalVersion,
          codeHash: input.codeHash,
          // The expiry authority is Postgres rather than an application host
          // clock, so a skewed web process cannot extend a challenge.
          expiresAt: sql`CURRENT_TIMESTAMP + INTERVAL '60 seconds'`,
          createdAt: input.createdAt,
        })
        .returning({ id: returnOtpChallenges.id });
      if (!challenge) throw new Error("Could not create refund OTP challenge");
      return challenge;
    });
  }

  async invalidate(id: string, now: Date): Promise<void> {
    void now;
    await db
      .update(returnOtpChallenges)
      .set({ invalidatedAt: sql`CURRENT_TIMESTAMP` })
      .where(
        and(
          eq(returnOtpChallenges.id, id),
          isNull(returnOtpChallenges.consumedAt)
        )
      );
  }

  async verify(input: {
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
  > {
    void input.now;
    const active = and(
      eq(returnOtpChallenges.id, input.id),
      eq(returnOtpChallenges.requestId, input.requestId),
      eq(returnOtpChallenges.proposalVersion, input.proposalVersion),
      isNull(returnOtpChallenges.consumedAt),
      isNull(returnOtpChallenges.invalidatedAt),
      sql`${returnOtpChallenges.expiresAt} > CURRENT_TIMESTAMP`,
      lt(returnOtpChallenges.attempts, input.maxAttempts)
    );
    const [confirmed] = await db
      .update(returnOtpChallenges)
      .set({ consumedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(active, eq(returnOtpChallenges.codeHash, input.codeHash)))
      .returning({ id: returnOtpChallenges.id });
    if (confirmed) return { status: "confirmed", id: confirmed.id };

    const [incorrect] = await db
      .update(returnOtpChallenges)
      .set({ attempts: sql`${returnOtpChallenges.attempts} + 1` })
      .where(and(active, ne(returnOtpChallenges.codeHash, input.codeHash)))
      .returning({ attempts: returnOtpChallenges.attempts });
    if (incorrect) return { status: "incorrect", attempts: incorrect.attempts };
    return { status: "invalid" };
  }
}
