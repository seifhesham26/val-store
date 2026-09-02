import { initTRPC } from "@trpc/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  AuthUser,
  getUserRole,
  requireAuth,
  requireAdmin,
  requireAdminArea,
} from "./utils/auth-helpers";

/**
 * tRPC Context
 *
 * The context used to resolve the signed-in user eagerly, on every request:
 * a Better Auth session lookup followed by a `user_profiles` query for the
 * role, in series, before the procedure ran at all. Against a database one
 * round trip away that is real time added to *every* call — including the
 * storefront catalogue reads, which are `publicProcedure` and never look at
 * `ctx.user`.
 *
 * So it is lazy now. Nothing touches auth until a procedure actually asks for
 * the user, which in practice means `protectedProcedure` and `adminProcedure`
 * ask and `publicProcedure` does not. The result is memoised per request, so a
 * batch containing several protected calls still resolves the user once.
 */
export interface TRPCContext {
  /**
   * Resolves the signed-in user, or null. Memoised: safe to call repeatedly,
   * queries at most once per request.
   */
  getUser: () => Promise<AuthUser | null>;
  /**
   * Whether anything in this request actually resolved the user.
   *
   * `false` means no procedure in the batch consulted auth at all, so the
   * response cannot contain user-scoped data. That is a stronger guarantee
   * than "the user happened to be null", and it is what makes the response
   * safe to cache publicly — see `responseMeta` in the route handler.
   */
  touchedAuth: () => boolean;
  /**
   * Headers that will be sent with the HTTP response, or null when there is no
   * HTTP response to attach them to (a server-side `createCaller`).
   *
   * Present for exactly one reason: `auth.signIn` establishes a session, and a
   * session is a `Set-Cookie`. Everything else in this router tree answers with
   * a body alone.
   */
  resHeaders: Headers | null;
}

/** The work the context used to do eagerly, now deferred until asked. */
async function resolveUser(): Promise<AuthUser | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return null;
    }

    // Note: the role deliberately still comes from `user_profiles` rather than
    // from the session. Better Auth's `generateSessionData` cannot help here —
    // the `session` table has no `role` column, so a role written there has
    // nowhere to persist. `getUserRole` is short-TTL cached instead, which
    // bounds the cost without letting a stale role outlive a demotion by more
    // than a minute.
    const role = await getUserRole(session.user.id);

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role,
    };
  } catch {
    // If session extraction fails, treat as unauthenticated.
    return null;
  }
}

/**
 * Create context for a request.
 *
 * Synchronous on purpose: building the context now costs nothing, because all
 * of the work it used to do has moved behind `getUser`.
 *
 * `resHeaders` is handed straight through from the fetch adapter. It is
 * optional so the signature stays compatible with a caller that has no HTTP
 * response to speak of.
 */
export function createContext(opts?: { resHeaders?: Headers }): TRPCContext {
  let pending: Promise<AuthUser | null> | null = null;

  return {
    getUser: () => {
      pending ??= resolveUser();
      return pending;
    },
    touchedAuth: () => pending !== null,
    resHeaders: opts?.resHeaders ?? null,
  };
}

/**
 * A context for a caller that already knows who the user is — tests, and any
 * server-side `createCaller` that has resolved the user by other means.
 *
 * `touchedAuth` reports true so a directly-constructed context is never
 * mistaken for an anonymous request by the caching layer.
 */
export function createDirectContext(user: AuthUser | null): TRPCContext {
  return {
    getUser: async () => user,
    touchedAuth: () => true,
    // No HTTP response exists for an in-process caller, and nothing reached
    // through one signs anybody in.
    resHeaders: null,
  };
}

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<TRPCContext>().create();

/**
 * Middleware for protected routes (requires authentication)
 *
 * Resolving the user here rather than in the context is the whole point: this
 * is the moment something actually needs it. Handlers below this middleware
 * keep reading `ctx.user` as a non-null `AuthUser`, exactly as before.
 */
const isAuthed = t.middleware(async ({ ctx, next }) => {
  const user = await ctx.getUser();
  requireAuth(user);
  return next({
    ctx: {
      ...ctx,
      user, // Now guaranteed to be non-null
    },
  });
});

/**
 * Middleware for reaching the admin area at all (worker, admin, super_admin).
 */
const isAdminArea = t.middleware(async ({ ctx, next }) => {
  const user = await ctx.getUser();
  requireAuth(user);
  requireAdminArea(user);
  return next({
    ctx: {
      ...ctx,
      user,
    },
  });
});

/**
 * Middleware for changing admin-managed data (admin, super_admin).
 */
const isAdminWriter = t.middleware(async ({ ctx, next }) => {
  const user = await ctx.getUser();
  requireAuth(user);
  requireAdmin(user);
  return next({
    ctx: {
      ...ctx,
      user,
    },
  });
});

/**
 * Export reusable router and procedure helpers
 */
export const router = t.router;

// Public procedure - no authentication required, and no auth queries either
export const publicProcedure = t.procedure;

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(isAuthed);

/**
 * Read access to the admin area — worker, admin, super_admin.
 *
 * Every admin **query** uses this. It keeps the name `adminProcedure` because
 * that is what 14 routers already say and renaming it would have produced a
 * 60-file diff whose only content was a rename, burying the two lines that
 * actually change who can do what.
 */
export const adminProcedure = t.procedure.use(isAdminArea);

/**
 * Write access to admin-managed data — admin, super_admin only.
 *
 * Every admin **mutation** uses this, with one deliberate exception:
 * `admin.notifications.{markAsRead,markAllAsRead,delete}` stay on
 * `adminProcedure`, because they only ever touch rows scoped to `ctx.user.id`.
 * A read-only worker still has their own notification bell, and dismissing
 * your own notification is not an edit to anything anyone else can see.
 *
 * The asymmetry to remember: a new mutation that forgets to use this one is
 * writable by a worker. There is no way to make that fail closed at the type
 * level while `adminProcedure` remains the permissive tier, so the guard is
 * the `trpc.test.ts` case asserting every admin mutation is write-gated.
 */
export const adminWriteProcedure = t.procedure.use(isAdminWriter);
