import { describe, expect, it } from "vitest";
import {
  CAROUSEL_INTERVAL_MS,
  STAGGER_CYCLE,
  STAGGER_STEP_MS,
  shouldAnimateCard,
  staggerDelayMs,
} from "./card-carousel";

describe("shouldAnimateCard", () => {
  const ready = {
    hasSecondImage: true,
    secondImageLoaded: true,
    reducedMotion: false,
  };

  it("animates when there is a loaded second image and motion is allowed", () => {
    expect(shouldAnimateCard(ready)).toBe(true);
  });

  it("never animates a product with only one image", () => {
    // The placeholder product has exactly one photo. A card that fades to
    // nothing and back would look broken rather than intentional.
    expect(shouldAnimateCard({ ...ready, hasSecondImage: false })).toBe(false);
  });

  it("never animates when the visitor asked for reduced motion", () => {
    // An accessibility setting people turn on for real reasons — vestibular
    // disorders, migraine triggers. The card still works as a static image.
    expect(shouldAnimateCard({ ...ready, reducedMotion: true })).toBe(false);
  });

  it("waits for the second image to load before starting", () => {
    // Otherwise the first swap crossfades to an empty frame on a slow
    // connection, which is worse than never animating at all.
    expect(shouldAnimateCard({ ...ready, secondImageLoaded: false })).toBe(
      false
    );
  });

  it("requires every condition, not just one", () => {
    expect(
      shouldAnimateCard({
        hasSecondImage: false,
        secondImageLoaded: false,
        reducedMotion: true,
      })
    ).toBe(false);
  });
});

describe("staggerDelayMs", () => {
  it("starts the first card immediately", () => {
    expect(staggerDelayMs(0)).toBe(0);
  });

  it("offsets each following card by one step", () => {
    expect(staggerDelayMs(1)).toBe(STAGGER_STEP_MS);
    expect(staggerDelayMs(3)).toBe(STAGGER_STEP_MS * 3);
  });

  it("wraps so a long grid never waits absurdly long to start", () => {
    // Without the wrap, card 50 would sit still for 20 seconds while the rest
    // of the grid moved — it would read as broken, not staggered.
    expect(staggerDelayMs(STAGGER_CYCLE)).toBe(0);
    expect(staggerDelayMs(STAGGER_CYCLE + 2)).toBe(STAGGER_STEP_MS * 2);
  });

  it("never returns a delay at or beyond the swap interval", () => {
    // A delay longer than the interval would make a card's first swap land
    // after its second, which is visible as a stutter.
    for (let i = 0; i < 50; i++) {
      expect(staggerDelayMs(i)).toBeLessThan(CAROUSEL_INTERVAL_MS);
      expect(staggerDelayMs(i)).toBeGreaterThanOrEqual(0);
    }
  });

  it("treats a nonsense index as the first card rather than throwing", () => {
    expect(staggerDelayMs(-1)).toBe(0);
    expect(staggerDelayMs(Number.NaN)).toBe(0);
    expect(staggerDelayMs(1.7)).toBe(STAGGER_STEP_MS);
  });
});
