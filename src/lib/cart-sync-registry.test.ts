import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createCartSyncRegistry,
  reconcileServerCart,
  type PendingCartWrites,
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

  it("flushAll() fires an armed timer immediately and waits for the write", async () => {
    const settled: string[] = [];
    const registry = createCartSyncRegistry(1000);
    const run = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      settled.push("ran");
    });

    registry.scheduleUpdate(ITEM_A, run);
    const flushed = registry.flushAll().then(() => settled.push("flushed"));
    await vi.advanceTimersByTimeAsync(100);
    await flushed;

    expect(run).toHaveBeenCalledTimes(1);
    expect(settled).toEqual(["ran", "flushed"]);
    expect(registry.isPending(ITEM_A)).toBe(false);
  });

  it("flushAll() waits for a write that had already fired", async () => {
    const settled: string[] = [];
    const registry = createCartSyncRegistry(1000);
    const run = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      settled.push("ran");
    });

    registry.scheduleUpdate(ITEM_A, run);
    await vi.advanceTimersByTimeAsync(1000);

    const flushed = registry.flushAll().then(() => settled.push("flushed"));
    await vi.advanceTimersByTimeAsync(100);
    await flushed;

    expect(settled).toEqual(["ran", "flushed"]);
  });

  it("flushAll() resolves immediately when nothing is pending", async () => {
    const registry = createCartSyncRegistry(1000);
    await expect(registry.flushAll()).resolves.toBeUndefined();
  });

  it("flushAll() resolves even when a write rejects", async () => {
    const registry = createCartSyncRegistry(1000);
    registry.scheduleUpdate(ITEM_A, () => Promise.reject(new Error("boom")));

    const flushed = registry.flushAll();
    await vi.advanceTimersByTimeAsync(0);

    await expect(flushed).resolves.toBeUndefined();
  });
});

describe("reconcileServerCart", () => {
  const PRODUCT = "product-1";
  const VARIANT = "variant-1";
  const KEY = `${PRODUCT}:${VARIANT}`;

  function line(
    id: string,
    quantity: number,
    variantId: string | null = VARIANT
  ) {
    return { id, productId: PRODUCT, variantId, quantity };
  }

  function pendingWrites(
    overrides: Partial<PendingCartWrites> = {}
  ): PendingCartWrites {
    return {
      isPendingItem: () => false,
      isPendingAdd: () => false,
      ...overrides,
    };
  }

  it("replaces a non-pending line with the server's value", () => {
    const server = [line(ITEM_A, 5)];
    const local = [line(ITEM_A, 1)];

    expect(reconcileServerCart(server, local, pendingWrites())).toEqual([
      line(ITEM_A, 5),
    ]);
  });

  it("keeps the local value for a line with a quantity edit in flight", () => {
    const pending = pendingWrites({ isPendingItem: (id) => id === ITEM_A });

    // The server still reflects the pre-edit quantity; the customer's
    // optimistic edit must survive this refetch.
    expect(
      reconcileServerCart([line(ITEM_A, 1)], [line(ITEM_A, 3)], pending)
    ).toEqual([line(ITEM_A, 3)]);
  });

  it("keeps the local value for a line with an add still queued", () => {
    // Two on the server, five locally, three still waiting on the debounce.
    // Matching only on cart item id would stamp the line back to two.
    const pending = pendingWrites({ isPendingAdd: (key) => key === KEY });

    expect(
      reconcileServerCart([line(ITEM_A, 2)], [line(ITEM_A, 5)], pending)
    ).toEqual([line(ITEM_A, 5)]);
  });

  it("carries through a local-only line whose add has not landed yet", () => {
    // The just-added case. Without this the new line vanishes on the next
    // unrelated refetch and reappears a second later.
    const pending = pendingWrites({ isPendingAdd: (key) => key === KEY });
    const local = [line("pending-abc", 1)];

    expect(reconcileServerCart([], local, pending)).toEqual(local);
  });

  it("drops a local-only line once its add has settled", () => {
    // Nothing pending and no server row means the add failed or was rolled
    // back. Keeping it would show the customer a line the server never has.
    const local = [line("pending-abc", 1)];
    expect(reconcileServerCart([], local, pendingWrites())).toEqual([]);
  });

  it("does not duplicate a line whose server row has arrived", () => {
    // The local copy still carries its `pending-` id while the server row
    // carries a uuid. Keyed on product+variant, they are one line.
    const pending = pendingWrites({ isPendingAdd: (key) => key === KEY });
    const server = [line(ITEM_A, 3)];
    const local = [line("pending-abc", 3)];

    expect(reconcileServerCart(server, local, pending)).toEqual([
      line("pending-abc", 3),
    ]);
  });

  it("only protects the pending line, not the rest of the cart", () => {
    const pending = pendingWrites({ isPendingItem: (id) => id === ITEM_A });
    const server = [line(ITEM_A, 1), line(ITEM_B, 9, "variant-2")];
    const local = [line(ITEM_A, 3), line(ITEM_B, 2, "variant-2")];

    expect(reconcileServerCart(server, local, pending)).toEqual([
      line(ITEM_A, 3),
      line(ITEM_B, 9, "variant-2"),
    ]);
  });

  it("falls back to the server value if a pending line has no local match", () => {
    const pending = pendingWrites({ isPendingItem: (id) => id === ITEM_A });
    expect(reconcileServerCart([line(ITEM_A, 1)], [], pending)).toEqual([
      line(ITEM_A, 1),
    ]);
  });

  it("keeps an untouched guest line out of the way", () => {
    // A guest line has no server row and no pending add — the merge effect
    // owns it, not this function.
    const local = [line("guest-abc", 2)];
    expect(reconcileServerCart([], local, pendingWrites())).toEqual([]);
  });
});
