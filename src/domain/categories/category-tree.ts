/**
 * Category tree traversal.
 *
 * A collection page for a parent category showed nothing. Every product in
 * this catalogue sits in a *leaf* category — "Dresses", "Skirts", "Tops" —
 * while the navigation links to their parent, "Women". The product filter is
 * an equality on `products.category_id`, so `/collections/women` matched the
 * zero products filed directly against the parent rather than the thirteen
 * filed against its children.
 *
 * That is a property of the shape of the data, not of any particular seed:
 * any store with a two-level menu has it. So a category resolves to *itself
 * plus everything beneath it*, and the filter matches the set.
 *
 * Framework-free and pure so it can be tested without a database — the whole
 * of the traversal lives here and the repository only supplies rows.
 */

/** The minimum a row needs for the traversal; entities and DTOs both satisfy it. */
export interface CategoryNode {
  id: string;
  parentId: string | null;
}

/**
 * `rootId` and every category beneath it, breadth-first, `rootId` first.
 *
 * Returns `[rootId]` when the category has no children, so a caller can always
 * use the result as the filter set without special-casing leaves.
 *
 * `categories.parent_id` has no foreign key, so the data can contain a cycle
 * (a category adopted as its own descendant) or an id pointing at a row that
 * no longer exists. Both are survivable here: a node is expanded at most once,
 * which terminates on a cycle, and a dangling parent simply never matches.
 */
export function collectCategoryTree(
  categories: readonly CategoryNode[],
  rootId: string
): string[] {
  const childrenByParent = new Map<string, string[]>();

  for (const category of categories) {
    if (!category.parentId) continue;
    const siblings = childrenByParent.get(category.parentId);
    if (siblings) {
      siblings.push(category.id);
    } else {
      childrenByParent.set(category.parentId, [category.id]);
    }
  }

  const collected: string[] = [];
  const seen = new Set<string>();
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const id = queue.shift() as string;

    // The cycle guard. Without it a category whose parent is one of its own
    // descendants queues forever.
    if (seen.has(id)) continue;
    seen.add(id);
    collected.push(id);

    const children = childrenByParent.get(id);
    if (children) queue.push(...children);
  }

  return collected;
}
