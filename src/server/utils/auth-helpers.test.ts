import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The role cache sits on the critical path of every authenticated request, so
 * what matters is that it (a) actually saves the query, (b) expires, and
 * (c) can be dropped the moment a write makes it wrong.
 *
 * The database is mocked to a counting stub so "did this query?" is directly
 * observable rather than inferred from timing.
 */
const selectCalls = { count: 0 };
let nextRole = "customer";

vi.mock("@/db", () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => [{ role: nextRole }],
  };
  return {
    db: {
      select: () => {
        selectCalls.count++;
        return chain;
      },
    },
  };
});

const {
  getUserRole,
  invalidateUserRole,
  clearRoleCache,
  isAdminRole,
  isAdmin,
} = await import("./auth-helpers");

type UserRole = "customer" | "worker" | "admin" | "super_admin";

const USER = "user-1";
const OTHER = "user-2";

beforeEach(() => {
  clearRoleCache();
  selectCalls.count = 0;
  nextRole = "customer";
  vi.useRealTimers();
});

describe("getUserRole", () => {
  it("returns the stored role", async () => {
    nextRole = "admin";
    await expect(getUserRole(USER)).resolves.toBe("admin");
  });

  it("queries the database on a miss", async () => {
    await getUserRole(USER);
    expect(selectCalls.count).toBe(1);
  });

  it("does not query again within the TTL", async () => {
    // The whole point: a customer clicking around pays for this once, not once
    // per request.
    await getUserRole(USER);
    await getUserRole(USER);
    await getUserRole(USER);
    expect(selectCalls.count).toBe(1);
  });

  it("caches per user rather than globally", async () => {
    nextRole = "admin";
    await getUserRole(USER);
    nextRole = "customer";
    const other = await getUserRole(OTHER);

    expect(other).toBe("customer");
    expect(selectCalls.count).toBe(2);
  });

  it("re-reads once the TTL has passed", async () => {
    vi.useFakeTimers();
    nextRole = "admin";
    await expect(getUserRole(USER)).resolves.toBe("admin");

    // A demotion that happens out of process — which is how roles actually
    // change here, via scripts/set-admin.ts — must not be cached forever.
    nextRole = "customer";
    vi.advanceTimersByTime(61_000);

    await expect(getUserRole(USER)).resolves.toBe("customer");
    expect(selectCalls.count).toBe(2);
  });

  it("still serves the cached value just before the TTL expires", async () => {
    vi.useFakeTimers();
    await getUserRole(USER);
    vi.advanceTimersByTime(59_000);
    await getUserRole(USER);
    expect(selectCalls.count).toBe(1);
  });

  it("defaults to customer when no profile row exists", async () => {
    nextRole = undefined as unknown as string;
    await expect(getUserRole(USER)).resolves.toBe("customer");
  });
});

describe("invalidateUserRole", () => {
  it("forces the next read to hit the database", async () => {
    nextRole = "customer";
    await getUserRole(USER);

    // A write happened. Waiting out the TTL would leave the old role in place
    // for up to a minute, which is exactly what the repository avoids.
    nextRole = "admin";
    invalidateUserRole(USER);

    await expect(getUserRole(USER)).resolves.toBe("admin");
    expect(selectCalls.count).toBe(2);
  });

  it("only drops the user it names", async () => {
    await getUserRole(USER);
    await getUserRole(OTHER);
    expect(selectCalls.count).toBe(2);

    invalidateUserRole(USER);
    await getUserRole(OTHER);

    expect(selectCalls.count).toBe(2);
  });

  it("is harmless for a user that was never cached", () => {
    expect(() => invalidateUserRole("nobody")).not.toThrow();
  });
});

/**
 * The admin predicate. `uploadthing.ts` used to hardcode these two role
 * strings against a session field that does not exist, so the gate rejected
 * everyone; the predicate lives here now and both callers share it.
 */
describe("isAdminRole", () => {
  it("accepts admin and super_admin", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(true);
  });

  it("rejects customer and worker", () => {
    expect(isAdminRole("customer")).toBe(false);
    expect(isAdminRole("worker")).toBe(false);
  });

  it("agrees with isAdmin for the same role", () => {
    const roles: UserRole[] = ["customer", "worker", "admin", "super_admin"];
    for (const role of roles) {
      expect(isAdmin({ id: "u", email: "e", name: null, role })).toBe(
        isAdminRole(role)
      );
    }
  });
});
