/**
 * Timing and geometry for the product card's sliding image track.
 *
 * Kept out of React so the decisions can be tested — there is no DOM testing
 * library in this repo, so client logic worth checking gets extracted into a
 * plain module (`variant-stock-registry.ts` and `image-crop.ts` are the same
 * pattern). `ProductCard` is left as a thin shell over these functions.
 */

/** How long each image is held before the track advances. */
export const CAROUSEL_INTERVAL_MS = 4000;

/** Retained for the fallback path; the track itself slides rather than fades. */
export const CAROUSEL_FADE_MS = 400;

/**
 * Slide duration.
 *
 * Longer than the old crossfade: 400ms reads as deliberate for a dissolve but
 * as a jerk for travel, because the eye tracks a moving edge and a fading one
 * has none.
 */
export const CAROUSEL_SLIDE_MS = 600;

/**
 * How long transitions stay suppressed for the invisible snap home.
 *
 * Long enough for the browser to commit the new offset, short enough to be
 * imperceptible — and both panels involved hold the same photograph, so
 * nothing visibly changes during it.
 */
export const SNAP_RESET_MS = 50;

/** Accelerate, then decelerate. No overshoot — a bounce reads as a toy. */
export const CAROUSEL_EASING = "cubic-bezier(0.65, 0, 0.35, 1)";

/**
 * Panels in the track: `[primary, secondary, primary]`.
 *
 * The third panel is the reason the motion can always travel one way. On
 * reaching it the track snaps back to panel 0 with transitions disabled, and
 * because both panels hold the same photograph the snap is invisible. A
 * two-panel track has to slide back the way it came, which reads as a
 * correction rather than a carousel.
 */
export const CAROUSEL_PANELS = 3;

export interface CarouselStep {
  /** Panel to travel to. */
  panel: number;
  /**
   * Whether to snap back to panel 0 once this slide finishes. True only on the
   * move onto the duplicated final panel.
   */
  wrapAfter: boolean;
}

/**
 * Where the track goes next.
 *
 * Panel 2 is transient — held only for the length of one slide before the
 * invisible snap — so a tick never starts from it. Anything out of range is
 * treated as panel 0 rather than throwing; this drives an animation, and a
 * wrong number should degrade to a sensible loop, not break a product card.
 */
export function nextCarouselStep(panel: number): CarouselStep {
  const from = Number.isFinite(panel) && panel === 1 ? 1 : 0;
  return from === 0
    ? { panel: 1, wrapAfter: false }
    : { panel: 2, wrapAfter: true };
}

/**
 * Track offset for a panel, as a percentage of the track's own width.
 *
 * The track is `CAROUSEL_PANELS` times the card wide, so one panel is
 * `100 / CAROUSEL_PANELS` percent of it.
 */
export function trackOffsetPercent(panel: number): number {
  const clamped = Math.min(
    Math.max(Math.floor(panel) || 0, 0),
    CAROUSEL_PANELS - 1
  );
  const offset = (clamped * 100) / CAROUSEL_PANELS;
  // Negating zero yields `-0`, which stringifies into the transform as
  // `translate3d(-0%, 0, 0)`. Harmless, but there is no reason to ship it.
  return offset === 0 ? 0 : -offset;
}

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
