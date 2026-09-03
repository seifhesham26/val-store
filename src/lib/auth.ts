import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { db } from "@/db";
import { container } from "@/application/container";
import { userProfiles, customers, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  checkRateLimit,
  passwordResetRateLimiter,
} from "@/server/utils/rate-limiter";
import { PasswordValueObject } from "@/domain/customers/value-objects/password.value-object";
import { PhoneValueObject } from "@/domain/customers/value-objects/phone.value-object";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  // Email verification configuration
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      try {
        const emailService = container.getEmailService();
        await emailService.sendVerificationEmail(
          user.email,
          url,
          user.name || undefined
        );
      } catch (error) {
        console.error("[Auth] Failed to send verification email:", error);
      }
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },

  // Email and password auth configuration
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disabled so users can sign up without email verification
    sendResetPassword: async ({ user, url }) => {
      try {
        // Three per hour per address. Better Auth answers the request
        // identically either way, so this throttles the mail without telling a
        // stranger whether the address exists.
        const { allowed } = await checkRateLimit(
          passwordResetRateLimiter,
          `reset:${user.email.toLowerCase()}`
        );
        if (!allowed) {
          console.warn("[Auth] Password reset rate limited:", user.id);
          return;
        }

        const emailService = container.getEmailService();
        await emailService.sendPasswordResetEmail(
          user.email,
          url,
          user.name || undefined
        );
      } catch (error) {
        console.error("[Auth] Failed to send password reset email:", error);
      }
    },
  },

  // Extended user fields
  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: false,
      },
      birthday: {
        type: "string",
        required: false,
      },
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours

    /**
     * Serve the session from a short-lived signed cookie instead of querying
     * the `session` table on every request.
     *
     * Without this, every authenticated call — every cart read, every stock
     * poll — costs a database round trip before the procedure even starts. The
     * cookie is signed, so it cannot be forged.
     *
     * The number is the whole trade, because nothing consults the `session`
     * table while the cookie is live: for this long after a sign-out, a
     * revoked session, or a deleted account, requests still succeed. It was
     * five minutes. It is sixty seconds, for two reasons — it now matches
     * `ROLE_CACHE_TTL_MS` in `server/utils/auth-helpers.ts`, so revoking
     * access and demoting an admin take effect on the same timescale instead
     * of two that have to be reasoned about together; and five minutes of
     * continued admin access after a revocation is a long time, while the
     * saving over sixty seconds is one query per user per minute.
     */
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },

    /*
     * There was a `generateSessionData` here that read the role from
     * `user_profiles` and returned it to be stored on the session. It was
     * dead: the `session` table has no `role` column and none was declared in
     * `additionalFields`, so the value had nowhere to persist and was
     * discarded — after paying for the query on every sign-in.
     *
     * The role is resolved in `createContext` instead, through the short-TTL
     * cache in `server/utils/auth-helpers.ts`. Keeping it out of the session
     * also means a demotion takes effect in a minute rather than surviving in
     * a seven-day session.
     */
  },

  /**
   * Stated rather than inherited.
   *
   * The app throttles the paths it owns through Upstash — phone lookup in
   * `server/routers/auth.ts`, password reset in `sendResetPassword` above —
   * but sign-in and sign-up run inside Better Auth and were relying on
   * whatever its defaults happened to be. These are those paths written down,
   * so a version bump cannot quietly loosen them.
   */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 900, max: 10 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/forget-password": { window: 3600, max: 5 },
    },
  },

  /**
   * Server-side password policy.
   *
   * `PasswordValueObject` was written to enforce uppercase, lowercase, digit
   * and special-character rules but had zero importers - the signup form and
   * this file's own `sendResetPassword` path only ever checked length, so a
   * client that skipped the browser JS (curl, a modified build) could still
   * set a weak password. Better Auth exposes no dedicated
   * "validate this password" option: `emailAndPassword.password.hash` only
   * hands back a hasher, with no request path to scope it to signup/reset
   * and not, say, login. `hooks.before` does have that path, via
   * `ctx.path` - this is the same shape the built-in `haveIBeenPwned` plugin
   * uses to target the same two endpoints, so it is a supported extension
   * point rather than a workaround.
   *
   * `/sign-in/email` deliberately isn't checked here - rejecting a login
   * because an old, already-weak password doesn't meet a policy adopted
   * later would lock people out of their own accounts.
   */
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const plainPassword =
        ctx.path === "/sign-up/email"
          ? (ctx.body as { password?: unknown } | undefined)?.password
          : ctx.path === "/reset-password"
            ? (ctx.body as { newPassword?: unknown } | undefined)?.newPassword
            : undefined;

      if (typeof plainPassword !== "string") {
        return;
      }

      const { isValid, errors } = PasswordValueObject.validate(plainPassword);
      if (!isValid) {
        throw new APIError("BAD_REQUEST", { message: errors.join(", ") });
      }
    }),

    /**
     * Normalise the phone number to E.164 before it is stored.
     *
     * This ran in the browser only (`SignupForm.tsx`), which meant the stored
     * format depended on whether the client executed our JavaScript. Sign-in
     * by phone always normalises the identifier and then matches `user.phone`
     * **exactly**, so an account created any other way — curl, a modified
     * build, a future mobile client — stored something like `01012345678`
     * that `+201012345678` could never match. That account could never sign
     * in by phone again, silently, with no error anywhere to explain it.
     *
     * `after` rather than `before` because Better Auth's `additionalFields`
     * are validated between the two, and rewriting the body beforehand fights
     * that. Here the account exists and the column is simply corrected in
     * place — which also catches the social-login paths, where no form of
     * ours ever ran.
     *
     * An unparseable number is left exactly as given rather than rejected: it
     * is optional at signup, it is not a credential, and failing an otherwise
     * valid registration over a malformed contact detail would be a worse
     * outcome than storing it as typed.
     */
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      const signedUpUser = newSession?.user as
        | { id?: string; phone?: string | null }
        | undefined;

      const rawPhone = signedUpUser?.phone;
      if (!signedUpUser?.id || typeof rawPhone !== "string" || !rawPhone) {
        return;
      }

      const normalized = PhoneValueObject.toE164(rawPhone);
      if (!normalized || normalized === rawPhone) {
        return;
      }

      try {
        await db
          .update(user)
          .set({ phone: normalized })
          .where(eq(user.id, signedUpUser.id));
      } catch (error) {
        // Never fail an established session over a contact detail.
        console.error("[Auth] Failed to normalise phone:", error);
      }
    }),
  },

  // Social login providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID || "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
      enabled: !!process.env.FACEBOOK_CLIENT_ID,
    },
  },

  // Database hooks for custom logic after user creation
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Auto-create user_profiles entry with default "customer" role
          await db
            .insert(userProfiles)
            .values({
              userId: user.id,
              role: "customer",
            })
            .onConflictDoNothing();

          // Auto-create customer by phone (if phone provided)
          const phone = (user as { phone?: string }).phone;
          if (phone) {
            const normalizedPhone = phone.replace(/[\s-]/g, "");

            // Check if customer exists
            const [existing] = await db
              .select()
              .from(customers)
              .where(eq(customers.phone, normalizedPhone))
              .limit(1);

            if (!existing) {
              await db.insert(customers).values({
                phone: normalizedPhone,
                preferredName: user.name || null,
              });
            }
          }

          // Last, so a notification failure cannot stop a signup from
          // completing — the service swallows its own errors either way.
          await container.getNotificationService().customerRegistered({
            userId: user.id,
            name: user.name || null,
            email: user.email,
          });
        },
      },
    },
  },
});

// Export types for use in client
export type Session = typeof auth.$Infer.Session;
