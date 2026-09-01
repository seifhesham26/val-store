import { describe, it, expect } from "vitest";
import {
  cacheControlFor,
  isPubliclyCacheable,
  PUBLIC_CACHE_CONTROL,
  PRIVATE_CACHE_CONTROL,
  type ResponseCacheInput,
} from "./response-cache-policy";

/** The one shape that is allowed to be cached: an anonymous catalogue read. */
const anonymousQuery: ResponseCacheInput = {
  touchedAuth: false,
  type: "query",
  errorCount: 0,
  pathCount: 1,
};

describe("the only cacheable shape", () => {
  it("caches an anonymous, error-free query batch", () => {
    expect(cacheControlFor(anonymousQuery)).toBe(PUBLIC_CACHE_CONTROL);
  });

  it("caches a multi-procedure anonymous batch", () => {
    // httpBatchLink routinely sends several catalogue queries at once.
    expect(isPubliclyCacheable({ ...anonymousQuery, pathCount: 4 })).toBe(true);
  });

  it("emits a shared-cache directive, not a browser one", () => {
    // `max-age=0` keeps the browser revalidating while the CDN serves it, so a
    // customer never sees a minute-old page from their own disk cache.
    expect(PUBLIC_CACHE_CONTROL).toContain("s-maxage=60");
    expect(PUBLIC_CACHE_CONTROL).toContain("max-age=0");
    expect(PUBLIC_CACHE_CONTROL).toContain("stale-while-revalidate=300");
  });
});

describe("anything that touched auth is never shared", () => {
  it("refuses a batch that resolved the user", () => {
    // This is the case that matters: one protected call in a batch makes the
    // whole HTTP response user-specific.
    expect(cacheControlFor({ ...anonymousQuery, touchedAuth: true })).toBe(
      PRIVATE_CACHE_CONTROL
    );
  });

  it("refuses even when the resolved user turned out to be null", () => {
    // `touchedAuth` is about whether auth was consulted, not what it returned.
    // A signed-out visitor calling `user.getSession` still gets a response
    // shaped by that call, and must not seed a shared cache for everyone.
    expect(isPubliclyCacheable({ ...anonymousQuery, touchedAuth: true })).toBe(
      false
    );
  });
});

describe("mutations are never shared", () => {
  for (const type of ["mutation", "subscription", "unknown", ""]) {
    it(`refuses type "${type}"`, () => {
      expect(cacheControlFor({ ...anonymousQuery, type })).toBe(
        PRIVATE_CACHE_CONTROL
      );
    });
  }
});

describe("errors are never shared", () => {
  it("refuses a batch with a failure in it", () => {
    // Caching an error replays it to everyone for the whole TTL.
    expect(cacheControlFor({ ...anonymousQuery, errorCount: 1 })).toBe(
      PRIVATE_CACHE_CONTROL
    );
  });

  it("refuses when only one call of several failed", () => {
    expect(
      isPubliclyCacheable({ ...anonymousQuery, pathCount: 3, errorCount: 1 })
    ).toBe(false);
  });
});

describe("degenerate requests are never shared", () => {
  it("refuses a batch that resolved to no procedure", () => {
    expect(cacheControlFor({ ...anonymousQuery, pathCount: 0 })).toBe(
      PRIVATE_CACHE_CONTROL
    );
  });
});

describe("the rule fails closed", () => {
  // Exhaustive over the flags: exactly one combination may be cached, and any
  // future edit that widens the rule breaks this test.
  it("caches exactly one of every flag combination", () => {
    const cacheable: ResponseCacheInput[] = [];

    for (const touchedAuth of [true, false]) {
      for (const type of ["query", "mutation"]) {
        for (const errorCount of [0, 1]) {
          for (const pathCount of [0, 1]) {
            const input = { touchedAuth, type, errorCount, pathCount };
            if (isPubliclyCacheable(input)) cacheable.push(input);
          }
        }
      }
    }

    expect(cacheable).toEqual([
      { touchedAuth: false, type: "query", errorCount: 0, pathCount: 1 },
    ]);
  });

  it("never returns anything but the two known directives", () => {
    const seen = new Set<string>();
    for (const touchedAuth of [true, false]) {
      for (const type of ["query", "mutation", "nonsense"]) {
        for (const errorCount of [0, 2]) {
          for (const pathCount of [0, 5]) {
            seen.add(
              cacheControlFor({ touchedAuth, type, errorCount, pathCount })
            );
          }
        }
      }
    }
    expect([...seen].sort()).toEqual(
      [PUBLIC_CACHE_CONTROL, PRIVATE_CACHE_CONTROL].sort()
    );
  });
});
