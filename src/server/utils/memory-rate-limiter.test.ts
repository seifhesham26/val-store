import { describe, expect, it } from "vitest";
import { createMemoryRateLimiter } from "./memory-rate-limiter";

/**
 * A controllable clock, so a sliding window can be tested without sleeping.
 */
function fakeClock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe("createMemoryRateLimiter", () => {
  it("allows exactly `limit` requests inside the window", () => {
    const clock = fakeClock();
    const limiter = createMemoryRateLimiter({
      limit: 3,
      windowMs: 1000,
      now: clock.now,
    });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("reports how much budget is left", () => {
    const clock = fakeClock();
    const limiter = createMemoryRateLimiter({
      limit: 3,
      windowMs: 1000,
      now: clock.now,
    });

    expect(limiter.check("a").remaining).toBe(2);
    expect(limiter.check("a").remaining).toBe(1);
    expect(limiter.check("a").remaining).toBe(0);
    // Over budget stays at zero rather than going negative.
    expect(limiter.check("a").remaining).toBe(0);
  });

  it("does not charge a rejected request against the window", () => {
    // Otherwise a client hammering while blocked keeps pushing its own reset
    // out, and a burst that stops for the full window still cannot get back
    // in. The rejection is the answer; it should not also be a penalty.
    const clock = fakeClock();
    const limiter = createMemoryRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: clock.now,
    });

    expect(limiter.check("a").allowed).toBe(true);
    clock.advance(500);
    expect(limiter.check("a").allowed).toBe(false);
    clock.advance(500); // the single allowed hit is now exactly `windowMs` old

    expect(limiter.check("a").allowed).toBe(true);
  });

  it("lets the window slide rather than resetting it wholesale", () => {
    const clock = fakeClock();
    const limiter = createMemoryRateLimiter({
      limit: 2,
      windowMs: 1000,
      now: clock.now,
    });

    limiter.check("a"); // t+0
    clock.advance(600);
    limiter.check("a"); // t+600
    expect(limiter.check("a").allowed).toBe(false);

    clock.advance(401); // t+1001 — only the t+0 hit has aged out
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("reports when the next slot frees up", () => {
    const clock = fakeClock();
    const limiter = createMemoryRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: clock.now,
    });

    limiter.check("a");
    clock.advance(250);

    expect(limiter.check("a").resetInMs).toBe(750);
  });

  it("keeps a separate budget per identifier", () => {
    const clock = fakeClock();
    const limiter = createMemoryRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: clock.now,
    });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("bounds how many identifiers it tracks", () => {
    // This runs on the request path of a public endpoint during an outage, so
    // an attacker choosing the keys must not be able to grow it without
    // limit. Eviction can only ever forget a hit, which loosens the limit for
    // one identifier — it can never wrongly reject a different one.
    const clock = fakeClock();
    const limiter = createMemoryRateLimiter({
      limit: 1,
      windowMs: 60_000,
      maxTrackedIdentifiers: 2,
      now: clock.now,
    });

    limiter.check("a");
    limiter.check("b");
    limiter.check("c"); // evicts "a", the least recently seen

    expect(limiter.size()).toBe(2);
    // "b" and "c" are still remembered and still over budget...
    expect(limiter.check("b").allowed).toBe(false);
    // ...while "a" was forgotten, so its budget starts over.
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("does not evict an identifier that is actively being rejected", () => {
    // Eviction hands back a fresh budget, so evicting whoever is currently
    // being throttled is the one outcome that turns the memory bound into a
    // way around the limit.
    const clock = fakeClock();
    const limiter = createMemoryRateLimiter({
      limit: 1,
      windowMs: 60_000,
      maxTrackedIdentifiers: 3,
      now: clock.now,
    });

    limiter.check("attacker");
    expect(limiter.check("attacker").allowed).toBe(false);

    // Ordinary traffic from other identifiers fills the table...
    limiter.check("b");
    limiter.check("c");

    // ...and the attacker keeps hammering, which keeps it fresh.
    expect(limiter.check("attacker").allowed).toBe(false);

    // A new identifier now forces an eviction. The idle "b" goes, not the
    // one that was still being rejected a moment ago.
    limiter.check("d");

    expect(limiter.check("attacker").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("forgets identifiers whose window has fully elapsed", () => {
    const clock = fakeClock();
    const limiter = createMemoryRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: clock.now,
    });

    limiter.check("a");
    expect(limiter.size()).toBe(1);

    clock.advance(1001);
    limiter.check("b");

    // "a" is pruned as a side effect of ordinary traffic, so an idle process
    // does not hold every identifier it has ever seen.
    expect(limiter.size()).toBe(1);
  });
});
