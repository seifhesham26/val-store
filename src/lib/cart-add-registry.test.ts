import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCartAddRegistry, cartAddKey } from "./cart-add-registry";

const KEY_A = "product-a:variant-1";
const KEY_B = "product-b:-";

describe("cartAddKey", () => {
  it("joins product and variant", () => {
    expect(cartAddKey("p1", "v1")).toBe("p1:v1");
  });

  it("uses a placeholder for a product with no variant", () => {
    expect(cartAddKey("p1", null)).toBe("p1:-");
  });

  it("keeps two variants of one product apart", () => {
    expect(cartAddKey("p1", "v1")).not.toBe(cartAddKey("p1", "v2"));
  });
});

describe("createCartAddRegistry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("collapses a burst of presses into one call carrying the summed delta", async () => {
    // The headline behaviour: thirty presses, one request.
    const registry = createCartAddRegistry(1000);
    const run = vi.fn().mockResolvedValue(undefined);

    for (let i = 0; i < 30; i++) {
      registry.queueAdd(KEY_A, 1, run);
      await vi.advanceTimersByTimeAsync(10);
    }
    await vi.advanceTimersByTimeAsync(1000);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(30);
  });

  it("accumulates rather than replacing — the difference from cart-sync-registry", async () => {
    const registry = createCartAddRegistry(1000);
    const run = vi.fn().mockResolvedValue(undefined);

    registry.queueAdd(KEY_A, 2, run);
    registry.queueAdd(KEY_A, 3, run);
    await vi.advanceTimersByTimeAsync(1000);

    expect(run).toHaveBeenCalledWith(5);
  });

  it("keeps separate keys independent", async () => {
    const registry = createCartAddRegistry(1000);
    const runA = vi.fn().mockResolvedValue(undefined);
    const runB = vi.fn().mockResolvedValue(undefined);

    registry.queueAdd(KEY_A, 1, runA);
    registry.queueAdd(KEY_B, 4, runB);
    await vi.advanceTimersByTimeAsync(1000);

    expect(runA).toHaveBeenCalledWith(1);
    expect(runB).toHaveBeenCalledWith(4);
  });

  it("pendingDelta counts queued units and clears once the call settles", async () => {
    let resolveRun!: () => void;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        })
    );
    const registry = createCartAddRegistry(1000);

    registry.queueAdd(KEY_A, 3, run);
    expect(registry.pendingDelta(KEY_A)).toBe(3);
    expect(registry.isPending(KEY_A)).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);
    // Handed to the server but not confirmed — still pending.
    expect(registry.pendingDelta(KEY_A)).toBe(3);

    resolveRun();
    await vi.advanceTimersByTimeAsync(0);
    expect(registry.pendingDelta(KEY_A)).toBe(0);
    expect(registry.isPending(KEY_A)).toBe(false);
  });

  it("presses during an in-flight call become a second call, not a bigger first one", async () => {
    // The server is additive, so a second `+2` is the correct way to send two
    // more units while the first call is still on the wire. Folding them into
    // the in-flight amount would make a rollback take back units that were
    // never sent.
    let resolveFirst!: () => void;
    const run = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValue(undefined);
    const registry = createCartAddRegistry(1000);

    registry.queueAdd(KEY_A, 1, run);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenNthCalledWith(1, 1);

    registry.queueAdd(KEY_A, 2, run);
    expect(registry.pendingDelta(KEY_A)).toBe(3);

    resolveFirst();
    await vi.advanceTimersByTimeAsync(1000);

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenNthCalledWith(2, 2);
    expect(registry.pendingDelta(KEY_A)).toBe(0);
  });

  it("pendingDelta clears even when the call rejects", async () => {
    const registry = createCartAddRegistry(1000);
    registry.queueAdd(KEY_A, 4, () => Promise.reject(new Error("boom")));

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);

    expect(registry.pendingDelta(KEY_A)).toBe(0);
  });

  it("cancel() drops queued units before they are sent", async () => {
    const registry = createCartAddRegistry(1000);
    const run = vi.fn().mockResolvedValue(undefined);

    registry.queueAdd(KEY_A, 5, run);
    registry.cancel(KEY_A);
    await vi.advanceTimersByTimeAsync(5000);

    expect(run).not.toHaveBeenCalled();
    expect(registry.pendingDelta(KEY_A)).toBe(0);
  });

  it("cancel() leaves a call that is already on the wire alone", async () => {
    // The request is out; pretending otherwise would leave the local cart
    // disagreeing with a write the server is about to commit.
    let resolveRun!: () => void;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        })
    );
    const registry = createCartAddRegistry(1000);

    registry.queueAdd(KEY_A, 2, run);
    await vi.advanceTimersByTimeAsync(1000);
    registry.cancel(KEY_A);

    expect(registry.pendingDelta(KEY_A)).toBe(2);
    resolveRun();
    await vi.advanceTimersByTimeAsync(0);
    expect(registry.pendingDelta(KEY_A)).toBe(0);
  });

  it("cancel() is safe for a key with nothing queued", () => {
    const registry = createCartAddRegistry(1000);
    expect(() => registry.cancel("nothing-queued")).not.toThrow();
  });

  it("cancelAll() drops every queued delta — the clearCart case", async () => {
    const registry = createCartAddRegistry(1000);
    const run = vi.fn().mockResolvedValue(undefined);

    registry.queueAdd(KEY_A, 1, run);
    registry.queueAdd(KEY_B, 1, run);
    registry.cancelAll();
    await vi.advanceTimersByTimeAsync(5000);

    expect(run).not.toHaveBeenCalled();
  });

  it("flushAll() fires armed timers immediately and resolves after the calls settle", async () => {
    // Checkout awaits this. It must not open against a cart the server has not
    // caught up to.
    const settled: string[] = [];
    const registry = createCartAddRegistry(1000);
    const run = vi.fn(async (delta: number) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      settled.push(`ran:${delta}`);
    });

    registry.queueAdd(KEY_A, 2, run);
    registry.queueAdd(KEY_B, 3, run);

    const flushed = registry.flushAll().then(() => settled.push("flushed"));
    await vi.advanceTimersByTimeAsync(100);
    await flushed;

    expect(run).toHaveBeenCalledTimes(2);
    expect(settled).toEqual(["ran:2", "ran:3", "flushed"]);
    expect(registry.pendingDelta(KEY_A)).toBe(0);
  });

  it("flushAll() also waits for a call that was already in flight", async () => {
    const settled: string[] = [];
    const registry = createCartAddRegistry(1000);
    const run = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      settled.push("ran");
    });

    registry.queueAdd(KEY_A, 1, run);
    await vi.advanceTimersByTimeAsync(1000);

    const flushed = registry.flushAll().then(() => settled.push("flushed"));
    await vi.advanceTimersByTimeAsync(100);
    await flushed;

    expect(settled).toEqual(["ran", "flushed"]);
  });

  it("flushAll() resolves immediately when nothing is pending", async () => {
    const registry = createCartAddRegistry(1000);
    await expect(registry.flushAll()).resolves.toBeUndefined();
  });

  it("flushAll() resolves even when a call rejects", async () => {
    const registry = createCartAddRegistry(1000);
    registry.queueAdd(KEY_A, 1, () => Promise.reject(new Error("boom")));

    const flushed = registry.flushAll();
    await vi.advanceTimersByTimeAsync(0);

    await expect(flushed).resolves.toBeUndefined();
  });

  it("subscribe() fires when a delta changes, and stops after unsubscribing", async () => {
    // This is what drives the "Added N" counter through useSyncExternalStore.
    const registry = createCartAddRegistry(1000);
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);

    registry.queueAdd(KEY_A, 1, () => Promise.resolve());
    expect(listener).toHaveBeenCalled();

    const afterQueue = listener.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(listener.mock.calls.length).toBeGreaterThan(afterQueue);

    unsubscribe();
    const afterUnsubscribe = listener.mock.calls.length;
    registry.queueAdd(KEY_B, 1, () => Promise.resolve());
    expect(listener.mock.calls.length).toBe(afterUnsubscribe);
  });

  it("its methods survive being passed as bare function references", () => {
    // `subscribe` and `isPending` are handed to useSyncExternalStore and to
    // reconcileServerCart detached from the object, so nothing may read `this`.
    const registry = createCartAddRegistry(1000);
    const { isPending, pendingDelta, subscribe } = registry;

    registry.queueAdd(KEY_A, 2, () => Promise.resolve());

    expect(isPending(KEY_A)).toBe(true);
    expect(pendingDelta(KEY_A)).toBe(2);
    expect(() => subscribe(() => {})()).not.toThrow();
  });
});
