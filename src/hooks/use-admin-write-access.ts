"use client";

import { trpc } from "@/lib/trpc";
import {
  isAdminRole,
  isReadOnlyAdminRole,
  type UserRole,
} from "@/domain/customers/value-objects/user-role";

/**
 * Whether the signed-in admin may change anything.
 *
 * Reads the role from `public.user.getSession`, which the admin header already
 * queries — so on an admin screen this is served from the React Query cache
 * rather than costing a request of its own.
 *
 * This is a **UI affordance, not a security boundary**. The boundary is
 * `adminWriteProcedure` on the server, which rejects a worker's mutation
 * whatever the browser believes. This exists so a read-only user is told why a
 * control is unavailable instead of discovering it from a failed request.
 *
 * `isPending` matters: until the role resolves, `canWrite` is false. Callers
 * disabling a control should prefer showing it disabled during that window
 * rather than hiding it, or the admin UI visibly reshuffles on every load.
 */
export function useAdminWriteAccess(): {
  canWrite: boolean;
  isReadOnly: boolean;
  isPending: boolean;
  role: UserRole | null;
} {
  const { data, isPending } = trpc.public.user.getSession.useQuery();
  const role = (data?.role as UserRole | undefined) ?? null;

  return {
    canWrite: isAdminRole(role),
    isReadOnly: isReadOnlyAdminRole(role),
    isPending,
    role,
  };
}
