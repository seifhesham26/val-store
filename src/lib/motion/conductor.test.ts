import { beforeEach, describe, expect, it } from "vitest";
import {
  BEAT_MS,
  MAX_QUEUE_MS,
  SLOT_DURATION_MS,
  enqueue,
  resetConductor,
} from "./conductor";

/** Absolute, non-overlapping intervals are the whole contract. */
function intervals(now: number, result: ReturnType<typeof enqueue>) {
  return result.slots.map((s) => [
    now + s.startMs,
    now + s.startMs + s.durationMs,
  ]);
}

describe("conductor", () => {
  beforeEach(() => resetConductor());

  it("gives the first element an immediate slot", () => {
    const result = enqueue(1, 1000);
    expect(result.slots).toEqual([
      { startMs: 0, durationMs: SLOT_DURATION_MS },
    ]);
    expect(result.drainedCount).toBe(0);
  });

  it("never lets two slots overlap within one enqueue", () => {
    const now = 1000;
    const spans = intervals(now, enqueue(8, now));

    expect(spans).toHaveLength(8);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1]);
    }
  });

  it("never lets two slots overlap across separate enqueues", () => {
    const now = 1000;
    const first = intervals(now, enqueue(4, now));
    // A second region intersects 10ms later, while the first is still playing.
    const second = intervals(now + 10, enqueue(4, now + 10));

    const all = [...first, ...second].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < all.length; i++) {
      expect(all[i][0]).toBeGreaterThanOrEqual(all[i - 1][1]);
    }
  });

  it("drains elements whose slot would land past the queue cap", () => {
    const result = enqueue(40, 1000);

    expect(result.drainedCount).toBeGreaterThan(0);
    expect(result.slots.length + result.drainedCount).toBe(40);
    for (const slot of result.slots) {
      expect(slot.startMs).toBeLessThanOrEqual(MAX_QUEUE_MS);
    }
  });

  it("drains everything under reduced motion", () => {
    const result = enqueue(6, 1000, true);

    expect(result.slots).toEqual([]);
    expect(result.drainedCount).toBe(6);
  });

  it("reduced motion does not advance the queue for later callers", () => {
    enqueue(6, 1000, true);
    const next = enqueue(1, 1000);

    expect(next.slots[0].startMs).toBe(0);
  });

  it("frees the queue once the previous run has finished", () => {
    const now = 1000;
    enqueue(4, now);
    // 4 beats later the queue is empty again.
    const later = enqueue(1, now + 4 * BEAT_MS);

    expect(later.slots[0].startMs).toBe(0);
  });

  it("resetConductor clears the queue", () => {
    enqueue(10, 1000);
    resetConductor();

    expect(enqueue(1, 1000).slots[0].startMs).toBe(0);
  });
});
