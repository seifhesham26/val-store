import { describe, it, expect } from "vitest";
import { createVariantStockRegistry } from "./variant-stock-registry";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const C = "cccccccc-0000-0000-0000-000000000003";

describe("createVariantStockRegistry", () => {
  it("starts empty", () => {
    const r = createVariantStockRegistry();
    expect(r.tracked()).toEqual([]);
    expect(r.size()).toBe(0);
  });

  it("unions ids across cards instead of keeping them separate", () => {
    // The entire point: twelve cards must produce one id set, not twelve
    // queries.
    const r = createVariantStockRegistry();
    r.register([A, B]);
    r.register([B, C]);
    expect(r.tracked()).toEqual([A, B, C]);
  });

  it("returns ids sorted, so render order does not change the query key", () => {
    const r1 = createVariantStockRegistry();
    r1.register([C, A, B]);

    const r2 = createVariantStockRegistry();
    r2.register([A, B, C]);

    expect(r1.tracked()).toEqual(r2.tracked());
  });

  it("keeps an id that a second card still needs", () => {
    // Ref-counting is what makes unmounting safe during infinite scroll.
    const r = createVariantStockRegistry();
    const releaseFirst = r.register([A, B]);
    r.register([B]);

    releaseFirst();

    expect(r.tracked()).toEqual([B]);
  });

  it("drops an id once every holder has released it", () => {
    const r = createVariantStockRegistry();
    const one = r.register([A]);
    const two = r.register([A]);

    one();
    expect(r.tracked()).toEqual([A]);

    two();
    expect(r.tracked()).toEqual([]);
  });

  it("ignores a repeated release", () => {
    // React can run an effect cleanup more than once in development; a second
    // call must not decrement an id another card is still holding.
    const r = createVariantStockRegistry();
    const release = r.register([A]);
    r.register([A]);

    release();
    release();
    release();

    expect(r.tracked()).toEqual([A]);
  });

  it("deduplicates within a single registration", () => {
    // One disposer must fully release what one call registered.
    const r = createVariantStockRegistry();
    const release = r.register([A, A, A]);
    expect(r.size()).toBe(1);

    release();
    expect(r.tracked()).toEqual([]);
  });

  it("skips empty ids", () => {
    const r = createVariantStockRegistry();
    r.register(["", A]);
    expect(r.tracked()).toEqual([A]);
  });

  it("caps the tracked set at the query input limit", () => {
    // getStock accepts at most 500 ids; exceeding it would make the request
    // fail outright, which is worse than some cards falling back to the
    // inStock flag they were rendered with.
    const r = createVariantStockRegistry(3);
    r.register([A, B, C, "dddddddd-0000-0000-0000-000000000004"]);

    expect(r.tracked()).toHaveLength(3);
    expect(r.size()).toBe(4);
  });

  it("caps deterministically, so the query key is stable", () => {
    const ids = [A, B, C];
    const r1 = createVariantStockRegistry(2);
    r1.register(ids);
    const r2 = createVariantStockRegistry(2);
    r2.register([...ids].reverse());

    expect(r1.tracked()).toEqual(r2.tracked());
  });

  it("survives a full mount/unmount cycle back to empty", () => {
    // A customer scrolling a grid and navigating away must not leave the
    // shared query polling for stock nobody is showing.
    const r = createVariantStockRegistry();
    const releases = [
      r.register([A, B]),
      r.register([B, C]),
      r.register([A, C]),
    ];
    expect(r.tracked()).toEqual([A, B, C]);

    releases.forEach((release) => release());
    expect(r.tracked()).toEqual([]);
    expect(r.size()).toBe(0);
  });
});
