import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag }));

import { revalidateCatalogue } from "./revalidate-catalogue";

describe("revalidateCatalogue", () => {
  beforeEach(() => {
    revalidateTag.mockClear();
  });

  it("expires product cards, lists, and category product counts", () => {
    revalidateCatalogue();

    expect(revalidateTag.mock.calls).toEqual([
      ["featured-products", "max"],
      ["all-products", "max"],
      ["categories", "max"],
    ]);
  });
});
