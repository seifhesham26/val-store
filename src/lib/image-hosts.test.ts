import { describe, it, expect } from "vitest";
import {
  OPTIMIZED_IMAGE_HOSTS,
  REMOTE_IMAGE_HOSTS,
  shouldOptimizeImage,
  unoptimizedFor,
} from "./image-hosts";

describe("image host lists", () => {
  it("keeps every optimisable host renderable", () => {
    // remotePatterns is built from REMOTE_IMAGE_HOSTS. A host we try to
    // optimise but never allowed to render makes the optimiser return 400 and
    // the image vanish.
    for (const host of OPTIMIZED_IMAGE_HOSTS) {
      expect(REMOTE_IMAGE_HOSTS).toContain(host);
    }
  });

  it("does NOT optimise picsum.photos", () => {
    // Regression guard. Routing picsum through the optimiser means Next fetches
    // it server-to-server, and picsum answers those with 503 — which replaced
    // all the seed imagery with broken images the first time this was tried.
    expect(OPTIMIZED_IMAGE_HOSTS).not.toContain("picsum.photos");
    expect(REMOTE_IMAGE_HOSTS).toContain("picsum.photos");
  });
});

describe("shouldOptimizeImage", () => {
  it("optimises local asset paths", () => {
    expect(shouldOptimizeImage("/logo/VAL-LOGO.png")).toBe(true);
    expect(shouldOptimizeImage("/uploads/a.jpg")).toBe(true);
  });

  it("optimises uploads on the configured CDN", () => {
    expect(shouldOptimizeImage("https://utfs.io/f/abc123.jpg")).toBe(true);
  });

  it("optimises subdomains of a listed host", () => {
    expect(shouldOptimizeImage("https://cdn.utfs.io/f/abc.jpg")).toBe(true);
  });

  it("does not optimise a host that merely ends with a listed name", () => {
    // "evilutfs.io" must not pass because it ends with "utfs.io".
    expect(shouldOptimizeImage("https://evilutfs.io/f/abc.jpg")).toBe(false);
    expect(shouldOptimizeImage("https://notpicsum.photos/x.jpg")).toBe(false);
  });

  it("passes picsum through untouched", () => {
    expect(shouldOptimizeImage("https://picsum.photos/seed/x/800/1000")).toBe(
      false
    );
  });

  it("passes an unconfigured host through rather than breaking it", () => {
    // An admin pasting a URL from a host nobody configured should still see
    // their image, not a 400 from the optimiser.
    expect(shouldOptimizeImage("https://example.com/photo.jpg")).toBe(false);
  });

  it("treats unparseable or absent input as not optimisable", () => {
    expect(shouldOptimizeImage(null)).toBe(false);
    expect(shouldOptimizeImage(undefined)).toBe(false);
    expect(shouldOptimizeImage("")).toBe(false);
    expect(shouldOptimizeImage("not a url")).toBe(false);
  });
});

describe("unoptimizedFor", () => {
  it("is the exact inverse of shouldOptimizeImage", () => {
    const samples = [
      "/logo/VAL-LOGO.png",
      "https://utfs.io/f/abc.jpg",
      "https://picsum.photos/seed/x/800/1000",
      "https://example.com/photo.jpg",
      "",
      null,
      undefined,
    ];
    for (const src of samples) {
      expect(unoptimizedFor(src)).toBe(!shouldOptimizeImage(src));
    }
  });

  it("marks picsum images unoptimized, which is what keeps them loading", () => {
    expect(unoptimizedFor("https://picsum.photos/seed/hero/1920/1080")).toBe(
      true
    );
  });
});
