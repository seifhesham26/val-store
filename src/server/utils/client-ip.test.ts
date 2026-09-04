/**
 * client-ip tests
 *
 * The property under test is that a value the *client* wrote into
 * `X-Forwarded-For` never becomes the rate-limit key. Everything else here is
 * in service of that.
 */

import { describe, it, expect } from "vitest";
import {
  clientIpFromForwardedFor,
  resolveClientIp,
  trustedProxyHops,
  DEFAULT_TRUSTED_PROXY_HOPS,
} from "./client-ip";

function headersOf(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("clientIpFromForwardedFor", () => {
  it("returns null for an absent or empty header", () => {
    expect(clientIpFromForwardedFor(null, 1)).toBeNull();
    expect(clientIpFromForwardedFor("", 1)).toBeNull();
    expect(clientIpFromForwardedFor("  ,  ,", 1)).toBeNull();
  });

  it("reads the single entry a rewriting edge leaves behind", () => {
    // Vercel overwrites the header rather than appending, so this is the
    // shape production actually sees.
    expect(clientIpFromForwardedFor("203.0.113.7", 1)).toBe("203.0.113.7");
  });

  it("ignores a client-supplied entry ahead of the real one", () => {
    // Client sent "1.2.3.4"; the one proxy in front of us appended the
    // address it actually saw. Reading from the left would hand the attacker
    // the key.
    expect(clientIpFromForwardedFor("1.2.3.4, 203.0.113.7", 1)).toBe(
      "203.0.113.7"
    );
  });

  it("counts hops from the right with two proxies in front", () => {
    // client -> P1 -> P2 -> app, with a spoofed value the client sent.
    const chain = "1.2.3.4, 203.0.113.7, 10.0.0.1";
    expect(clientIpFromForwardedFor(chain, 2)).toBe("203.0.113.7");
  });

  it("refuses to guess when the chain is shorter than the hop count", () => {
    // Falling back to the first entry here would restore the exact value the
    // attacker controls, so a malformed chain yields nothing instead.
    expect(clientIpFromForwardedFor("1.2.3.4", 2)).toBeNull();
  });

  it("trims whitespace around entries", () => {
    expect(clientIpFromForwardedFor("  203.0.113.7  ", 1)).toBe("203.0.113.7");
  });
});

describe("trustedProxyHops", () => {
  it("defaults when unset", () => {
    expect(trustedProxyHops(undefined)).toBe(DEFAULT_TRUSTED_PROXY_HOPS);
  });

  it("reads a configured value", () => {
    expect(trustedProxyHops("3")).toBe(3);
  });

  it("falls back rather than widening trust on a bad value", () => {
    // 0 would mean "read the entry past the right edge"; a negative or
    // non-numeric value means the operator made a mistake. Neither may
    // silently become "trust the client."
    for (const bad of ["0", "-1", "abc", "1.5", ""]) {
      expect(trustedProxyHops(bad)).toBe(DEFAULT_TRUSTED_PROXY_HOPS);
    }
  });
});

describe("resolveClientIp", () => {
  it("prefers a platform-issued header over the forwarded chain", () => {
    const headers = headersOf({
      "x-forwarded-for": "1.2.3.4",
      "x-vercel-forwarded-for": "203.0.113.7",
    });
    expect(resolveClientIp(headers, 1)).toBe("203.0.113.7");
  });

  it("uses cf-connecting-ip when present", () => {
    const headers = headersOf({ "cf-connecting-ip": "203.0.113.9" });
    expect(resolveClientIp(headers, 1)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip when there is no usable chain", () => {
    const headers = headersOf({ "x-real-ip": "203.0.113.8" });
    expect(resolveClientIp(headers, 1)).toBe("203.0.113.8");
  });

  it("returns 'unknown' when nothing identifies the caller", () => {
    expect(resolveClientIp(headersOf({}), 1)).toBe("unknown");
  });

  it("does not let a spoofed chain override x-real-ip", () => {
    // The chain is one entry short of the hop count, so it yields nothing and
    // the immediate proxy's own header wins — not the client's guess.
    const headers = headersOf({
      "x-forwarded-for": "1.2.3.4",
      "x-real-ip": "203.0.113.8",
    });
    expect(resolveClientIp(headers, 2)).toBe("203.0.113.8");
  });
});
