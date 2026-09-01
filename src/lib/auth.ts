import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { container } from "@/application/container";
import { userProfiles, customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  checkRateLimit,
  passwordResetRateLimiter,
} from "@/server/utils/rate-limiter";

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
     * cookie is signed, so it cannot be forged; five minutes bounds how long a
     * revoked session can keep working, which is the trade being made.
     */
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
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
