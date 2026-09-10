# Storefront Motion System + Collections Redesign

Date: 2026-09-10
Status: design approved, pending implementation

## Problem

Four storefront surfaces carry visible dead space:

| Surface     | Route               | Component                                                | Symptom                                                                             |
| ----------- | ------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Shop        | `/collections/all`  | `InfiniteProductGrid`                                    | centered `max-w-7xl` header, `py-12 md:py-16`, orphaned "Showing 12 of 36 products" |
| New         | `/collections/new`  | `InfiniteProductGrid`                                    | same                                                                                |
| Sale        | `/collections/sale` | `InfiniteProductGrid`                                    | same                                                                                |
| Collections | `/collections`      | `CollectionsHeader` + `BrowseAllBanner` + 3 preview rows | centered header, thin strip, `space-y-16` between 4-card rows                       |

Three of the four are literally the same component, so one banner fixes five routes
(`/collections/[slug]` included).

Two structural causes, not cosmetic ones:

1. **`max-w-7xl` (1280px) with a 4-column ceiling.** On a 1920px viewport that is ~640px
   of empty margin and no way to use it.
2. **A centered text header consuming full width to display nothing.** The header block
   is the widest element on the page and holds three centered lines.

Separately: motion across the storefront is ad-hoc — scattered `transition-*` utilities
with no shared timing, and no entrance choreography at all. And the loading language is
split: `ValkyrieLoader` (the branded hex/chevron mark) appears in 4 files while
`Loader2`/`animate-spin` appears in 31.

## Scope

**All client-side / storefront surfaces. The admin is not touched.**

