import { describe, it, expect, vi } from "vitest";
import { parseSectionContent } from "./cms-content-parser";
import {
  parseHeroContent,
  parseAnnouncementContent,
} from "@/domain/site/value-objects/content-schemas";

describe("parseSectionContent", () => {
  it("returns validated, defaulted content for a well-formed hero row", () => {
    const raw = JSON.stringify({ title: "Elevate Your Style" });
    const result = parseSectionContent("hero", raw, parseHeroContent);

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Elevate Your Style");
    // Zod-applied defaults, not just pass-through of what was stored.
    expect(result?.overlayOpacity).toBe(40);
    expect(result?.ctaStyle).toBe("primary");
  });

  it("degrades to null rather than throwing on malformed JSON", () => {
    expect(() =>
      parseSectionContent("hero", "{not valid json", parseHeroContent)
    ).not.toThrow();
    expect(
      parseSectionContent("hero", "{not valid json", parseHeroContent)
    ).toBeNull();
  });

  it("degrades to null rather than throwing when the shape fails schema validation", () => {
    // heroContentSchema requires a non-empty `title`.
    const raw = JSON.stringify({ title: "" });
    expect(parseSectionContent("hero", raw, parseHeroContent)).toBeNull();
  });

  it("logs the failure rather than swallowing it silently", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    parseSectionContent("hero", "not json at all", parseHeroContent);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("hero");
    spy.mockRestore();
  });

  it("validates announcement content the same way", () => {
    const raw = JSON.stringify({ messages: [{ text: "Sale!" }] });
    const result = parseSectionContent(
      "announcement",
      raw,
      parseAnnouncementContent
    );

    expect(result?.messages[0].text).toBe("Sale!");
    expect(result?.dismissible).toBe(true); // schema default

    // announcementContentSchema requires at least one message.
    const invalid = JSON.stringify({ messages: [] });
    expect(
      parseSectionContent("announcement", invalid, parseAnnouncementContent)
    ).toBeNull();
  });
});
