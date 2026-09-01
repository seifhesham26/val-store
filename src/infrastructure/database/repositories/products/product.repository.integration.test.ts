/**
 * Product repository — query-shape integration tests.
 *
 * These exist because of the performance work: filtering and pagination moved
 * out of JavaScript and into SQL, and nothing in the unit suite can tell you
 * whether the SQL means the same thing the JavaScript did. Each test compares
 * the new query against the behaviour it replaced, on real data.
 *
 * Read-only. Nothing here writes, so it is safe against a live database.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DrizzleProductRepository } from "./product.repository";
import { client } from "@/db";
import type { ProductEntity } from "@/domain/products/entities/product.entity";

const repo = new DrizzleProductRepository();

/** Every active product, unpaginated — the baseline the old code produced. */
let allActive: ProductEntity[] = [];

beforeAll(async () => {
  allActive = await repo.findAll({ isActive: true });
  console.log(
    `[products] baseline: ${allActive.length} active products, ` +
      `${allActive.filter((p) => p.salePrice !== null && p.salePrice < p.basePrice).length} on sale`
  );
});

afterAll(async () => {
  await client.end({ timeout: 5 });
});

describe("pagination is done in SQL and covers the set exactly", () => {
  it("returns at most `limit` rows", async () => {
    const page = await repo.findAll({ isActive: true, limit: 5, offset: 0 });
    expect(page.length).toBeLessThanOrEqual(5);
  });

  it("returns disjoint pages", async () => {
    const limit = 5;
    const [first, second] = await Promise.all([
      repo.findAll({ isActive: true, limit, offset: 0 }),
      repo.findAll({ isActive: true, limit, offset: limit }),
    ]);

    const overlap = first.filter((p) => second.some((q) => q.id === p.id));
    console.log(
      `[products] page1=${first.length} page2=${second.length} overlap=${overlap.length}`
    );
    expect(overlap).toEqual([]);
  });

  it("walks the whole set without gaps or repeats", async () => {
    // The property that matters for infinite scroll: paging through must yield
    // every product exactly once.
    const limit = 5;
    const seen: string[] = [];
    for (let offset = 0; offset < allActive.length; offset += limit) {
      const page = await repo.findAll({ isActive: true, limit, offset });
      seen.push(...page.map((p) => p.id));
    }

    expect(new Set(seen).size).toBe(seen.length); // no repeats
    expect(seen.sort()).toEqual(allActive.map((p) => p.id).sort()); // no gaps
  });

  it("keeps the same newest-first order as the unpaginated query", async () => {
    const firstPage = await repo.findAll({ isActive: true, limit: 5, offset: 0 });
    expect(firstPage.map((p) => p.id)).toEqual(
      allActive.slice(0, firstPage.length).map((p) => p.id)
    );
  });

  it("returns nothing past the end rather than erroring", async () => {
    const page = await repo.findAll({
      isActive: true,
      limit: 5,
      offset: allActive.length + 50,
    });
    expect(page).toEqual([]);
  });
});

describe("count agrees with the rows the same filters return", () => {
  // The pager is built from `count(filters)` while the rows come from
  // `findAll(filters)`. If the two ever disagree the UI shows a page that
  // cannot be reached, or hides one that exists.
  const cases: { name: string; filters: Parameters<typeof repo.count>[0] }[] = [
    { name: "active", filters: { isActive: true } },
    { name: "active + featured", filters: { isActive: true, isFeatured: true } },
    { name: "active + on sale", filters: { isActive: true, isOnSale: true } },
    { name: "active + gender men", filters: { isActive: true, gender: "men" } },
    { name: "search 'a'", filters: { isActive: true, search: "a" } },
  ];

  for (const { name, filters } of cases) {
    it(`matches for: ${name}`, async () => {
      const [rows, total] = await Promise.all([
        repo.findAll(filters),
        repo.count(filters),
      ]);
      console.log(`[products] count(${name}) = ${total}, rows = ${rows.length}`);
      expect(total).toBe(rows.length);
    });
  }
});

describe("filters that moved from JavaScript into SQL still mean the same thing", () => {
  it("isOnSale returns exactly the products a sale badge would show", async () => {
    const onSale = await repo.findAll({ isActive: true, isOnSale: true });

    // Every row returned really is discounted...
    for (const p of onSale) {
      expect(p.salePrice).not.toBeNull();
      expect(p.salePrice!).toBeLessThan(p.basePrice);
      expect(p.isOnSale()).toBe(true);
    }

    // ...and none were missed. This is the JS predicate the router used to run.
    const expected = allActive.filter((p) => p.isOnSale());
    expect(onSale.map((p) => p.id).sort()).toEqual(
      expected.map((p) => p.id).sort()
    );
  });

  it("gender returns exactly what the JS filter returned", async () => {
    for (const gender of ["men", "women", "unisex", "kids"]) {
      const rows = await repo.findAll({ isActive: true, gender });
      const expected = allActive.filter((p) => p.gender === gender);
      expect(rows.map((p) => p.id).sort()).toEqual(
        expected.map((p) => p.id).sort()
      );
    }
  });

  it("search matches name or description, case-insensitively", async () => {
    const sample = allActive[0];
    if (!sample) return;

    // A term guaranteed to hit at least one product, in the wrong case.
    const term = sample.name.slice(0, 4).toUpperCase();
    const rows = await repo.findAll({ isActive: true, search: term });

    console.log(`[products] search("${term}") returned ${rows.length}`);
    expect(rows.length).toBeGreaterThan(0);

    const needle = term.toLowerCase();
    for (const p of rows) {
      const matches =
        p.name.toLowerCase().includes(needle) ||
        (p.description ?? "").toLowerCase().includes(needle);
      expect(matches).toBe(true);
    }
  });

  it("agrees with the String.includes filter the router used to run", async () => {
    const term = "a";
    const rows = await repo.findAll({ isActive: true, search: term });

    // Exactly the JavaScript that `public.products.search` used to do.
    const expected = allActive.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.description ?? "").toLowerCase().includes(term)
    );

    expect(rows.map((p) => p.id).sort()).toEqual(
      expected.map((p) => p.id).sort()
    );
  });

  it("treats % and _ as literals, not wildcards", async () => {
    // The escaping regression guard, against the database rather than a string.
    // "%" must not match every product.
    const percent = await repo.findAll({ isActive: true, search: "%" });
    const underscore = await repo.findAll({ isActive: true, search: "_" });

    console.log(
      `[products] search("%") = ${percent.length}, search("_") = ${underscore.length}, total active = ${allActive.length}`
    );

    expect(percent.length).toBeLessThan(allActive.length);
    expect(underscore.length).toBeLessThan(allActive.length);
  });

  it("composes filters with pagination", async () => {
    const filters = { isActive: true, isOnSale: true };
    const total = await repo.count(filters);
    if (total < 2) return;

    const [first, second] = await Promise.all([
      repo.findAll({ ...filters, limit: 1, offset: 0 }),
      repo.findAll({ ...filters, limit: 1, offset: 1 }),
    ]);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0].id).not.toBe(second[0].id);
    expect(first[0].isOnSale()).toBe(true);
    expect(second[0].isOnSale()).toBe(true);
  });
});
