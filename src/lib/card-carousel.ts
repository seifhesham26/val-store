/**
 * Timing rules for the product card's two-image crossfade.
 *
 * Kept out of React so the decisions can be tested — there is no DOM testing
 * library in this repo, so client logic worth checking gets extracted into a
 * plain module (`variant-stock-registry.ts` and `image-crop.ts` are the same
 * pattern). `ProductCard` is left as a thin shell over these two functions.
 */

/** How long each image is held before crossfading to the other. */
export const CAROUSEL_INTERVAL_MS = 4000;

/** Crossfade duration. Long enough to read as deliberate, short enough not to blur. */
export const CAROUSEL_FADE_MS = 400;

/** Gap between neighbouring cards' start times. */
export const STAGGER_STEP_MS = 400;

/**
 * How many cards before the stagger repeats.
 *
 * `STAGGER_CYCLE * STAGGER_STEP_MS` must stay below `CAROUSEL_INTERVAL_MS`, or
 * a card's first swap would land after its second and read as a stutter.
 */
export const STAGGER_CYCLE = 8;

export function shouldAnimateCard(input: {
  hasSecondImage: boolean;
  secondImageLoaded: boolean;
  reducedMotion: boolean;
}): boolean {
  // Every condition is required. A product with one photo must stay still, a
  // visitor who asked for reduced motion must get none, and starting before
  // the second image has loaded crossfades to an empty frame.
  return (
    input.hasSecondImage && input.secondImageLoaded && !input.reducedMotion
  );
}

/**
 * When this card should begin, given its position in the grid.
 *
 * Without an offset every card in the grid flips on the same tick and the whole
 * page pulses in unison, which reads as a rendering fault rather than motion.
 * The cycle wraps so a card far down a long grid does not sit still for twenty
 * seconds waiting its turn.
 */
export function staggerDelayMs(index: number): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return (Math.floor(index) % STAGGER_CYCLE) * STAGGER_STEP_MS;
}
