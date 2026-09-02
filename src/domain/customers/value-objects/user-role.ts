/**
 * Who may do what in the admin area.
 *
 * Pure and dependency-free, and in `domain/` for a concrete reason rather than
 * a stylistic one: these predicates used to live in
 * `server/utils/auth-helpers.ts`, which imports `@/db`. That made them
 * unusable from any client component — importing one to grey out a button
 * would have pulled Drizzle and a database connection into the browser bundle.
 * So the UI had no way to ask the question the server was answering, and the
 * only options were to duplicate the role strings or let a read-only user
 * click things that would fail.
 *
 * `auth-helpers` re-exports these, so server code keeps its existing import.
 */

export type UserRole = "customer" | "worker" | "admin" | "super_admin";

/**
 * Roles that may **change** admin-managed data.
 *
 * Uploads count as writes, which is why `lib/uploadthing.ts` asks this one.
 */
export const ADMIN_ROLES = ["admin", "super_admin"] as const;

/**
 * Roles that may **open** the admin area at all.
 *
 * `worker` is the read-only tier. It existed in the database enum, the entity
 * and the `UserRole` union for the whole life of the project and was checked
 * in exactly zero places, so it granted nothing — `admin` and `super_admin`
 * were the only roles that meant anything.
 *
 * What this does NOT buy: a worker still reads every customer's address and
 * order history, because "read-only" constrains writes, not scope. Splitting
 * catalogue work from customer data is a larger, separate change.
 */
export const ADMIN_AREA_ROLES = ["worker", "admin", "super_admin"] as const;

/** Whether a role may change admin-managed data. */
export function isAdminRole(role: UserRole | null | undefined): boolean {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role);
}

/** Whether a role may open the admin area, with or without write access. */
export function isAdminAreaRole(role: UserRole | null | undefined): boolean {
  return !!role && (ADMIN_AREA_ROLES as readonly string[]).includes(role);
}

/**
 * Whether a role can see the admin area but change nothing.
 *
 * Deliberately not `!isAdminRole(role)` — that is true for a customer too, and
 * a customer is not "read-only", they are "not here at all". The UI uses this
 * to explain a disabled control, and explaining it to someone who cannot see
 * the screen would be nonsense.
 */
export function isReadOnlyAdminRole(
  role: UserRole | null | undefined
): boolean {
  return isAdminAreaRole(role) && !isAdminRole(role);
}
