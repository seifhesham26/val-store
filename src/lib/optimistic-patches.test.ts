import { describe, it, expect, vi } from "vitest";
import { cachePatch, runOptimistic } from "./optimistic-patches";

/** A stand-in for one tRPC query cache entry. */
function fakeCache<T>(initial: T | undefined, log: string[], name: string) {
  let value = initial;
  return {
    get value() {
      return value;
    },
    spec: {
      cancel: async () => {
        log.push(`cancel:${name}`);
      },
      read: () => value,
      write: (next: T | undefined) => {
        log.push(`write:${name}`);
        value = next;
      },
      invalidate: () => {
        log.push(`invalidate:${name}`);
      },
    },
  };
}

describe("cachePatch", () => {
  it("writes the patched value and restores the exact snapshot on rollback", () => {
    const log: string[] = [];
    const cache = fakeCache([1, 2, 3], log, "a");
    const patch = cachePatch({
      ...cache.spec,
      patch: (items) => items?.filter((n) => n !== 2),
    });

    patch.apply();
    expect(cache.value).toEqual([1, 3]);

    patch.rollback();
    expect(cache.value).toEqual([1, 2, 3]);
  });

  it("rollback before apply is a no-op — nothing was snapshotted", () => {
    const log: string[] = [];
    const cache = fakeCache("original", log, "a");
    const patch = cachePatch({ ...cache.spec, patch: () => "patched" });

    patch.rollback();

    expect(cache.value).toBe("original");
    expect(log).not.toContain("write:a");
  });

  it("rolling back twice restores the same snapshot, not the patched value", () => {
    const log: string[] = [];
    const cache = fakeCache(5, log, "a");
    const patch = cachePatch({ ...cache.spec, patch: (n) => (n ?? 0) + 1 });

    patch.apply();
    patch.rollback();
    patch.rollback();

    expect(cache.value).toBe(5);
  });

  it("handles an empty cache — patch sees undefined", () => {
    const log: string[] = [];
    const cache = fakeCache<number[]>(undefined, log, "a");
    const seen: unknown[] = [];
    const patch = cachePatch({
      ...cache.spec,
      patch: (items) => {
        seen.push(items);
        return items;
      },
    });

    patch.apply();
    expect(seen).toEqual([undefined]);
  });
});

describe("runOptimistic", () => {
  it("cancels every patch before applying any of them", async () => {
    // An in-flight refetch that resolves after setData would overwrite the
    // optimistic value, so every cancel must precede every write.
    const log: string[] = [];
    const a = fakeCache(1, log, "a");
    const b = fakeCache(2, log, "b");

    await runOptimistic([
      cachePatch({ ...a.spec, patch: (n) => (n ?? 0) + 10 }),
      cachePatch({ ...b.spec, patch: (n) => (n ?? 0) + 10 }),
    ]);

    expect(log).toEqual(["cancel:a", "cancel:b", "write:a", "write:b"]);
  });

  it("rollback restores every patch, in reverse order", async () => {
    const log: string[] = [];
    const a = fakeCache(1, log, "a");
    const b = fakeCache(2, log, "b");

    const handle = await runOptimistic([
      cachePatch({ ...a.spec, patch: () => 99 }),
      cachePatch({ ...b.spec, patch: () => 99 }),
    ]);
    log.length = 0;
    handle.rollback();

    expect(a.value).toBe(1);
    expect(b.value).toBe(2);
    expect(log).toEqual(["write:b", "write:a"]);
  });

  it("settle invalidates every patch", async () => {
    const log: string[] = [];
    const a = fakeCache(1, log, "a");
    const b = fakeCache(2, log, "b");

    const handle = await runOptimistic([
      cachePatch({ ...a.spec, patch: () => 99 }),
      cachePatch({ ...b.spec, patch: () => 99 }),
    ]);
    log.length = 0;
    handle.settle();

    expect(log).toEqual(["invalidate:a", "invalidate:b"]);
  });

  it("an empty patch list is legal", async () => {
    const handle = await runOptimistic([]);
    expect(() => handle.rollback()).not.toThrow();
    expect(() => handle.settle()).not.toThrow();
  });

  it("awaits asynchronous cancels", async () => {
    const order: string[] = [];
    const slowCancel = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push("cancelled");
    });

    await runOptimistic([
      cachePatch({
        cancel: slowCancel,
        read: () => 1,
        write: () => order.push("written"),
        invalidate: () => {},
        patch: () => 2,
      }),
    ]);

    expect(order).toEqual(["cancelled", "written"]);
  });
});
