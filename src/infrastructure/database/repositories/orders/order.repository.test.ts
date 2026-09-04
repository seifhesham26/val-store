/**
 * DrizzleOrderRepository — unit coverage for the two audit fixes that are
 * pure logic rather than SQL behaviour (the rest of this repository is
 * covered by `order.repository.integration.test.ts` against a real
 * database).
 *
 * `@/db` is mocked purely so the module can be imported at all — `db` is a
 * live Postgres client constructed at import time, and this file never
 * exercises it. Private methods are reached via bracket access, the same
 * escape hatch `auth-helpers.test.ts` uses for the same reason.
 */

import { describe, it, expect, vi } from "vitest";
import { SQL } from "drizzle-orm";

vi.mock("@/db", () => ({ db: {} }));

const { DrizzleOrderRepository } = await import("./order.repository");

type RepoInternals = {
  resolveRestockQuantity(
    remaining: number,
    requested: number | undefined
  ): number;
  buildFiltersConditions(filters?: Record<string, unknown>): unknown[];
};

const repo = new DrizzleOrderRepository() as unknown as RepoInternals;

/**
 * Finding #14: cancelling an order after a partial return restocked
 * `item.quantity` — the full ordered amount — with no subtraction of what a
 * prior return had already put back, double-restocking those units.
 */
describe("resolveRestockQuantity", () => {
  it("restocks the full remaining quantity when nothing was returned yet", () => {
    expect(repo.resolveRestockQuantity(5, undefined)).toBe(5);
  });

  it("subtracts what a partial return already restocked (the bug)", () => {
    // 5 ordered, 2 already returned and restocked — cancelling must put back
    // only the 3 that are still out, not all 5.
    expect(repo.resolveRestockQuantity(3, undefined)).toBe(3);
  });

  it("restocks nothing once every unit has already come back", () => {
    expect(repo.resolveRestockQuantity(0, undefined)).toBe(0);
  });

  it("caps an explicit restock request at what remains", () => {
    // An admin's explicit restock list is validated against the full ordered
    // quantity elsewhere (`validateRestock`), not against what a prior return
    // already restocked — so this is the second line of defence.
    expect(repo.resolveRestockQuantity(3, 5)).toBe(3);
  });

  it("honours an explicit request smaller than what remains", () => {
    expect(repo.resolveRestockQuantity(3, 1)).toBe(1);
  });

  it("passes through a zero explicit request", () => {
    // An order line the caller deliberately left out of the restock list
    // (a damaged return) — `Map.get(...) ?? 0` upstream — must restock
    // nothing, not fall back to "remaining".
    expect(repo.resolveRestockQuantity(3, 0)).toBe(0);
  });
});

/**
 * Finding #17: the admin `minTotal`/`maxTotal` order filter was accepted by
 * the router and dropped by the use case before it ever reached here, and
 * this method never implemented the (differently named) filter at all — an
 * admin's "total over 5000" filter silently returned every order.
 */
describe("buildFiltersConditions — minTotal/maxTotal", () => {
  it("adds no predicate when neither bound is given", () => {
    expect(repo.buildFiltersConditions({}).length).toBe(0);
  });

  it("adds one predicate for a lone minTotal", () => {
    const conditions = repo.buildFiltersConditions({ minTotal: 100 });
    expect(conditions.length).toBe(1);
    expect(conditions[0]).toBeInstanceOf(SQL);
  });

  it("adds one predicate for a lone maxTotal", () => {
    const conditions = repo.buildFiltersConditions({ maxTotal: 500 });
    expect(conditions.length).toBe(1);
    expect(conditions[0]).toBeInstanceOf(SQL);
  });

  it("adds both predicates when the filter is a range", () => {
    const conditions = repo.buildFiltersConditions({
      minTotal: 100,
      maxTotal: 500,
    });
    expect(conditions.length).toBe(2);
  });

  it("treats a zero minTotal as a real bound, not a missing one", () => {
    // `!== undefined`, not truthiness — a merchant filtering "0 and up" is a
    // real (if odd) request, and `0` must not be treated as "no filter".
    expect(repo.buildFiltersConditions({ minTotal: 0 }).length).toBe(1);
  });
});
