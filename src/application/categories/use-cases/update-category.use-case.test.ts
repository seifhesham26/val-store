import { describe, it, expect, vi } from "vitest";
import { UpdateCategoryUseCase } from "./update-category.use-case";
import { CategoryEntity } from "@/domain/categories/entities/category.entity";
import type { CategoryRepositoryInterface } from "@/domain/categories/interfaces/repositories/category.repository.interface";

function category(
  over: Partial<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
    imageUrl: string | null;
    displayOrder: number;
    isActive: boolean;
  }> = {}
): CategoryEntity {
  return new CategoryEntity(
    over.id ?? "cat-a",
    over.name ?? "Category A",
    over.slug ?? "category-a",
    over.description ?? null,
    over.parentId ?? null,
    over.imageUrl ?? null,
    over.displayOrder ?? 0,
    over.isActive ?? true,
    new Date(),
    new Date()
  );
}

function repo(rows: CategoryEntity[]): CategoryRepositoryInterface {
  return {
    findById: vi.fn(
      async (id: string) => rows.find((c) => c.id === id) ?? null
    ),
    findBySlug: vi.fn(
      async (slug: string) => rows.find((c) => c.slug === slug) ?? null
    ),
    findByIds: vi.fn(),
    findAll: vi.fn(async () => rows),
    findTopLevel: vi.fn(),
    findByParentId: vi.fn(),
    findActive: vi.fn(),
    create: vi.fn(),
    update: vi.fn(async (c: CategoryEntity) => c),
    delete: vi.fn(),
    existsBySlug: vi.fn(),
    getHierarchy: vi.fn(),
    count: vi.fn(),
    countProductsByCategory: vi.fn(),
    countProducts: vi.fn(),
    countChildrenByCategory: vi.fn(),
  } as unknown as CategoryRepositoryInterface;
}

describe("UpdateCategoryUseCase — cycle guard", () => {
  it("rejects a category becoming its own direct parent", async () => {
    const repository = repo([category({ id: "a", slug: "a" })]);

    await expect(
      new UpdateCategoryUseCase(repository).execute({
        id: "a",
        data: { parentId: "a" },
      })
    ).rejects.toThrow(/own parent/i);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("rejects a multi-level cycle: A is root, B's parent is A, C's parent is B, then A's parent is set to C", async () => {
    // A -> B -> C going down the tree (A is B's parent, B is C's parent).
    // Setting A's parent to C — A's own grandchild — closes the loop.
    const a = category({ id: "a", slug: "a", parentId: null });
    const b = category({ id: "b", slug: "b", parentId: "a" });
    const c = category({ id: "c", slug: "c", parentId: "b" });
    const repository = repo([a, b, c]);

    await expect(
      new UpdateCategoryUseCase(repository).execute({
        id: "a",
        data: { parentId: "c" },
      })
    ).rejects.toThrow(/descendant of itself/i);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("allows a valid reparenting onto an unrelated category", async () => {
    const a = category({ id: "a", slug: "a", parentId: null });
    const b = category({ id: "b", slug: "b", parentId: null });
    const repository = repo([a, b]);

    await new UpdateCategoryUseCase(repository).execute({
      id: "a",
      data: { parentId: "b" },
    });

    expect(repository.update).toHaveBeenCalled();
  });

  it("does not walk ancestors when parentId is not part of the edit", async () => {
    const a = category({ id: "a", slug: "a", parentId: "b" });
    const b = category({ id: "b", slug: "b", parentId: null });
    const repository = repo([a, b]);

    await new UpdateCategoryUseCase(repository).execute({
      id: "a",
      data: { name: "Renamed" },
    });

    expect(repository.findAll).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalled();
  });

  it("does not walk ancestors when parentId is set to its current value", async () => {
    const a = category({ id: "a", slug: "a", parentId: "b" });
    const b = category({ id: "b", slug: "b", parentId: null });
    const repository = repo([a, b]);

    await new UpdateCategoryUseCase(repository).execute({
      id: "a",
      data: { parentId: "b" },
    });

    expect(repository.findAll).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalled();
  });

  it("terminates instead of looping forever on data that is already cyclic", async () => {
    // x <-> y already form a cycle unrelated to z (data that slipped past a
    // previous guard, or was written by hand). Reparenting z onto x must
    // still finish rather than loop until the stack — or the test — hangs.
    const x = category({ id: "x", slug: "x", parentId: "y" });
    const y = category({ id: "y", slug: "y", parentId: "x" });
    const z = category({ id: "z", slug: "z", parentId: null });
    const repository = repo([x, y, z]);

    await new UpdateCategoryUseCase(repository).execute({
      id: "z",
      data: { parentId: "x" },
    });

    expect(repository.update).toHaveBeenCalled();
  });

  it("clearing a parent (setting it to null) never triggers the walk", async () => {
    const a = category({ id: "a", slug: "a", parentId: "b" });
    const b = category({ id: "b", slug: "b", parentId: null });
    const repository = repo([a, b]);

    await new UpdateCategoryUseCase(repository).execute({
      id: "a",
      data: { parentId: null },
    });

    expect(repository.findAll).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalled();
  });

  it("throws for a category that does not exist", async () => {
    const repository = repo([]);

    await expect(
      new UpdateCategoryUseCase(repository).execute({
        id: "missing",
        data: { name: "X" },
      })
    ).rejects.toThrow();
  });
});
