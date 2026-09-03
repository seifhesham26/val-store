/**
 * Auth Router
 *
 * One procedure: sign in with an email address or a phone number.
 *
 * This replaces `getEmailByPhone`, which took a phone number and returned the
 * email address of the account using it. That was the phone→email step of the
 * login form, and it was a `publicProcedure` — so it answered for anybody, not
 * just somebody about to sign in. Egyptian mobile numbers are a small
 * enumerable keyspace (`+201[0125]XXXXXXXX`), and the response distinguished
 * "there is an account" from "there is not", which is precisely the oracle the
 * rest of this codebase is careful not to be: `sendResetPassword` answers
 * identically for a registered and an unregistered address on purpose.
 *
 * So the lookup moved inside the sign-in itself. The email is resolved here,
 * used here, and never leaves the server. A caller learns exactly one bit —
 * whether the credentials they supplied work — which is the bit they were
 * always entitled to.
 */

import { publicProcedure, router } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { container } from "@/application/container";
import { PhoneValueObject } from "@/domain/customers/value-objects/phone.value-object";
import {
  authRateLimiter,
  enforceRateLimit,
  getClientIp,
} from "../utils/rate-limiter";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * The only failure message this router produces.
 *
 * Every way a sign-in can fail — no such phone, no such email, wrong password,
 * an unparseable identifier — answers with this. Distinguishing them is what
 * turns a login form into an account-existence oracle, and it buys the person
 * signing in nothing: they cannot act differently on "no account" than on
 * "wrong password" anyway.
 */
const GENERIC_FAILURE = "Invalid credentials. Please check and try again.";

function unauthorized(): TRPCError {
  return new TRPCError({ code: "UNAUTHORIZED", message: GENERIC_FAILURE });
}

/** Shown whichever of the two budgets below is exhausted. */
const RATE_LIMITED = "Too many attempts. Please try again later.";

/**
 * How many accounts on one phone number a sign-in will try.
 *
 * Each candidate costs a full password verification, which is deliberately
 * expensive, so this is the ceiling on what one request can spend. Two or three
 * accounts per number is the real case this serves — a family sharing a phone,
 * or somebody who re-registered. Beyond that, capping is the right answer.
 */
const MAX_ACCOUNTS_PER_PHONE = 5;

export const authRouter = router({
  /**
   * Sign in with an email address or a phone number.
   *
   * Returns `{ success: true }` and nothing else. The session arrives as the
   * `Set-Cookie` that Better Auth issues, forwarded onto this request's
   * response — which is why the context carries `resHeaders`.
   */
  signIn: publicProcedure
    .input(
      z.object({
        // An email address or a phone number; the server decides which.
        // Bounded because it is used to build a rate-limit key.
        identifier: z.string().trim().min(1).max(320),
        // Bounded to keep an enormous body from reaching the password hasher,
        // which is deliberately expensive. Far above any real password.
        password: z.string().min(1).max(512),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const reqHeaders = await headers();

      // Two limits, because they stop different attacks. The IP limit slows a
      // single host walking the keyspace; the identifier limit slows a
      // distributed one grinding a single account, which no per-IP budget
      // catches. Both no-op silently without UPSTASH_* configured, so local
      // development is unaffected.
      const ip = getClientIp(reqHeaders);
      await enforceRateLimit(authRateLimiter, `signin:ip:${ip}`, RATE_LIMITED);

      const isPhone = PhoneValueObject.looksLikePhone(input.identifier);

      // Normalised before it becomes a rate-limit key, so the same account
      // cannot be given a fresh budget per spelling — `01012345678`,
      // `+20 101 234 5678` and `010-1234-5678` are one identifier here.
      const normalized = isPhone
        ? PhoneValueObject.toE164(input.identifier)
        : input.identifier.toLowerCase();

      // An identifier that will not normalise cannot match an account. It is
      // still charged against the limiter above, so probing with junk is not a
      // free way to stay under it.
      if (!normalized) {
        throw unauthorized();
      }

      await enforceRateLimit(
        authRateLimiter,
        `signin:id:${normalized}`,
        RATE_LIMITED
      );

      // Every account on this number, not one arbitrary row.
      //
      // `user.phone` has no unique constraint and is not meant to — one human
      // may hold several accounts on one number, which is what the phone-keyed
      // `customers` table models. The lookup used to take a single row with
      // `limit(1)` and no ordering, so with two such accounts the one you
      // signed into was arbitrary, could differ between attempts, and the
      // other account could never sign in by phone at all.
      //
      // The password is what disambiguates: each candidate is tried in turn
      // and the first whose credentials match wins. Capped because password
      // hashing is deliberately expensive, and one number carrying more than a
      // handful of accounts is not a case worth serving at that cost.
      const candidates: string[] = isPhone
        ? (
            await container
              .getUserLookupRepository()
              .findAccountsByPhone(normalized, MAX_ACCOUNTS_PER_PHONE)
          ).map((row) => row.email)
        : [normalized];

      // An unregistered phone number and a wrong password are indistinguishable
      // from out here — the whole point of routing the lookup through sign-in.
      if (candidates.length === 0) {
        throw unauthorized();
      }

      // `auth.api.*` bypasses the Better Auth handler, and with it the
      // `rateLimit.customRules` entry for `/sign-in/email` — which is why the
      // two Upstash limits above are not belt-and-braces but the only throttle
      // on this path.
      let result: { headers: Headers } | null = null;

      for (const email of candidates) {
        try {
          result = await auth.api.signInEmail({
            body: { email, password: input.password },
            headers: reqHeaders,
            returnHeaders: true,
          });
          break;
        } catch {
          // Better Auth throws APIError for bad credentials, an unverified
          // address, and anything else it refuses. All of it collapses to one
          // answer — but only after every candidate has been tried, since a
          // failure here may simply mean "not this one of your accounts".
        }
      }

      if (!result) {
        throw unauthorized();
      }

      // The session itself. Without this the sign-in succeeds on the server and
      // the browser never learns about it.
      const setCookie = result.headers.getSetCookie();
      if (ctx.resHeaders) {
        for (const cookie of setCookie) {
          ctx.resHeaders.append("set-cookie", cookie);
        }
      }

      return { success: true as const };
    }),
});
