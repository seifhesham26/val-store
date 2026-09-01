import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The context is the thing that made every request pay for auth, so these
 * tests are about two properties:
 *
 *   - it does no auth work until something asks (the performance claim), and
 *   - `touchedAuth()` reports that honestly (the safety claim, because the
 *     HTTP cache policy trusts it to decide whether a response is shareable).
 *
 * Both dependencies are mocked with call counters, so "did this touch auth?"
 * is observed rather than assumed.
 */
const sessionCalls = { count: 0 };
const roleCalls = { count: 0 };
let currentSession: { user: { id: string; email: string; name: string } } | null =
  null;
let sessionThrows = false;

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: async () => {
        sessionCalls.count++;
        if (sessionThrows) throw new Error("session lookup failed");
        return currentSession;
      },
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

// Mocked outright rather than partially: the real module imports `@/db`,
// which throws without DATABASE_URL, and the unit suite must never need one.
vi.mock("./utils/auth-helpers", () => ({
  getUserRole: async () => {
    roleCalls.count++;
    return "customer" as const;
  },
  requireAuth: (user: unknown) => {
    if (!user) throw new Error("UNAUTHORIZED");
  },
  requireAdmin: () => {},
  isAdmin: () => false,
  requireRole: () => {},
  invalidateUserRole: () => {},
  clearRoleCache: () => {},
}));

const { createContext, createDirectContext } = await import("./trpc");

const SESSION = {
  user: { id: "u1", email: "a@b.c", name: "Ada" },
};

beforeEach(() => {
  sessionCalls.count = 0;
  roleCalls.count = 0;
  currentSession = SESSION;
  sessionThrows = false;
});

describe("createContext is lazy", () => {
  it("does no auth work when it is created", () => {
    // This is the whole point: a public catalogue request builds a context and
    // never pays for a session lookup or a role query.
    createContext();
    expect(sessionCalls.count).toBe(0);
    expect(roleCalls.count).toBe(0);
  });

  it("reports that it has not touched auth", () => {
    expect(createContext().touchedAuth()).toBe(false);
  });

  it("resolves the user only when asked", async () => {
    const ctx = createContext();
    await ctx.getUser();
    expect(sessionCalls.count).toBe(1);
    expect(roleCalls.count).toBe(1);
  });

  it("reports touched auth once asked", async () => {
    const ctx = createContext();
    await ctx.getUser();
    expect(ctx.touchedAuth()).toBe(true);
  });

  it("marks auth as touched immediately, without waiting for the promise", () => {
    // The cache policy reads this after the response is built; it must not
    // depend on the resolution having completed.
    const ctx = createContext();
    void ctx.getUser();
    expect(ctx.touchedAuth()).toBe(true);
  });
});

describe("the resolved user is memoised per request", () => {
  it("queries once however many procedures ask", async () => {
    // A batch of several protected calls shares one context, and must not
    // re-resolve the user for each.
    const ctx = createContext();
    await Promise.all([ctx.getUser(), ctx.getUser(), ctx.getUser()]);
    expect(sessionCalls.count).toBe(1);
    expect(roleCalls.count).toBe(1);
  });

  it("returns the same value each time", async () => {
    const ctx = createContext();
    const [a, b] = await Promise.all([ctx.getUser(), ctx.getUser()]);
    expect(a).toEqual(b);
    expect(a?.id).toBe("u1");
  });

  it("memoises a null result too", async () => {
    currentSession = null;
    const ctx = createContext();

    await expect(ctx.getUser()).resolves.toBeNull();
    await expect(ctx.getUser()).resolves.toBeNull();

    expect(sessionCalls.count).toBe(1);
  });

  it("does not query for the role when there is no session", async () => {
    currentSession = null;
    await createContext().getUser();
    expect(roleCalls.count).toBe(0);
  });
});

describe("a failing session lookup is treated as anonymous", () => {
  it("resolves to null rather than throwing", async () => {
    sessionThrows = true;
    await expect(createContext().getUser()).resolves.toBeNull();
  });

  it("still counts as having touched auth", async () => {
    // Failing open here would be the dangerous direction: a request that tried
    // to resolve a user and failed must not be cached as anonymous.
    sessionThrows = true;
    const ctx = createContext();
    await ctx.getUser();
    expect(ctx.touchedAuth()).toBe(true);
  });
});

describe("createDirectContext", () => {
  it("returns the user it was given without any lookup", async () => {
    const user = {
      id: "u9",
      email: "x@y.z",
      name: "Grace",
      role: "admin" as const,
    };
    const ctx = createDirectContext(user);

    await expect(ctx.getUser()).resolves.toEqual(user);
    expect(sessionCalls.count).toBe(0);
  });

  it("supports an anonymous caller", async () => {
    await expect(createDirectContext(null).getUser()).resolves.toBeNull();
  });

  it("always reports touched auth", () => {
    // A directly-constructed context has no HTTP response to cache, but
    // reporting true keeps it from ever being mistaken for an anonymous
    // request by the caching layer.
    expect(createDirectContext(null).touchedAuth()).toBe(true);
  });
});
