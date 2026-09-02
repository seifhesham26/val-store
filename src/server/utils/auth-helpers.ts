/**
 * Authentication Helpers
 *
 * Utility functions for authentication and authorization in tRPC context.
 */

import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * The role predicates live in `domain/` and are re-exported here.
 *
 * They are pure, and this module imports `@/db` — so leaving them here made
 * them unreachable from any client component. `uploadthing.ts` still asks
 * `isAdminRole` (an upload is a write); the tRPC middlewares below pair it
 * with `isAdminAreaRole`.
 *
 * The pairing is the whole model. `adminProcedure` gates on the wider list and
 * `adminWriteProcedure` on the narrower one, so a *new* admin procedure
 * defaults to the read tier — which means a new mutation that forgets
 * `adminWriteProcedure` is writable by a worker. That cannot be caught by the
 * type system, so `src/server/admin-write-gating.test.ts` catches it instead.
 */
export {
  isAdminRole,
  isAdminAreaRole,
  isReadOnlyAdminRole,
} from "@/domain/customers/value-objects/user-role";

import {
  isAdminRole,
  isAdminAreaRole,
  type UserRole,
} from "@/domain/customers/value-objects/user-role";

export type { UserRole };

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

/**
 * Check if a user has admin privileges
 */
export function isAdmin(user: AuthUser): boolean {
  return isAdminRole(user.role);
}

/**
 * How long a resolved role is reused before being re-read from the database.
 *
 * Every authenticated request needs the role, and the query is one network
 * round trip to a database that is not local — so without this it is a fixed
 * tax on every call. A minute is short enough that a demotion takes effect
 * promptly and long enough that a customer clicking around pays for it once.
 *
 * The staleness this buys is bounded and deliberate: for up to a minute after
 * a role changes, an already-signed-in user may still be evaluated under the
 * old one. Roles are currently only ever changed by `scripts/set-admin.ts`,
 * which runs out of process; `invalidateUserRole` exists so that an in-process
 * writer can drop the entry immediately, and the profile repository calls it.
 */
const ROLE_CACHE_TTL_MS = 60_000;

/** Bounded so a long-running process cannot accumulate entries indefinitely. */
const ROLE_CACHE_MAX_ENTRIES = 5_000;

const roleCache = new Map<string, { role: UserRole; expiresAt: number }>();

/** Drop a cached role, so the next request re-reads it. */
export function invalidateUserRole(userId: string): void {
  roleCache.delete(userId);
}

/** Clear the whole cache. Used by tests. */
export function clearRoleCache(): void {
  roleCache.clear();
}

/**
 * Get user role from user_profiles table
 * Better Auth stores basic user info, but role is in our user_profiles table
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  const cached = roleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.role;
  }

  const [profile] = await db
    .select({ role: userProfiles.role })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  // If no profile exists, default to customer
  const role = (profile?.role as UserRole) ?? "customer";

  // Evict wholesale rather than tracking recency: this is a latency cache, not
  // a working set, and refilling it costs one query per active user.
  if (roleCache.size >= ROLE_CACHE_MAX_ENTRIES) {
    roleCache.clear();
  }
  roleCache.set(userId, { role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });

  return role;
}

/**
 * Require user to be authenticated
 * Throws UNAUTHORIZED if no user in context
 */
export function requireAuth(user: AuthUser | null): asserts user is AuthUser {
  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }
}

/**
 * Require user to have one of the specified roles
 * Throws FORBIDDEN if user doesn't have required role
 */
export function requireRole(user: AuthUser, roles: UserRole[]): void {
  if (!roles.includes(user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to access this resource",
    });
  }
}

/**
 * Require write access to admin-managed data (admin or super_admin).
 *
 * The message names the reason rather than the role, because the person
 * hitting this is most often a worker who can see the screen they just tried
 * to submit — "you do not have permission" alone reads like a bug to them.
 */
export function requireAdmin(user: AuthUser): void {
  if (!isAdminRole(user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account has read-only access to the admin area",
    });
  }
}

/** Require permission to open the admin area at all (worker and above). */
export function requireAdminArea(user: AuthUser): void {
  if (!isAdminAreaRole(user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to access this resource",
    });
  }
}
