import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createCartSyncRegistry,
  reconcileServerCart,
} from "./cart-sync-registry";

const ITEM_A = "item-a";
const ITEM_B = "item-b";

describe("createCartSyncRegistry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the write after the debounce delay", async () => {
    const registry = createCartSyncRegistry(1000);
    const run = vi.fn().mockResolvedValue(undefined);

    registry.scheduleUpdate(ITEM_A, run);
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("scheduling again for the same id cancels the previous run — last call wins", async () => {
    const registry = createCartSyncRegistry(1000);
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);

    registry.scheduleUpdate(ITEM_A, first);
    await vi.advanceTimersByTimeAsync(500);
    registry.scheduleUpdate(ITEM_A, second);
    await vi.advanceTimersByTimeAsync(1000);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does not cancel a different item's timer", async () => {
    const registry = createCartSyncRegistry(1000);
    const runA = vi.fn().mockResolvedValue(undefined);
    const runB = vi.fn().mockResolvedValue(undefined);

    registry.scheduleUpdate(ITEM_A, runA);
    registry.scheduleUpdate(ITEM_B, runB);
    await vi.advanceTimersByTimeAsync(1000);

    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).toHaveBeenCalledTimes(1);
  });

  it("cancel() stops an armed timer from ever firing", async () => {
    // The removeItem case: bump a quantity, then remove the line within the
    // debounce window. Without this, the timer fires against a row that no
    // longer exists.
    const registry = createCartSyncRegistry(1000);
    const run = vi.fn().mockResolvedValue(undefined);

    registry.scheduleUpdate(ITEM_A, run);
    registry.cancel(ITEM_A);
    await vi.advanceTimersByTimeAsync(5000);

    expect(run).not.toHaveBeenCalled();
  });

  it("cancel() is safe to call for an id with nothing scheduled", () => {
    const registry = createCartSyncRegistry(1000);
    expect(() => registry.cancel("nothing-scheduled")).not.toThrow();
  });

  it("cancelAll() stops every armed timer — the clearCart case", async () => {
    const registry = createCartSyncRegistry(1000);
    const runA = vi.fn().mockResolvedValue(undefined);
    const runB = vi.fn().mockResolvedValue(undefined);

    registry.scheduleUpdate(ITEM_A, runA);
    registry.scheduleUpdate(ITEM_B, runB);
    registry.cancelAll();
    await vi.advanceTimersByTimeAsync(5000);

    expect(runA).not.toHaveBeenCalled();
    expect(runB).not.toHaveBeenCalled();
  });

  it("isPending is true once scheduled and stays true through the debounce window", async () => {
    const registry = createCartSyncRegistry(1000);
    registry.scheduleUpdate(ITEM_A, () => new Promise(() => {}));

    expect(registry.isPending(ITEM_A)).toBe(true);
    await vi.advanceTimersByTimeAsync(999);
    expect(registry.isPending(ITEM_A)).toBe(true);
  });

  it("isPending stays true while the mutation itself is in flight, and clears once it settles", async () => {
    let resolveRun!: () => void;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        })
    );
    const registry = createCartSyncRegistry(1000);

    registry.scheduleUpdate(ITEM_A, run);
    await vi.advanceTimersByTimeAsync(1000);

    // The timer has fired (run() was called) but the promise it returned
    // has not resolved yet — this is the gap a naive "pending until the
    // timer fires" implementation would miss.
    expect(run).toHaveBeenCalledTimes(1);
    expect(registry.isPending(ITEM_A)).toBe(true);

    resolveRun();
    await vi.advanceTimersByTimeAsync(0);
    expect(registry.isPending(ITEM_A)).toBe(false);
  });

  it("isPending clears even when the write rejects", async () => {
    const registry = createCartSyncRegistry(1000);
    registry.scheduleUpdate(ITEM_A, () => Promise.reject(new Error("boom")));

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);

    expect(registry.isPending(ITEM_A)).toBe(false);
  });

  it("cancel() clears isPending immediately, without waiting for the timer", () => {
    const registry = createCartSyncRegistry(1000);
    registry.scheduleUpdate(ITEM_A, vi.fn().mockResolvedValue(undefined));
    expect(registry.isPending(ITEM_A)).toBe(true);

    registry.cancel(ITEM_A);
    expect(registry.isPending(ITEM_A)).toBe(false);
  });

  it("isPending is false for an id nothing was ever scheduled for", () => {
    const registry = createCartSyncRegistry(1000);
    expect(registry.isPending("never-touched")).toBe(false);
  });
});

describe("reconcileServerCart", () => {
  it("replaces a non-pending line with the server's value", () => {
    const registry = createCartSyncRegistry();
    const server = [{ id: ITEM_A, quantity: 5 }];
    const local = [{ id: ITEM_A, quantity: 1 }];

    expect(reconcileServerCart(server, local, registry)).toEqual([
      { id: ITEM_A, quantity: 5 },
    ]);
  });

  it("keeps the local value for a line with a write in flight", () => {
    const registry = createCartSyncRegistry();
    registry.scheduleUpdate(ITEM_A, () => new Promise(() => {}));

    // The server still reflects the pre-edit quantity; the customer's
    // optimistic edit must survive this refetch.
    const server = [{ id: ITEM_A, quantity: 1 }];
    const local = [{ id: ITEM_A, quantity: 3 }];

    expect(reconcileServerCart(server, local, registry)).toEqual([
      { id: ITEM_A, quantity: 3 },
    ]);
  });

  it("only protects the pending line, not the rest of the cart", () => {
    const registry = createCartSyncRegistry();
    registry.scheduleUpdate(ITEM_A, () => new Promise(() => {}));

    const server = [
      { id: ITEM_A, quantity: 1 },
      { id: ITEM_B, quantity: 9 },
    ];
    const local = [
      { id: ITEM_A, quantity: 3 },
      { id: ITEM_B, quantity: 2 },
    ];

    expect(reconcileServerCart(server, local, registry)).toEqual([
      { id: ITEM_A, quantity: 3 },
      { id: ITEM_B, quantity: 9 },
    ]);
  });

  it("falls back to the server value if a pending line has no local match", () => {
    const registry = createCartSyncRegistry();
    registry.scheduleUpdate(ITEM_A, () => new Promise(() => {}));

    const server = [{ id: ITEM_A, quantity: 1 }];
    expect(reconcileServerCart(server, [], registry)).toEqual([
      { id: ITEM_A, quantity: 1 },
    ]);
  });
});
