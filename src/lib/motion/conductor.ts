/**
 * The conductor — the Timeline Law, in one place.
 *
 * > At any instant, at most one element performs an entrance.
 *
 * Components do not animate themselves. They ask for slots and the conductor
 * grants each one an exclusive window on a single shared timeline, so a section
 * scrolling into view while another is still playing queues behind it rather
 * than doubling up.
 *
 * `SLOT_DURATION_MS` is strictly less than `BEAT_MS`. That 10ms gap is the
 * whole mechanism: element N has finished before element N+1 begins. Raising
 * the duration to meet the beat would technically satisfy "no overlap" while
 * making a dropped frame enough to break it.
 *
 * Deliberately exempt, documented in the spec: continuous loops (the loader's
 * orbit, the product card crossfade), hover states, and group exits.
 */

/** Distance between the start of one element's entrance and the next. */
export const BEAT_MS = 90;

/** How long a single entrance runs. Strictly less than `BEAT_MS`. */
export const SLOT_DURATION_MS = 80;

/**
 * How far into the future a slot may be granted, ~16 beats.
 *
 * Past this the conductor stops animating and shows the rest instantly. A grid
 * of 40 products sequenced end to end would take 3.6s to finish appearing,
 * which reads as a stall rather than as choreography.
 */
export const MAX_QUEUE_MS = 1440;

export interface Slot {
  /** Offset from the `now` passed to `enqueue`, in milliseconds. */
  startMs: number;
  durationMs: number;
}

export interface ScheduleResult {
  /** Elements that animate, in the order they were requested. */
  slots: Slot[];
  /**
   * Trailing elements the caller must reveal instantly, with no animation.
   * An element that is simply shown is not animating, so the law still holds.
   */
  drainedCount: number;
}

/** Absolute timestamp at which the shared timeline is next free. */
let queueFreeAt = 0;

/**
 * Claim `count` consecutive exclusive slots.
 *
 * `now` is injected rather than read from `performance.now()` so the law is
 * testable without fake timers.
 */
export function enqueue(
  count: number,
  now: number,
  reducedMotion = false
): ScheduleResult {
  if (count <= 0) {
    return { slots: [], drainedCount: 0 };
  }

  // Nothing animates, so nothing occupies the timeline — leaving `queueFreeAt`
  // untouched keeps a later caller (a user who re-enables motion mid-session)
  // from waiting behind a run that never played.
  if (reducedMotion) {
    return { slots: [], drainedCount: count };
  }

  const base = Math.max(now, queueFreeAt);
  const slots: Slot[] = [];

  for (let i = 0; i < count; i++) {
    const startMs = base - now + i * BEAT_MS;
    if (startMs > MAX_QUEUE_MS) break;
    slots.push({ startMs, durationMs: SLOT_DURATION_MS });
  }

  queueFreeAt = base + slots.length * BEAT_MS;

  return { slots, drainedCount: count - slots.length };
}

/** Test seam, and a hard reset on route change. */
export function resetConductor(): void {
  queueFreeAt = 0;
}
