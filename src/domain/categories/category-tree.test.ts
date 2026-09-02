import { describe, it, expect } from "vitest";
import { collectCategoryTree, type CategoryNode } from "./category-tree";

/**
 * The shape this exists for: the real catalogue's two-level menu, where every
 * product is filed against a leaf and every nav link points at a parent.
 */
const CATALOGUE: CategoryNode[] = [
  { id: "women", parentId: null },
  { id: "women-dresses", parentId: "women" },
  { id: "women-skirts", parentId: "women" },
  { id: "women-tops", parentId: "women" },
  { id: "men", parentId: null },
  { id: "men-shirts", parentId: "men" },
  { id: "accessories", parentId: null },
];

describe("collectCategoryTree", () => {
  it("includes the root itself first", () => {
    expect(collectCategoryTree(CATALOGUE, "women")[0]).toBe("women");
  });

  it("collects a parent's children — the bug that emptied /collections/women", () => {
    expect(collectCategoryTree(CATALOGUE, "women").sort()).toEqual(
      ["women", "women-dresses", "women-skirts", "women-tops"].sort()
    );
  });

  it("returns a lone id for a leaf, so callers never special-case it", () => {
    expect(collectCategoryTree(CATALOGUE, "women-skirts")).toEqual([
      "women-skirts",
    ]);
  });

  it("returns a lone id for a childless top-level category", () => {
    expect(collectCategoryTree(CATALOGUE, "accessories")).toEqual([
      "accessories",
    ]);
  });

  it("does not leak between sibling trees", () => {
    expect(collectCategoryTree(CATALOGUE, "men")).not.toContain(
      "women-dresses"
    );
  });

  it("collects grandchildren, not just direct children", () => {
    const deep: CategoryNode[] = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "b" },
    ];
    expect(collectCategoryTree(deep, "a").sort()).toEqual(["a", "b", "c"]);
  });

  it("terminates on a cycle rather than hanging", () => {
    // Reachable: `categories.parent_id` has no FK constraint, so nothing in
    // the database stops a category being made its own ancestor.
    const cyclic: CategoryNode[] = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];
    expect(collectCategoryTree(cyclic, "a").sort()).toEqual(["a", "b"]);
  });

  it("tolerates a parent id pointing at a row that is gone", () => {
    const orphaned: CategoryNode[] = [{ id: "child", parentId: "deleted" }];
    expect(collectCategoryTree(orphaned, "child")).toEqual(["child"]);
  });

  it("returns the root even when it is not in the list", () => {
    expect(collectCategoryTree([], "unknown")).toEqual(["unknown"]);
  });
});