This reverses an earlier answer in the same conversation that put the loader sweep across
"storefront + admin". The later instruction ("this will be for all of the client side, no
need to touch admin") wins and is recorded here rather than silently applied. The ~13
admin files keep `Loader2`. Reverting this decision means re-running Task 9 with the admin
glob included and nothing else changes.

## Decisions

| #   | Decision                                                          | Rationale                                                                                                                                      |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Banner direction: **Scrim Split**                                 | Text left, photo bleeding off the right edge, gradient scrim dissolving the seam. Chosen from three options against a user-supplied reference. |
| D2  | `/collections` gets an **image mosaic + tightened preview rows**  | The mosaic replaces the dead header area and the `BrowseAllBanner` strip; rows survive so products stay visible on the page.                   |
| D3  | Grid widens to **5 columns on 2xl**, container `max-w-[1600px]`   | Reclaims the ~640px dead margin without shrinking cards on a laptop.                                                                           |
| D4  | Filter chips + sort are added                                     | Turns the empty header band into a working control surface. Requires backend sort support.                                                     |
| D5  | **Both GSAP and Framer Motion**, with a strict division of labour | See Motion Architecture.                                                                                                                       |
| D6  | Chips filter **in place** via `?category=`, they do not navigate  | Consistent across all four pages; keeps `generateStaticParams` and the prerender intact because only the client reads the param.               |
| D7  | `val-*` colour tokens are **not** rewritten                       | They are committed design system. Any design skill proposing a new palette is overruled.                                                       |

## The Timeline Law

> **At any instant, at most one element is performing an entrance.**

This is a hard user requirement: "have a timeline where no 2 things are moving, appearing
or anything at the same time — each has its own time."

### Mechanism

A single global conductor owns one GSAP timeline. Elements do not animate themselves;
they enqueue and the conductor grants each an exclusive slot.

- `BEAT = 90ms`. Each element animates for `80ms` with a `10ms` guard gap, so element
  N+1 cannot begin before element N has finished.
- Elements enqueue on mount (above the fold) or on intersection (below the fold).
- Only elements actually intersecting the viewport enqueue. `rootMargin: 0px 0px -10% 0px`.
- **Queue cap: 16 slots (~1.44s).** Past the cap the conductor drains — every remaining
  element is set to its final state at once, with no animation. An element that is simply
  shown is not animating, so the law holds.

### Three necessary exceptions

A literal reading of the law is impossible in three places. These are interpretations, not
oversights, and each is cheap to reverse:

1. **Continuous loops are exempt.** `ValkyrieLoader`'s orbiting segment and the
   `ProductCard` image crossfade run on their own clocks. Under a literal reading the
   loader would have to freeze whenever anything else animated, which is worse in every
   way.
2. **Hover and interaction states are exempt.** Two cards can be mid-hover at once; a
   pointer is the user's clock, not ours.
3. **Group exits are one actor.** When a filter or sort empties the grid, cards leave
   _together_ as a single 120ms gesture rather than one at a time — sequencing 12 exits
   before 12 entrances would cost ~2.9s per sort change. Entrances remain strictly
   sequential.

If any of these three should instead be literal, say so — each is a constant or a branch,
not a rewrite.

## Motion Architecture

Three layers, each with a job the other two do badly.

| Layer                                                | Owns                                                                     | Why this layer                                                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **CSS** (`globals.css`)                              | Hover, focus, continuous loops, the loader, reduced-motion kill switch   | Zero JS, already the house style (`val-orbit`, `val-shimmer`, `val-hint`), and one existing `prefers-reduced-motion` block to extend.           |
| **GSAP** + `@gsap/react`                             | The conductor: one global timeline, exclusive slots, deterministic order | Timelines with positional placement are the only tool that _guarantees_ non-overlap. This is the Timeline Law's enforcement mechanism.          |
| **Framer Motion** (`motion`, via `LazyMotion` + `m`) | Grid exit + reorder on filter/sort                                       | `AnimatePresence` animates elements that are leaving the DOM. CSS cannot — the node is already gone. GSAP does not know the React data changed. |

Constraints:

- Framer Motion is imported as `LazyMotion` + `m` with features loaded async (~5kb gzip
  baseline) rather than the full `motion` bundle. It is scoped to the product grid only.
- `useGSAP()` from `@gsap/react` is mandatory for every GSAP call so timelines are scoped
  to a ref and reverted on unmount. A bare `gsap.to()` in an effect leaks across route
  changes.
- **No ScrollTrigger pinning or scrubbing.** Those are marketing-page techniques; pinning
  a section while a customer scrolls a 36-product grid fights their intent.
- Every new animation registers in the `prefers-reduced-motion` block. The conductor
  short-circuits to "drain" mode entirely under reduced motion.

## Component Design

### `CollectionBanner` (server component)

Full-bleed, no container. `lg:grid-cols-[1fr_0.8fr]`, height `clamp(340px, 40vh, 460px)`.

Left panel padding aligns to the grid gutter below, so the H1's left edge and the first
product card's left edge share an axis. That alignment is most of why the reference reads
as designed rather than assembled.

- **Eyebrow** — `text-[11px] uppercase tracking-[0.32em] text-val-silver/50`, then a 40px hairline rule.
- **H1** — `clamp(2.25rem, 5.5vw, 4rem)`, `font-semibold tracking-[0.12em] uppercase`. Not
  `font-light`; at that size on black, light strokes go anaemic on a non-retina screen.
- **Description** — `max-w-[46ch]`, two lines. Prevents the 6-line wrap that makes body copy look like form text.
- **Meta row** — `36 PRODUCTS — PREMIUM QUALITY — EGP` with hairline separators. **This is
  where the orphaned "Showing X of Y" line goes**, and it is what makes the left column
  read as finished rather than trailing off.
- **Image panel** — `object-cover object-center` with `bg-gradient-to-r from-black via-black/55 to-transparent`
  over its left 55%. Below `lg` the image becomes an absolutely-positioned layer at
  `opacity-25` behind the text with a full scrim — it does not stack, so mobile does not
  inherit a 700px header.

Per-route content lives in one config object keyed by route, so `/collections/[slug]` gets
a banner from the category's own `name` / `description` with no new code.

### `CollectionToolbar` (client)

`sticky top-14 md:top-16 z-30` — Navbar is `sticky top-0 z-50` at `h-14 md:h-16`.
`bg-black/80 backdrop-blur-xl border-y border-white/10`.

- Chips resolve through `getCachedNavCategories` and each carries its **subtree ids**, not
  its own id. `eq(categoryId, parent)` matches zero products — that is the bug that
  emptied `/collections/women`.
- Active chip underline slides via `transform` on one shared rail, not `border-bottom` per chip.
- Sort is a shadcn `Select`. It portals to `<body>`, so it must set **both** halves:
  `bg-popover text-popover-foreground`. A background alone renders white-on-white.
- `?category=` and `?sort=` are read client-side only. The server component never touches
  `searchParams`, which is what keeps the route static.

### Grid density

`GRID_CLASSES` → `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5`, container
`max-w-[1600px]`. It is exported and shared with `CollectionGridSkeleton` precisely so the
skeleton→grid handover does not shift columns.

### `CollectionMosaic` (`/collections` only)

`lg:grid-cols-3 lg:grid-rows-2`. New Arrivals spans `col-span-2 row-span-2`; then Men,
Women, Sale. Each tile: image, name, live product count, hover scaling the image to `1.04`
while the label rises. Counts come from data the page already fetches — no extra queries.

Preview rows below tighten `space-y-16` → `space-y-10` and widen to 5 cards on 2xl.

## Backend: sort

`sort?: "newest" | "price-asc" | "price-desc" | "name"` on `ProductFilters`.
`findAll` swaps its hardcoded `orderBy` for a mapper. Two non-negotiable constraints:

1. **Every branch appends `desc(products.id)`.** `ORDER BY created_at DESC` alone is not a
   total order and the seed writes 35 products on one timestamp — without the tiebreaker,
   paging duplicates some products and skips others.
2. **Price sorts on `COALESCE(sale_price, base_price)`**, not `base_price`, or a sale item
   sorts by a price nobody pays. Both columns are root-table, so the Drizzle relational-query
   column-rewrite trap is a no-op here.

## Loader unification

`ValkyrieLoader` gains `xs: 16` and an `inline` prop (drops the `flex-col` wrapper and the
`sr-only` span, for use inside a button that already has a visible label).
`src/components/ui/spinner.tsx` is rewritten to render it while keeping its current props
signature so call sites do not change.

**One real trap.** The loader's track is `stroke="currentColor" strokeOpacity="0.14"` with
a hardcoded `text-white`. On the storefront that is correct. The `text-white` must come off
so the track inherits its surrounding foreground — this is the same two-themes-one-`:root`
failure that has already produced six white-on-white bugs, and it becomes a seventh the
moment the loader is used on a light surface.

## Testing

`pnpm test` is unit-only with no DOM testing library, so client logic is extracted into
plain modules and tested there — the `variant-stock-registry` pattern.

- `collection-sort.test.ts` — param ↔ option round-trip, unknown param falls back to
  `newest`, every option maps to an order.
- `motion-conductor.test.ts` — the law itself: given N enqueued elements, assert no two
  slots overlap; assert the queue drains past the cap; assert reduced motion drains
  immediately.
- `product.repository.integration.test.ts` — read-only additions asserting each sort
  returns a correctly ordered set, and that page 1 ∪ page 2 contains no duplicates under
  every sort. That is the regression the tiebreaker exists to prevent.
- `reserved-slugs.test.ts` already guards static collection routes and must keep passing.

## Assets

8 images into `public/brand/`. Banners at 1600×900, tiles at 1200×1500.

The critical constraint on banners: **the subject sits in the right third with the left
half empty background**, because the scrim falls across the left 55%. Get it wrong and the
scrim lands on the model's face.

Files: `banner-all.jpg`, `banner-new.jpg`, `banner-sale.jpg`, `banner-collections.jpg`,
`tile-new.jpg`, `tile-men.jpg`, `tile-women.jpg`, `tile-sale.jpg`.

Generation prompts are held with the user. Until the files land, components fall back to
the existing `public/brand/hero.jpg` so nothing renders broken.

## Out of scope

- Admin (see Scope).
- ScrollTrigger pinning/scrubbing.
- Any `val-*` token or type-scale rewrite.
- Refunds, loyalty, phone verification — unrelated planned work.
