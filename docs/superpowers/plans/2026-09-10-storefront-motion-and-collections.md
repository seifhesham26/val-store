# Storefront Motion System + Collections Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead space from the four collection surfaces with a full-bleed editorial banner, a working filter/sort toolbar and a denser grid, and introduce a storefront-wide motion system in which no two elements ever animate their entrance at the same time.

**Architecture:** Three motion layers with a strict division of labour — CSS owns hover/loops/reduced-motion, a single global GSAP timeline ("the conductor") owns entrance choreography and enforces the one-actor-at-a-time law, and Framer Motion (`LazyMotion` + `m`, scoped to the product grid only) owns exit and reorder because CSS cannot animate a node that has already left the DOM. Collections gain a shared `CollectionBanner` + `CollectionToolbar` used by all five collection routes.

**Tech Stack:** Next.js 16 App Router, React 19 + React Compiler, TypeScript strict, Tailwind 4, GSAP + `@gsap/react`, `motion` (Framer Motion), tRPC v11, Drizzle, Vitest (jsdom).

**Spec:** `docs/superpowers/specs/2026-09-10-storefront-motion-and-collections-design.md`

## Global Constraints

- **Admin is not touched.** No file under `src/app/admin/` or `src/components/admin/` is modified by any task in this plan.
- **The Timeline Law:** at any instant, at most one element performs an entrance. Exceptions, deliberate: continuous loops (loader orbit, card crossfade), hover/interaction states, and group exits.
- **`BEAT_MS = 90`, `SLOT_DURATION_MS = 80`, `MAX_QUEUE_MS = 1440`.** Duration is strictly less than beat; that gap is what makes the law hold.
- **`val-*` colour tokens are never rewritten.** `--val-accent`, `--val-accent-light`, `--val-silver`, `--val-steel` are committed design system.
- **Portalled Radix surfaces set both token halves** — `bg-popover text-popover-foreground`, never a background alone. A background alone renders white-on-white.
- **Every paginated `orderBy` appends `desc(products.id)`.** Without the tiebreaker, paging duplicates and skips rows.
- **Every new animation registers in the `prefers-reduced-motion` block** in `src/app/globals.css`.
- **Prettier:** double quotes, semicolons, 80 cols, es5 trailing commas, LF.
- **Clear `.next` before trusting `pnpm type-check`:** `rm -rf .next && pnpm type-check`.
- **Commits:** conventional, restricted type-enum, **sentence-case subject**, no trailing period, ≤100 chars.
- Verification for every task: `pnpm lint && pnpm type-check && pnpm test`.

---

## File Structure

**Created:**

| File                                                      | Responsibility                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/lib/motion/conductor.ts`                             | The Timeline Law engine. Pure scheduling: grants exclusive slots, drains past the queue cap. No DOM, no React. |
| `src/lib/motion/conductor.test.ts`                        | Proves the law: no two slots overlap, ever.                                                                    |
| `src/lib/collection-sort.ts`                              | Sort option ↔ URL param ↔ repository order. Pure.                                                              |
| `src/lib/collection-sort.test.ts`                         | Round-trip and fallback coverage.                                                                              |
| `src/hooks/use-reveal.ts`                                 | React binding: IntersectionObserver → conductor → GSAP timeline.                                               |
| `src/components/collections/CollectionBanner.tsx`         | Scrim-split banner. Server component.                                                                          |
| `src/components/collections/collection-banner-content.ts` | Per-route banner copy and image, one config object.                                                            |
| `src/components/collections/CollectionToolbar.tsx`        | Sticky filter chips + count + sort. Client.                                                                    |
| `src/components/collections/CollectionMosaic.tsx`         | Bento tiles for `/collections`.                                                                                |
| `src/components/products/ProductGridItems.tsx`            | Framer Motion exit/reorder wrapper around the card list.                                                       |

**Modified:** `src/app/globals.css`, `src/components/products/InfiniteProductGrid.tsx`, `src/components/products/CollectionGridSkeleton.tsx`, `src/components/products/ProductCard.tsx`, `src/components/ui/valkyrie-loader.tsx`, `src/components/ui/spinner.tsx`, `src/app/(main)/collections/page.tsx`, `src/app/(main)/collections/{all,new,sale}/page.tsx`, `src/app/(main)/collections/[slug]/page.tsx`, `src/domain/products/interfaces/repositories/product.repository.interface.ts`, `src/infrastructure/database/repositories/products/product.repository.ts`, `src/server/routers/public/products.ts`, `src/lib/cache.ts`, plus the storefront loader-sweep files listed in Task 9.

**Deleted:** `src/components/collections/CollectionsHeader.tsx`, `src/components/collections/BrowseAllBanner.tsx`.

---

## Task 1: Motion dependencies and CSS tokens

**Files:**

- Modify: `package.json` (via pnpm)
- Modify: `src/app/globals.css` (append after the existing `prefers-reduced-motion` block, around line 285)

**Interfaces:**

- Consumes: nothing.
- Produces: CSS classes `.val-reveal` (initial hidden state) and `.val-reveal--shown` (final state), consumed by Task 3 and every component from Task 5 onward. Packages `gsap`, `@gsap/react`, `motion` available to import.

- [ ] **Step 1: Install the three motion packages**

```bash
pnpm add gsap @gsap/react motion
```

- [ ] **Step 2: Verify they resolve and nothing else broke**

Run: `pnpm type-check`
Expected: PASS (run `rm -rf .next` first if it reports errors about routes that do not exist).

- [ ] **Step 3: Add the reveal tokens to globals.css**

Append this block to `src/app/globals.css`, immediately after the closing `}` of the existing `@media (prefers-reduced-motion: reduce)` block:

```css
/* ---------------------------------------------------------------------------
 * Valkyrie motion system
 *
 * Entrance choreography is granted by the conductor (`src/lib/motion/conductor.ts`)
 * and played by GSAP, which sets inline styles. These classes only establish the
 * pre-animation state so an element is not visible before its slot arrives, and
 * the post-animation state for elements the conductor drains rather than plays.
 *
 * `.val-reveal` must never animate on its own. If it did, two elements could be
 * in motion at once, which is the one thing the whole system exists to prevent.
 * ------------------------------------------------------------------------- */

@layer components {
  .val-reveal {
    opacity: 0;
    transform: translateY(16px);
    will-change: opacity, transform;
  }

  .val-reveal--shown {
    opacity: 1;
    transform: none;
    will-change: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .val-reveal {
    opacity: 1;
    transform: none;
  }
}
```

- [ ] **Step 4: Verify the build is clean**

Run: `pnpm lint && pnpm type-check`
Expected: PASS, 0 problems.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/app/globals.css
git commit -m "feat(motion): Add gsap, framer motion and reveal state tokens"
```

---

## Task 2: The conductor — enforcing the Timeline Law

**Files:**

- Create: `src/lib/motion/conductor.ts`
- Test: `src/lib/motion/conductor.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `export const BEAT_MS = 90`
  - `export const SLOT_DURATION_MS = 80`
  - `export const MAX_QUEUE_MS = 1440`
  - `export interface Slot { startMs: number; durationMs: number }`
  - `export interface ScheduleResult { slots: Slot[]; drainedCount: number }`
  - `export function enqueue(count: number, now: number, reducedMotion?: boolean): ScheduleResult`
  - `export function resetConductor(): void`

`startMs` is **relative to `now`**, so a caller can hand it straight to a GSAP timeline position. `drainedCount` is how many trailing elements the caller must show instantly with no animation.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/motion/conductor.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/motion/conductor.test.ts`
Expected: FAIL — `Failed to resolve import "./conductor"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/motion/conductor.ts`:

```ts
/**
 * The conductor — the Timeline Law, in one place.
 *
 * > At any instant, at most one element performs an entrance.
 *
 * Components do not animate themselves. They ask for slots and the conductor
 * grants each one an exclusive window on a single shared timeline, so a section
 * scrolling into view while another is still playing queues behind it rather
 * than doubling up.
 *
 * `SLOT_DURATION_MS` is strictly less than `BEAT_MS`. That 10ms gap is the
 * whole mechanism: element N has finished before element N+1 begins. Raising
 * the duration to meet the beat would technically satisfy "no overlap" while
 * making a dropped frame enough to break it.
 *
 * Deliberately exempt, documented in the spec: continuous loops (the loader's
 * orbit, the product card crossfade), hover states, and group exits.
 */

/** Distance between the start of one element's entrance and the next. */
export const BEAT_MS = 90;

/** How long a single entrance runs. Strictly less than `BEAT_MS`. */
export const SLOT_DURATION_MS = 80;

/**
 * How far into the future a slot may be granted, ~16 beats.
 *
 * Past this the conductor stops animating and shows the rest instantly. A grid
 * of 40 products sequenced end to end would take 3.6s to finish appearing,
 * which reads as a stall rather than as choreography.
 */
export const MAX_QUEUE_MS = 1440;

export interface Slot {
  /** Offset from the `now` passed to `enqueue`, in milliseconds. */
  startMs: number;
  durationMs: number;
}

export interface ScheduleResult {
  /** Elements that animate, in the order they were requested. */
  slots: Slot[];
  /**
   * Trailing elements the caller must reveal instantly, with no animation.
   * An element that is simply shown is not animating, so the law still holds.
   */
  drainedCount: number;
}

/** Absolute timestamp at which the shared timeline is next free. */
let queueFreeAt = 0;

/**
 * Claim `count` consecutive exclusive slots.
 *
 * `now` is injected rather than read from `performance.now()` so the law is
 * testable without fake timers.
 */
export function enqueue(
  count: number,
  now: number,
  reducedMotion = false
): ScheduleResult {
  if (count <= 0) {
    return { slots: [], drainedCount: 0 };
  }

  // Nothing animates, so nothing occupies the timeline — leaving `queueFreeAt`
  // untouched keeps a later caller (a user who re-enables motion mid-session)
  // from waiting behind a run that never played.
  if (reducedMotion) {
    return { slots: [], drainedCount: count };
  }

  const base = Math.max(now, queueFreeAt);
  const slots: Slot[] = [];

  for (let i = 0; i < count; i++) {
    const startMs = base - now + i * BEAT_MS;
    if (startMs > MAX_QUEUE_MS) break;
    slots.push({ startMs, durationMs: SLOT_DURATION_MS });
  }

  queueFreeAt = base + slots.length * BEAT_MS;

  return { slots, drainedCount: count - slots.length };
}

/** Test seam, and a hard reset on route change. */
export function resetConductor(): void {
  queueFreeAt = 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/motion/conductor.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/motion/conductor.ts src/lib/motion/conductor.test.ts
git commit -m "feat(motion): Add conductor enforcing one entrance at a time"
```

---

## Task 3: The reveal hook

**Files:**

- Create: `src/hooks/use-reveal.ts`

**Interfaces:**

- Consumes: `enqueue`, `SLOT_DURATION_MS` from `@/lib/motion/conductor`; `usePrefersReducedMotion` from `@/hooks/use-prefers-reduced-motion` (already exists).
- Produces: `export function useReveal<T extends HTMLElement>(): React.RefObject<T | null>`

Attach the returned ref to a container. Every descendant carrying `data-reveal` is
revealed in DOM order, one at a time, when the container first intersects the viewport.

- [ ] **Step 1: Write the hook**

Create `src/hooks/use-reveal.ts`:

```ts
"use client";

/**
 * Reveal every `[data-reveal]` descendant of a container, one at a time.
 *
 * The hook does not decide timing — `conductor.enqueue` does, so a section that
 * scrolls into view while another is still playing queues behind rather than
 * animating over it.
 *
 * `useGSAP` rather than a bare `useEffect`: it scopes the timeline to the ref
 * and reverts it on unmount. Without that, navigating away mid-animation leaves
 * a live tween writing inline styles to detached nodes.
 */

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SLOT_DURATION_MS, enqueue } from "@/lib/motion/conductor";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/** Shown instantly, no tween — used for drained elements and reduced motion. */
function showNow(elements: Element[]) {
  for (const el of elements) {
    el.classList.add("val-reveal--shown");
  }
}

export function useReveal<T extends HTMLElement>() {
  const containerRef = useRef<T | null>(null);
  const playedRef = useRef(false);
  const reducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      const container = containerRef.current;
      if (!container || playedRef.current) return;

      const play = () => {
        if (playedRef.current) return;
        playedRef.current = true;

        const targets = Array.from(
          container.querySelectorAll<HTMLElement>("[data-reveal]")
        );
        if (targets.length === 0) return;

        const { slots, drainedCount } = enqueue(
          targets.length,
          performance.now(),
          reducedMotion
        );

        showNow(targets.slice(targets.length - drainedCount));

        if (slots.length === 0) return;

        const timeline = gsap.timeline();
        slots.forEach((slot, i) => {
          timeline.to(
            targets[i],
            {
              opacity: 1,
              y: 0,
              duration: slot.durationMs / 1000,
              ease: "power2.out",
              // Class stays in sync so a mid-flight unmount does not leave the
              // element stuck at opacity 0 when React remounts it.
              onComplete: () => targets[i].classList.add("val-reveal--shown"),
            },
            slot.startMs / 1000
          );
        });
      };

      if (reducedMotion) {
        play();
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            play();
          }
        },
        { rootMargin: "0px 0px -10% 0px" }
      );

      observer.observe(container);
      return () => observer.disconnect();
    },
    { scope: containerRef, dependencies: [reducedMotion] }
  );

  return containerRef;
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `rm -rf .next && pnpm type-check && pnpm lint`
Expected: PASS, 0 problems.

- [ ] **Step 3: Verify the existing suite still passes**

Run: `pnpm test`
Expected: PASS. Baseline before this plan was 670 tests across 57 files; Task 2 added 8, so expect **678**. (Note: `CLAUDE.md` claims 469/37 — that is stale, verified 2026-09-10.)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-reveal.ts
git commit -m "feat(motion): Add useReveal hook binding conductor slots to gsap"
```

---

## Task 4: Sort support, domain through router

**Files:**

- Create: `src/lib/collection-sort.ts`
- Test: `src/lib/collection-sort.test.ts`
- Modify: `src/domain/products/interfaces/repositories/product.repository.interface.ts` (the `ProductFilters` interface, around line 32)
- Modify: `src/infrastructure/database/repositories/products/product.repository.ts` (`findAll`, around line 68)
- Modify: `src/server/routers/public/products.ts` (the `list` procedure input and filters)

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `export type ProductSort = "newest" | "price-asc" | "price-desc" | "name"`
  - `export const PRODUCT_SORTS: readonly { value: ProductSort; label: string }[]`
  - `export const DEFAULT_PRODUCT_SORT: ProductSort`
  - `export function parseProductSort(raw: string | null | undefined): ProductSort`
  - `ProductFilters.sort?: ProductSort`
  - `public.products.list` accepts `sort`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/collection-sort.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCT_SORT,
  PRODUCT_SORTS,
  parseProductSort,
} from "./collection-sort";

describe("collection sort", () => {
  it("round-trips every advertised option", () => {
    for (const option of PRODUCT_SORTS) {
      expect(parseProductSort(option.value)).toBe(option.value);
    }
  });

  it("gives every option a human label", () => {
    for (const option of PRODUCT_SORTS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });

  it("falls back to the default for an unknown value", () => {
    expect(parseProductSort("price-sideways")).toBe(DEFAULT_PRODUCT_SORT);
  });

  it("falls back to the default for null and undefined", () => {
    expect(parseProductSort(null)).toBe(DEFAULT_PRODUCT_SORT);
    expect(parseProductSort(undefined)).toBe(DEFAULT_PRODUCT_SORT);
  });

  it("defaults to newest", () => {
    expect(DEFAULT_PRODUCT_SORT).toBe("newest");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/collection-sort.test.ts`
Expected: FAIL — cannot resolve `./collection-sort`.

- [ ] **Step 3: Write the sort module**

Create `src/lib/collection-sort.ts`:

```ts
/**
 * Collection sort options, in one place.
 *
 * The URL param, the dropdown labels and the repository's `ORDER BY` all read
 * from this list, so adding an option is one edit rather than three that can
 * disagree.
 */

export type ProductSort = "newest" | "price-asc" | "price-desc" | "name";

export const DEFAULT_PRODUCT_SORT: ProductSort = "newest";

export const PRODUCT_SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name", label: "Name: A to Z" },
] as const satisfies readonly { value: ProductSort; label: string }[];

const VALID = new Set<string>(PRODUCT_SORTS.map((option) => option.value));

/**
 * Anything unrecognised becomes the default rather than throwing — this parses
 * a query string a customer can type by hand.
 */
export function parseProductSort(raw: string | null | undefined): ProductSort {
  return raw && VALID.has(raw) ? (raw as ProductSort) : DEFAULT_PRODUCT_SORT;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/lib/collection-sort.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Add `sort` to `ProductFilters`**

In `src/domain/products/interfaces/repositories/product.repository.interface.ts`, add to the `ProductFilters` interface, after the `search` field:

```ts
  /**
   * Result ordering. Every branch appends the primary key as a tiebreaker —
   * `ORDER BY created_at DESC` alone is not a total order, and the seed writes
   * 35 products on one timestamp, which duplicated some products across pages
   * and skipped others.
   */
  sort?: ProductSort;
```

And add the import at the top of the file:

```ts
import type { ProductSort } from "@/lib/collection-sort";
```

- [ ] **Step 6: Make `findAll` honour it**

In `src/infrastructure/database/repositories/products/product.repository.ts`, add this module-level helper above the repository class:

```ts
/**
 * `ORDER BY` for a sort option.
 *
 * Two things are load-bearing. Every branch ends with `desc(products.id)`,
 * because a non-total order duplicates and skips rows across pages. And price
 * sorts on `COALESCE(sale_price, base_price)` rather than `base_price`, or a
 * discounted item sorts by a price nobody pays.
 *
 * Both columns belong to the query's root table, so Drizzle's relational-query
 * column rewriting is a no-op here.
 */
function orderForSort(sort: ProductSort | undefined) {
  const effectivePrice = sql`coalesce(${products.salePrice}, ${products.basePrice})`;

  switch (sort) {
    case "price-asc":
      return [asc(effectivePrice), desc(products.id)];
    case "price-desc":
      return [desc(effectivePrice), desc(products.id)];
    case "name":
      return [asc(products.name), desc(products.id)];
    case "newest":
    default:
      return [desc(products.createdAt), desc(products.id)];
  }
}
```

Add `asc` and `sql` to the existing `drizzle-orm` import, and `import type { ProductSort } from "@/lib/collection-sort";`.

Then in `findAll`, replace:

```ts
      orderBy: [desc(products.createdAt), desc(products.id)],
```

with:

```ts
      orderBy: orderForSort(filters?.sort),
```

Leave the `orderBy` at line ~103 (a different method) alone.

- [ ] **Step 7: Expose it on the router**

In `src/server/routers/public/products.ts`, add to the `list` input object, after `cursor`:

```ts
          sort: productSortSchema.optional(),
```

Above the router, add:

```ts
import { PRODUCT_SORTS, type ProductSort } from "@/lib/collection-sort";

/**
 * Mirrors `PRODUCT_SORTS` so the wire format cannot drift from the UI.
 * The cast preserves the literal union — a bare `string[]` would widen the
 * schema's output to `string` and force a cast at every consumer instead.
 */
const productSortSchema = z.enum(
  PRODUCT_SORTS.map((option) => option.value) as [ProductSort, ...ProductSort[]]
);
```

And add `sort: input?.sort,` to the `filters` object inside the `list` query, alongside `createdWithinDays`.

- [ ] **Step 8: Add integration coverage for the ordering**

Integration tests are **read-only by rule** — they assert the SQL the repository
emits agrees with the domain logic, and must stay safe to point at real data.

Append to `src/infrastructure/database/repositories/products/product.repository.integration.test.ts`, following the file's existing style and its summary logging:

```ts
describe("sort", () => {
  it("orders by effective price ascending, discounts included", async () => {
    const rows = await repo.findAll({ isActive: true, sort: "price-asc" });
    const effective = rows.map((p) => p.salePrice ?? p.basePrice);

    console.log(`[sort] price-asc over ${rows.length} products`);
    for (let i = 1; i < effective.length; i++) {
      expect(effective[i]).toBeGreaterThanOrEqual(effective[i - 1]);
    }
  });

  it("orders by name", async () => {
    const rows = await repo.findAll({ isActive: true, sort: "name" });
    const names = rows.map((p) => p.name);

    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  // The tiebreaker's reason for existing: the seed writes 35 products on one
  // timestamp, so a non-total order duplicates some and skips others.
  it.each(["newest", "price-asc", "price-desc", "name"] as const)(
    "pages without duplicates under %s",
    async (sort) => {
      const first = await repo.findAll({
        isActive: true,
        sort,
        limit: 12,
        offset: 0,
      });
      const second = await repo.findAll({
        isActive: true,
        sort,
        limit: 12,
        offset: 12,
      });

      const ids = [...first, ...second].map((p) => p.id);
      console.log(`[sort] ${sort}: ${ids.length} rows across 2 pages`);
      expect(new Set(ids).size).toBe(ids.length);
    }
  );
});
```

- [ ] **Step 9: Verify everything**

Run: `rm -rf .next && pnpm lint && pnpm type-check && pnpm test`
Expected: PASS. Test count now **683** (the integration additions do not run here).

Then, if a `DATABASE_URL` is available: `pnpm test:integration`
Expected: the six new cases pass. Baseline for the rest of that suite is **38/41** — the three `products.search` failures are a known harness limitation (`headers()` outside a request scope through the in-process caller), not a regression. Do not try to fix them.

- [ ] **Step 10: Commit**

```bash
git add src/lib/collection-sort.ts src/lib/collection-sort.test.ts src/domain/products/interfaces/repositories/product.repository.interface.ts src/infrastructure/database/repositories/products/product.repository.ts src/server/routers/public/products.ts src/infrastructure/database/repositories/products/product.repository.integration.test.ts
git commit -m "feat(products): Add sort support from domain filters through public router"
```

---

## Task 5: CollectionBanner

**Files:**

- Create: `src/components/collections/collection-banner-content.ts`
- Create: `src/components/collections/CollectionBanner.tsx`

**Interfaces:**

- Consumes: nothing from earlier tasks except the `.val-reveal` class from Task 1.
- Produces:
  - `export interface CollectionBannerProps { eyebrow?: string; title: string; description?: string; image: string; productCount?: number }`
  - `export function CollectionBanner(props: CollectionBannerProps): JSX.Element`
  - `export const BANNER_CONTENT: Record<"all" | "new" | "sale" | "index", { eyebrow: string; title: string; description: string; image: string }>`

- [ ] **Step 1: Write the content config**

Create `src/components/collections/collection-banner-content.ts`:

```ts
/**
 * Per-route banner copy and artwork.
 *
 * `/collections/[slug]` is deliberately absent — a category banner is built
 * from the category's own name and description, so renaming it in the admin
 * renames it here too.
 *
 * Images fall back to the existing hero until the campaign shots land, so a
 * missing file never renders a broken banner.
 */

const FALLBACK_IMAGE = "/brand/hero.jpg";

export const BANNER_CONTENT = {
  all: {
    eyebrow: "Premium streetwear essentials",
    title: "All Products",
    description:
      "Explore the full Valkyrie collection — timeless silhouettes, premium fabrics, and modern streetwear essentials.",
    image: "/brand/banner-all.jpg",
  },
  new: {
    eyebrow: "Just landed",
    title: "New Arrivals",
    description: "The latest additions to our premium collection.",
    image: "/brand/banner-new.jpg",
  },
  sale: {
    eyebrow: "Limited time",
    title: "Sale",
    description: "Don't miss out on these limited-time offers.",
    image: "/brand/banner-sale.jpg",
  },
  index: {
    eyebrow: "Curated by Valkyrie",
    title: "Collections",
    description: "Explore our curated collections of premium streetwear.",
    image: "/brand/banner-collections.jpg",
  },
} as const;

export { FALLBACK_IMAGE };
```

- [ ] **Step 2: Write the banner**

Create `src/components/collections/CollectionBanner.tsx`:

```tsx
/**
 * Collection Banner — the scrim split.
 *
 * Full-bleed, no container. Text left, photograph bleeding off the right edge,
 * with a gradient scrim dissolving the seam between them rather than butting
 * one against the other.
 *
 * It replaces a centered `max-w-7xl` header that used the widest element on the
 * page to display three centered lines, and it absorbs the orphaned
 * "Showing X of Y products" into a meta row that gives the left column a floor.
 *
 * The left padding intentionally matches the product grid's gutter below, so
 * the headline's left edge and the first card's left edge share an axis.
 *
 * Below `lg` the photograph does not stack — it becomes a dimmed layer behind
 * the text, so a phone does not inherit a 700px header.
 */

import Image from "next/image";
import { formatCurrency } from "@/lib/currency";

export interface CollectionBannerProps {
  eyebrow?: string;
  title: string;
  description?: string;
  image: string;
  /** Rendered in the meta row. Omitted for surfaces with no single count. */
  productCount?: number;
}

export function CollectionBanner({
  eyebrow,
  title,
  description,
  image,
  productCount,
}: CollectionBannerProps) {
  // The currency symbol only — `formatCurrency` is the single source of truth
  // for which currency this deployment charges in.
  const currencyLabel = formatCurrency(0).replace(/[\d.,\s]/g, "");

  return (
    <section className="relative isolate overflow-hidden border-b border-white/10">
      {/* Mobile: photograph as a dimmed backdrop rather than a stacked block. */}
      <div className="absolute inset-0 lg:hidden">
        <Image
          src={image}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <div className="relative grid min-h-[clamp(340px,40vh,460px)] lg:grid-cols-[1fr_0.8fr]">
        <div className="flex flex-col justify-center gap-5 px-4 py-14 sm:px-6 lg:px-8 xl:pl-[max(2rem,calc((100vw-1600px)/2+2rem))]">
          {eyebrow ? (
            <div className="val-reveal flex items-center gap-4" data-reveal>
              <span className="text-[11px] font-medium uppercase tracking-[0.32em] text-val-silver/50">
                {eyebrow}
              </span>
              <span className="h-px w-10 bg-white/25" />
            </div>
          ) : null}

          <h1
            className="val-reveal text-[clamp(2.25rem,5.5vw,4rem)] font-semibold uppercase leading-[1.05] tracking-[0.12em] text-white"
            data-reveal
          >
            {title}
          </h1>

          {description ? (
            <p
              className="val-reveal max-w-[46ch] text-sm leading-relaxed text-gray-400 sm:text-base"
              data-reveal
            >
              {description}
            </p>
          ) : null}

          <div
            className="val-reveal flex flex-wrap items-center gap-4 text-[11px] uppercase tracking-[0.28em] text-gray-500"
            data-reveal
          >
            {productCount !== undefined ? (
              <>
                <span>
                  {productCount} {productCount === 1 ? "Product" : "Products"}
                </span>
                <span className="h-px w-8 bg-white/15" />
              </>
            ) : null}
            <span>Premium Quality</span>
            <span className="h-px w-8 bg-white/15" />
            <span>{currencyLabel}</span>
          </div>
        </div>

        {/* Desktop photograph. The scrim dissolves its left edge into the page. */}
        <div className="relative hidden lg:block">
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="45vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/55 to-transparent" />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `rm -rf .next && pnpm type-check && pnpm lint`
Expected: PASS, 0 problems.

- [ ] **Step 4: Commit**

```bash
git add src/components/collections/CollectionBanner.tsx src/components/collections/collection-banner-content.ts
git commit -m "feat(collections): Add full-bleed scrim split banner"
```

---

## Task 6: CollectionToolbar

**Files:**

- Create: `src/components/collections/CollectionToolbar.tsx`
- Modify: `src/lib/cache.ts` (add a new cached fetcher beside `getCachedNavCategories`, around line 664)

**Interfaces:**

- Consumes: `PRODUCT_SORTS`, `parseProductSort`, `DEFAULT_PRODUCT_SORT`, `ProductSort` from Task 4.
- Produces:
  - `export interface ToolbarCategory { slug: string; name: string; categoryIds: string[] }`
  - `export interface CollectionToolbarProps { categories: ToolbarCategory[]; activeSlug: string | null; sort: ProductSort; shownCount: number; totalCount: number; onCategoryChange: (slug: string | null) => void; onSortChange: (sort: ProductSort) => void }`
  - `export function CollectionToolbar(props: CollectionToolbarProps): JSX.Element`
  - `export const getCachedToolbarCategories` in `src/lib/cache.ts`, returning `{ slug: string; name: string; categoryIds: string[] }[]`

- [ ] **Step 1: Add the toolbar's data source**

`getCachedNavCategories` returns only `{ label, href }` — no ids — so it cannot
feed the chips. Add a sibling fetcher to `src/lib/cache.ts`, directly beneath it:

```ts
/**
 * Top-level categories for the collection toolbar, each carrying its whole
 * subtree.
 *
 * The subtree is the point. Every product is filed against a *leaf* category
 * while the navigation links to parents, so `eq(products.categoryId, parentId)`
 * matched nothing — that is what rendered "No products found" on
 * `/collections/women` for a store with thirteen women's products.
 *
 * Separate from `getCachedNavCategories`, which deliberately returns only what
 * a link list needs.
 */
export const getCachedToolbarCategories = unstable_cache(
  async () => {
    const caller = createAnonymousCaller();
    const categories = await caller.public.categories.list();

    return categories
      .filter((category) => category.parentId === null)
      .filter((category) => !isReservedCollectionSlug(category.slug))
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((category) => ({
        slug: category.slug,
        name: category.name,
        categoryIds: collectCategoryTree(categories, category.id),
      }));
  },
  ["toolbar-categories"],
  { revalidate: CATALOGUE_REVALIDATE, tags: [CACHE_TAGS.CATEGORIES] }
);

/** One toolbar chip. Matches `ToolbarCategory` in `CollectionToolbar`. */
export type ToolbarCategoryData = Awaited<
  ReturnType<typeof getCachedToolbarCategories>
>[number];
```

Add `import { collectCategoryTree } from "@/domain/categories/category-tree";`
if the file does not already have it.

`collectCategoryTree(categories, rootId)` takes the **full** category list and a
root id and returns the root plus every descendant id. Pass the unfiltered
`categories` array, not the filtered top-level one, or descendants are dropped.

- [ ] **Step 2: Write the toolbar**

Create `src/components/collections/CollectionToolbar.tsx`:

```tsx
"use client";

/**
 * Collection Toolbar — the band that used to be empty.
 *
 * Sticks directly beneath the navbar, which is `sticky top-0 z-50` at
 * `h-14 md:h-16`. This sits at `z-30` so it passes under the navbar rather
 * than over it.
 *
 * Chips filter in place rather than navigating. `/collections/[slug]` stays the
 * canonical route reached from the navigation; these are an in-page refinement,
 * which is what lets Sale and New be filtered by category at all — there is no
 * `/collections/sale/tops` route and there should not be one.
 *
 * Each chip carries its category's *subtree* ids, never its own id alone. Every
 * product is filed against a leaf category while the navigation links to
 * parents, so matching a single id emptied every parent collection.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_SORTS, type ProductSort } from "@/lib/collection-sort";
import { cn } from "@/lib/utils";

export interface ToolbarCategory {
  slug: string;
  name: string;
  /** The category and its descendants, resolved server-side. */
  categoryIds: string[];
}

export interface CollectionToolbarProps {
  categories: ToolbarCategory[];
  activeSlug: string | null;
  sort: ProductSort;
  shownCount: number;
  totalCount: number;
  onCategoryChange: (slug: string | null) => void;
  onSortChange: (sort: ProductSort) => void;
}

export function CollectionToolbar({
  categories,
  activeSlug,
  sort,
  shownCount,
  totalCount,
  onCategoryChange,
  onSortChange,
}: CollectionToolbarProps) {
  return (
    <div className="sticky top-14 z-30 border-b border-white/10 bg-black/80 backdrop-blur-xl md:top-16">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div
          className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto px-1 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filter by category"
        >
          <Chip
            label="All"
            active={activeSlug === null}
            onClick={() => onCategoryChange(null)}
          />
          {categories.map((category) => (
            <Chip
              key={category.slug}
              label={category.name}
              active={activeSlug === category.slug}
              onClick={() => onCategoryChange(category.slug)}
            />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <span className="hidden text-[11px] uppercase tracking-[0.24em] text-gray-500 sm:inline">
            {shownCount} / {totalCount}
          </span>

          <Select
            value={sort}
            onValueChange={(value) => onSortChange(value as ProductSort)}
          >
            <SelectTrigger
              className="h-9 w-[172px] border-white/15 bg-transparent text-xs uppercase tracking-[0.18em] text-gray-300"
              aria-label="Sort products"
            >
              <SelectValue />
            </SelectTrigger>
            {/* Portalled to <body>: both halves of the token pair, or this
                renders white-on-white under the light palette. */}
            <SelectContent className="border-white/15 bg-popover text-popover-foreground">
              {PRODUCT_SORTS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-xs"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative shrink-0 whitespace-nowrap px-3 py-2 text-[11px] uppercase tracking-[0.24em] transition-colors duration-200",
        active ? "text-white" : "text-gray-500 hover:text-gray-300"
      )}
    >
      {label}
      <span
        className={cn(
          "absolute inset-x-3 bottom-1 h-px origin-left bg-val-accent transition-transform duration-300 ease-out",
          active ? "scale-x-100" : "scale-x-0"
        )}
      />
    </button>
  );
}
```

- [ ] **Step 3: Confirm the Select primitive exists and exports those names**

Run: `grep -n "export {" src/components/ui/select.tsx`
Expected: the export list includes `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`. If any is missing, adjust the import to the names actually exported — do not add a new primitive.

- [ ] **Step 4: Verify it compiles**

Run: `rm -rf .next && pnpm type-check && pnpm lint`
Expected: PASS, 0 problems.

- [ ] **Step 5: Commit**

```bash
git add src/components/collections/CollectionToolbar.tsx src/lib/cache.ts
git commit -m "feat(collections): Add sticky filter and sort toolbar"
```

---

## Task 7: Grid density, banner wiring and Framer Motion transitions

**Files:**

- Create: `src/components/products/ProductGridItems.tsx`
- Modify: `src/components/products/CollectionGridSkeleton.tsx` (the `GRID_CLASSES` export and the container width)
- Modify: `src/components/products/InfiniteProductGrid.tsx` (replace the header block; add toolbar, sort/filter state, motion wrapper)

**Interfaces:**

- Consumes: `CollectionBanner` (Task 5), `CollectionToolbar` + `ToolbarCategory` (Task 6), `parseProductSort` / `ProductSort` (Task 4), `useReveal` (Task 3).
- Produces: `InfiniteProductGrid` gains props `bannerEyebrow?: string`, `bannerImage: string`, `categories?: ToolbarCategory[]`. `GRID_CLASSES` widens to 5 columns at `2xl`.

- [ ] **Step 1: Widen the shared grid geometry**

In `src/components/products/CollectionGridSkeleton.tsx`, replace the `GRID_CLASSES` constant:

```ts
/**
 * Grid geometry, shared with `InfiniteProductGrid` so columns never shift
 * between the skeleton and the real grid.
 *
 * Five columns at `2xl`: the previous `max-w-7xl` / four-column ceiling left
 * roughly 640px of dead margin on a 1920px viewport with no way to use it.
 */
export const GRID_CLASSES =
  "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6";
```

In the same file, change both occurrences of `max-w-7xl` to `max-w-[1600px]`, and raise the default `count` from `8` to `10` so the skeleton still fills a five-column row.

- [ ] **Step 2: Write the motion wrapper**

Create `src/components/products/ProductGridItems.tsx`:

```tsx
"use client";

/**
 * Exit and reorder for the product grid.
 *
 * This is the one place Framer Motion earns its bundle. When a filter or sort
 * changes, products *leave* the DOM — CSS cannot animate a node that is already
 * gone, and GSAP has no idea the React data changed. `AnimatePresence` does.
 *
 * `LazyMotion` + `m` rather than the full `motion` bundle: the feature set is
 * loaded asynchronously, so the baseline cost is a few kilobytes instead of ~30.
 *
 * Exits are a deliberate exception to the Timeline Law. Cards leave *together*
 * as one 120ms gesture rather than one at a time — sequencing twelve exits
 * ahead of twelve entrances would cost nearly three seconds per sort change.
 * Entrances stay strictly sequential and are still granted by the conductor.
 */

import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export function ProductGridItems({
  /** Changes whenever the filter or sort changes, forcing a full swap. */
  transitionKey,
  className,
  children,
}: {
  transitionKey: string;
  className?: string;
  children: React.ReactNode;
}) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={transitionKey}
          className={className}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}
```

- [ ] **Step 3: Rewire InfiniteProductGrid**

In `src/components/products/InfiniteProductGrid.tsx`:

Add to the props interface:

```ts
  /** Small label above the banner headline. */
  bannerEyebrow?: string;
  /** Banner artwork. Required — every collection route has one. */
  bannerImage: string;
  /** Chips for the toolbar. Omit to render the toolbar without filters. */
  categories?: ToolbarCategory[];
```

Add these imports:

```ts
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CollectionBanner } from "@/components/collections/CollectionBanner";
import {
  CollectionToolbar,
  type ToolbarCategory,
} from "@/components/collections/CollectionToolbar";
import { ProductGridItems } from "@/components/products/ProductGridItems";
import { useReveal } from "@/hooks/use-reveal";
import { parseProductSort, type ProductSort } from "@/lib/collection-sort";
```

Inside the component, above the tRPC call, add the filter state. **Only the client reads `searchParams`** — the server components never touch it, which is what keeps these routes static:

```ts
const router = useRouter();
const searchParams = useSearchParams();

const sort = parseProductSort(searchParams.get("sort"));
const activeSlug = searchParams.get("category");

const activeCategory = useMemo(
  () => categories?.find((c) => c.slug === activeSlug) ?? null,
  [categories, activeSlug]
);

/** Rewrites one query param, preserving the rest and the scroll position. */
const setParam = (key: string, value: string | null) => {
  const next = new URLSearchParams(searchParams.toString());
  if (value === null) next.delete(key);
  else next.set(key, value);
  const query = next.toString();
  router.replace(query ? `?${query}` : "?", { scroll: false });
};
```

Add `sort` and the chip's subtree ids to the query input, and give the query a
key that changes when either changes:

```ts
        categoryIds: activeCategory?.categoryIds ?? categoryIds,
        sort,
```

Seed data is only correct for the unfiltered default view, so gate it:

```ts
        initialData:
          initialPage && sort === "newest" && activeSlug === null
            ? { pages: [initialPage], pageParams: [1] }
            : undefined,
```

Replace the entire `{/* Collection Header */}` block — the `div` with
`py-12 md:py-16 border-b border-white/10` and everything inside it — with:

```tsx
      <CollectionBanner
        eyebrow={bannerEyebrow}
        title={title}
        description={description}
        image={bannerImage}
        productCount={total}
      />

      <CollectionToolbar
        categories={categories ?? []}
        activeSlug={activeSlug}
        sort={sort}
        shownCount={products.length}
        totalCount={total}
        onCategoryChange={(slug) => setParam("category", slug)}
        onSortChange={(next) => setParam("sort", next)}
      />
```

Change the grid container from `max-w-7xl` to `max-w-[1600px]`, attach the reveal
ref to it, wrap the card list in the motion wrapper, and mark each card:

```tsx
      <div
        ref={revealRef}
        className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 md:py-12 lg:px-8"
      >
        {products.length > 0 ? (
          <ProductGridItems
            transitionKey={`${activeSlug ?? "all"}:${sort}`}
            className={GRID_CLASSES}
          >
            {products.map((product, index) => (
              <div key={product.id} className="val-reveal" data-reveal>
                <ProductCard
                  id={product.id}
                  name={product.name}
                  slug={product.slug}
                  price={product.basePrice}
                  salePrice={product.salePrice ?? undefined}
                  primaryImage={product.primaryImage ?? undefined}
                  secondaryImage={product.secondaryImage ?? undefined}
                  index={index}
                  isOnSale={
                    product.salePrice !== null &&
                    product.salePrice < product.basePrice
                  }
                  isFeatured={product.isFeatured}
                  variants={product.variants}
                  priority={index < 5}
                />
              </div>
            ))}
            {isFetchingNextPage && (
              <ProductCardSkeletonGrid count={NEXT_PAGE_PLACEHOLDERS} />
            )}
          </ProductGridItems>
        ) : (
```

with `const revealRef = useReveal<HTMLDivElement>();` declared alongside the other hooks.

Leave the sentinel, `ValkyrieLoader`, and `EndOfCollection` exactly as they are.

- [ ] **Step 4: Pass the new required prop from all five routes**

`bannerImage` is required, so every caller must supply it or the build fails —
which is the point. Update each:

- `src/app/(main)/collections/all/page.tsx` → `bannerEyebrow={BANNER_CONTENT.all.eyebrow} bannerImage={BANNER_CONTENT.all.image}`
- `src/app/(main)/collections/new/page.tsx` → the `new` entry
- `src/app/(main)/collections/sale/page.tsx` → the `sale` entry
- `src/app/(main)/collections/[slug]/page.tsx` → `bannerImage={FALLBACK_IMAGE}` and no eyebrow; the category supplies title and description already.

Each imports from `@/components/collections/collection-banner-content`.

Also pass `categories` to `all`, `new`, `sale` and `[slug]` by awaiting the
fetcher added in Task 6 — it already returns exactly `ToolbarCategory[]`, so no
mapping is needed:

```tsx
import { getCachedToolbarCategories } from "@/lib/cache";

// inside the page's async component, alongside the existing cached read:
const [initialPage, categories] = await Promise.all([
  getCachedFirstProductPage({
    /* the page's existing filter */
  }),
  getCachedToolbarCategories(),
]);
```

Both are cached reads with no dependency on one another, so `Promise.all`
pipelines them down one connection — the same shape `/collections/page.tsx`
already uses.

Then pass `categories={categories}` to `InfiniteProductGrid`.

Do **not** substitute `getCachedNavCategories`: it returns `{ label, href }` only,
with no ids, and a chip without subtree ids filters to nothing.

- [ ] **Step 5: Verify**

Run: `rm -rf .next && pnpm lint && pnpm type-check && pnpm test`
Expected: PASS, 0 lint problems, 683 tests.

- [ ] **Step 6: Verify it actually renders**

Run: `pnpm build`
Expected: build succeeds. Baseline is 49 prerendered routes; the collection routes must
still prerender. If any became dynamic, a server component is reading
`searchParams` — find it and move that read into the client component.

- [ ] **Step 7: Commit**

```bash
git add src/components/products src/app/\(main\)/collections
git commit -m "feat(collections): Replace centered header with banner, toolbar and wider grid"
```

---

## Task 8: The /collections mosaic

**Files:**

- Create: `src/components/collections/CollectionMosaic.tsx`
- Modify: `src/app/(main)/collections/page.tsx`
- Modify: `src/components/collections/CollectionSection.tsx` (spacing and column count only)
- Delete: `src/components/collections/CollectionsHeader.tsx`, `src/components/collections/BrowseAllBanner.tsx`

**Interfaces:**

- Consumes: `CollectionBanner`, `BANNER_CONTENT` (Task 5); `useReveal` (Task 3).
- Produces: `export interface MosaicTile { title: string; href: string; image: string; count: number; featured?: boolean }` and `export function CollectionMosaic({ tiles }: { tiles: MosaicTile[] })`.

- [ ] **Step 1: Write the mosaic**

Create `src/components/collections/CollectionMosaic.tsx`:

```tsx
"use client";

/**
 * Collection Mosaic — what replaced the centered header and the "Browse All"
 * strip on `/collections`.
 *
 * The page previously opened with a centered title, a thin full-width link, and
 * then three stacked four-card rows separated by 64px. The top third of the
 * page displayed four lines of text across 1600px.
 *
 * The featured tile spans two columns and both rows; the rest fill in beside it.
 */

import Image from "next/image";
import Link from "next/link";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

export interface MosaicTile {
  title: string;
  href: string;
  image: string;
  /** Omitted where there is no single meaningful number, e.g. "All Products". */
  count?: number;
  /** Spans two columns and two rows. Exactly one tile should set this. */
  featured?: boolean;
}

/**
 * Four columns, two rows — eight cells. The featured tile occupies four of
 * them, leaving exactly four for the remaining collections (Men, Women, Sale,
 * All Products). A three-column grid leaves only two cells free and silently
 * pushes the fourth tile onto a third row.
 */
export function CollectionMosaic({ tiles }: { tiles: MosaicTile[] }) {
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <div
      ref={revealRef}
      className="mx-auto grid max-w-[1600px] gap-4 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:grid-rows-2 lg:px-8"
    >
      {tiles.map((tile) => (
        <Link
          key={tile.href}
          href={tile.href}
          className={cn(
            "val-reveal group relative overflow-hidden rounded-xl border border-white/10 transition-colors duration-300 hover:border-white/25",
            tile.featured
              ? "sm:col-span-2 lg:row-span-2 min-h-[280px] lg:min-h-[520px]"
              : "min-h-[200px] lg:min-h-[254px]"
          )}
          data-reveal
        >
          <Image
            src={tile.image}
            alt=""
            fill
            sizes={
              tile.featured
                ? "(min-width: 1024px) 50vw, 100vw"
                : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            }
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 p-5 transition-transform duration-300 ease-out group-hover:-translate-y-1">
            <h2
              className={cn(
                "font-semibold uppercase tracking-[0.14em] text-white",
                tile.featured ? "text-2xl lg:text-3xl" : "text-base lg:text-lg"
              )}
            >
              {tile.title}
            </h2>
            {tile.count !== undefined ? (
              <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-gray-400">
                {tile.count} {tile.count === 1 ? "Product" : "Products"}
              </p>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Rebuild the collections page**

In `src/app/(main)/collections/page.tsx`:

Replace the `CollectionsHeader` and `BrowseAllBanner` imports and their JSX with:

```tsx
import { CollectionBanner } from "@/components/collections/CollectionBanner";
import { BANNER_CONTENT } from "@/components/collections/collection-banner-content";
import {
  CollectionMosaic,
  type MosaicTile,
} from "@/components/collections/CollectionMosaic";
```

Build the tiles from the `seeded` array the page already computes — the counts
come from data already fetched, so this adds no queries:

```tsx
const tiles: MosaicTile[] = seeded.map(({ collection, initialPage }, i) => ({
  title: collection.title,
  href: collection.href,
  image: TILE_IMAGES[collection.href] ?? FALLBACK_IMAGE,
  count: initialPage?.total ?? 0,
  featured: i === 0,
}));

// Fills the mosaic's fourth free cell and replaces the deleted
// `BrowseAllBanner`. No count — the catalogue total is not among the four
// reads this page already makes, and it is not worth a fifth.
tiles.push({
  title: "All Products",
  href: "/collections/all",
  image: FALLBACK_IMAGE,
});
```

Add above the component:

```tsx
/** Artwork per collection row. Falls back until the campaign shots land. */
const TILE_IMAGES: Record<string, string> = {
  "/collections/new": "/brand/tile-new.jpg",
  "/collections/men": "/brand/tile-men.jpg",
  "/collections/women": "/brand/tile-women.jpg",
  "/collections/sale": "/brand/tile-sale.jpg",
};
```

and import `FALLBACK_IMAGE` from the banner content module.

Then the render becomes:

```tsx
<div className="min-h-screen">
  <CollectionBanner {...BANNER_CONTENT.index} />
  <CollectionMosaic tiles={tiles} />

  <div className="mx-auto max-w-[1600px] space-y-10 px-4 py-8 sm:px-6 md:py-12 lg:px-8">
    {seeded.map(({ collection, initialPage }) => (
      <CollectionSection
        key={collection.href}
        {...collection}
        initialPage={initialPage}
      />
    ))}
  </div>
</div>
```

- [ ] **Step 3: Widen the preview rows**

In `src/components/collections/CollectionSection.tsx`, change **both** occurrences
of `grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6` (the skeleton branch and the
products branch) to:

```
grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6
```

and change `PREVIEW_LIMIT` from `4` to `5` so a five-column row is full.

- [ ] **Step 4: Delete the replaced components**

```bash
git rm src/components/collections/CollectionsHeader.tsx src/components/collections/BrowseAllBanner.tsx
```

Run: `grep -rn "CollectionsHeader\|BrowseAllBanner" src/`
Expected: no matches. If any remain, remove those imports.

- [ ] **Step 5: Verify**

Run: `rm -rf .next && pnpm lint && pnpm type-check && pnpm test && pnpm build`
Expected: all PASS, 49 prerendered routes.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/\(main\)/collections src/components/collections
git commit -m "feat(collections): Replace stacked preview header with image mosaic"
```

---

## Task 9: Loader unification across the storefront

**Files:**

- Modify: `src/components/ui/valkyrie-loader.tsx`
- Modify: `src/components/ui/spinner.tsx`
- Modify (storefront only): `src/app/(auth)/{check-email,forgot-password,reset-password,verify-email}/page.tsx`, `src/app/(main)/checkout/success/page.tsx`, `src/app/(main)/search/page.tsx`, `src/components/account/orders/OrdersList.tsx`, `src/components/cart/{CartDrawer,CartStockDialog,CartSummary,CouponField}.tsx`, `src/components/search/SearchDialog.tsx`

**Admin files are explicitly out of scope.** Everything under `src/components/admin/` keeps `Loader2`.

**Interfaces:**

- Consumes: nothing.
- Produces: `ValkyrieLoader` accepts `size="xs"` and `inline?: boolean`. `Spinner` keeps its existing props signature.

- [ ] **Step 1: Extend ValkyrieLoader**

In `src/components/ui/valkyrie-loader.tsx`:

Add `xs: 16` to the `SIZES` map. Add `inline?: boolean` to the props interface,
documented as "Render bare, with no wrapper or screen-reader text — for use
inside a control that already has a visible label."

**Remove the hardcoded `text-white`** from the track polygon's className, leaving
`className="val-loader__track"`. This is the important edit: the track is
`stroke="currentColor" strokeOpacity="0.14"`, so pinning it to white makes it
invisible on any light surface. Inheriting is what makes the mark portable.

When `inline` is set, return the bare `<svg>` with `className={cn("shrink-0", className)}`
and no wrapper `div`, no label, no `sr-only` span.

- [ ] **Step 2: Rewrite the shared spinner**

Replace `src/components/ui/spinner.tsx` entirely:

```tsx
import { cn } from "@/lib/utils";
import { ValkyrieLoader } from "@/components/ui/valkyrie-loader";

/**
 * The shared inline spinner.
 *
 * Renders the branded mark rather than lucide's `Loader2`. The props signature
 * is unchanged so existing call sites keep working, including the ones that
 * pass `className` to resize it.
 */
function Spinner({ className }: { className?: string }) {
  return (
    <ValkyrieLoader inline size="xs" className={cn("size-4", className)} />
  );
}

export { Spinner };
```

- [ ] **Step 3: Sweep the storefront files**

In each file listed above, replace `<Loader2 className="… animate-spin" />` with
`<ValkyrieLoader inline size="xs" className="…" />`, keeping the sizing classes,
and drop the now-unused `Loader2` import.

Where the spinner stands alone as a page-level wait state rather than inside a
button — `checkout/success/page.tsx`, `search/page.tsx`, `OrdersList.tsx` — use
the full form with a caption instead: `<ValkyrieLoader size="md" label="Loading" />`.

- [ ] **Step 4: Verify nothing storefront-side still spins**

Run: `grep -rn "Loader2\|animate-spin" src/app/\(main\) src/app/\(auth\) src/components/cart src/components/search src/components/account src/components/ui/spinner.tsx`
Expected: no matches.

Run: `grep -rln "Loader2" src/components/admin | wc -l`
Expected: a non-zero count — admin is deliberately untouched.

- [ ] **Step 5: Verify**

Run: `rm -rf .next && pnpm lint && pnpm type-check && pnpm test && pnpm build`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui src/app/\(main\) src/app/\(auth\) src/components/cart src/components/search src/components/account
git commit -m "feat(ui): Use branded Valkyrie loader across the storefront"
```

---

## Task 10: Storefront-wide reveal rollout

**Files:**

- Modify: `src/components/home/{ServerFeaturedProducts,ServerNewArrivals,ServerBrandStory,ServerPromoBanner,TrustIndicators}.tsx` — or their client children where the server component cannot hold a ref
- Modify: `src/components/products/{ProductDetail,RelatedProducts,ProductReviews}.tsx`
- Modify: `src/components/products/ProductCard.tsx` (hover polish only)

**Interfaces:**

- Consumes: `useReveal` (Task 3), `.val-reveal` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Apply the reveal to each storefront section**

For each component listed, attach `const revealRef = useReveal<HTMLDivElement>();`
to its outermost container and add `className="val-reveal" data-reveal` to each
direct child that should enter on its own beat — typically the section heading,
then each card or row.

`useReveal` is a client hook. Where the section is a server component, put the ref
on its existing client child rather than converting the server component — these
pages are server-rendered on purpose and converting them would undo the
performance work recorded in `docs/PERFORMANCE.md`.

- [ ] **Step 2: Polish the card hover**

In `src/components/products/ProductCard.tsx`, on the card's outer container, add
a border and lift to the existing hover treatment:

```
transition-[transform,border-color] duration-300 ease-out hover:-translate-y-0.5
```

with the border moving from `border-white/10` to `hover:border-white/25`. Leave
the existing image `scale-105` and the `QuickAddSliderBar` reveal alone — they
already work and they are hover states, which the Timeline Law exempts.

- [ ] **Step 3: Verify the law holds in a real browser**

Run: `pnpm dev`, open `/collections/all`, and watch the entrance. Confirm by eye
that elements arrive one at a time and never two together, that the cascade
finishes in about a second and a half rather than stalling, and that scrolling to
a lower section starts a fresh cascade rather than firing everything at once.

Then set the OS to reduce motion and reload: everything must appear instantly,
with no movement anywhere.

- [ ] **Step 4: Verify**

Run: `rm -rf .next && pnpm lint && pnpm type-check && pnpm test && pnpm build`
Expected: all PASS, 0 lint problems, 683 tests, 49 prerendered routes.

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "feat(motion): Roll sequential reveal across storefront sections"
```

---

## Assets

Eight images into `public/brand/`, generated by the user from prompts held in the
conversation. Banners 1600×900, tiles 1200×1500.

`banner-all.jpg`, `banner-new.jpg`, `banner-sale.jpg`, `banner-collections.jpg`,
`tile-new.jpg`, `tile-men.jpg`, `tile-women.jpg`, `tile-sale.jpg`.

Until they land, `collection-banner-content.ts` and `TILE_IMAGES` fall back to
`/brand/hero.jpg`, so every task above is completable and verifiable with no new
artwork. Dropping the files in requires no code change.

## Verification summary

| After task | `pnpm test` | Notes                                                                            |
| ---------- | ----------- | -------------------------------------------------------------------------------- |
| 2          | 678         | +8 conductor                                                                     |
| 4          | 683         | +5 collection-sort                                                               |
| 7          | 683         | `pnpm build` must still emit 49 prerendered routes, 9 of them under /collections |
| 10         | 683         | full lint/type-check/test/build clean                                            |
