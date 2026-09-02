# Performance — second pass

Audited and implemented 2026-09-01, against the code as it stood after the P2
Performance work (ISSUES #21–25). That pass fixed the query layer: N+1 loops
became batched lookups, filtering and pagination moved from JavaScript into
SQL, and the storefront's twelve stock polls became one.

This pass reached a different conclusion. **The remaining latency was almost
entirely round trips and waterfalls, not slow queries.** The database answers
fast; the application was asking it too many times, too late, and from the
wrong place.

Everything in Tiers A–D is now implemented except two items that are not code —
see [Still outstanding](#still-outstanding).

---

## Ground truth

Measured against the live database, from one machine, best of three, with the
connection pool pre-warmed so the numbers are steady-state rather than
first-hit.

**The database:** Neon Postgres, `eu-central-1` (Frankfurt), via the `-pooler`
endpoint — so there is already a pgBouncer in front of it.

|                                     |                           |
| ----------------------------------- | ------------------------- |
| Warm query round trip               | **~58 ms**                |
| First connection in a fresh process | **~560 ms**               |
| One observed outlier connect        | **3851 ms** (see PERF-06) |

Two facts about that 58 ms shape everything below.

**postgres.js pipelines queries down a single connection.** The four queries
`products.list` issues cost ~71 ms in total, not 4 × 58 ms. They are written to
the socket together and the responses come back together — roughly one round
trip, not four.

**But pipelining is not parallelism.** Five concurrent `pg_sleep(0.3)` calls on
`max: 1` take 1567 ms, which is 5 × 300 ms plus change. The server executes them
strictly one after another. Queries queue; they do not overlap.

Both are true at once, and together they are why the obvious pool fix was wrong
— see PERF-07.

---

## Outcome

The clearest single measure of the change is the build output. Before, the
storefront's collection pages were client components that fetched their
products after hydrating, so nothing about them could be prerendered:

```
Before:  83 static pages,  /products/[slug] and /collections/[slug] dynamic
After :  92 static pages,  both prerendered (SSG)

├ ● /collections/[slug]     ← was ƒ (dynamic)
├ ○ /collections/all        ← was a client-fetched shell
├ ○ /collections/men        ← "
├ ○ /collections/women      ← "
├ ○ /collections/new        ← "
├ ○ /collections/sale       ← "
├ ○ /collections/accessories← "
├ ● /products/[slug]        ← was ƒ, now 36 prerendered paths
```

Those pages now ship their first screen of products **in the HTML**. The
bundle-download, hydrate, request, query chain that used to stand between a
customer and the first product card is gone from the critical path entirely.

|                                                   | before              | after                       |
| ------------------------------------------------- | ------------------- | --------------------------- |
| Static/prerendered pages                          | 83                  | **92**                      |
| Auth DB queries on an anonymous catalogue request | 2                   | **0**                       |
| Auth DB queries on a repeat authenticated request | 2                   | **0** (cookie + role cache) |
| Round trips before first product card             | 2–3 after hydration | **0**                       |
| `loading.tsx` / `error.tsx` boundaries            | 0                   | 8                           |
| Unit tests                                        | 124                 | **162**                     |
| Production dependencies                           | 47                  | **38**                      |

---

## Tier A — the storefront waterfalls

### PERF-01 — Collection pages fetched their first screen from the browser ✅

`/collections/{all,men,women,new,sale,accessories}` rendered
`InfiniteProductGrid`, a `"use client"` component that called `products.list`
on mount. The chain to first product was:

```
HTML shell → JS bundle downloads → React hydrates → tRPC request
           → 4 DB queries (~71ms) → response → paint
```

**Done.** Each page is a server component that resolves page 1 through
`getCachedFirstProductPage` and hands it to the grid as React Query
`initialData`. The grid keeps its infinite scroll for pages 2+; it simply
starts with page 1 already in cache and never issues that first request.

The cached fetcher calls **the same procedure** the client would have called
rather than reimplementing the query, so the seeded payload cannot drift from
what page 2 returns — a mismatch there would show as cards changing shape the
moment a customer scrolled.

`src/lib/cache.ts`, `src/server/caller.ts`, the six collection pages,
`src/components/products/InfiniteProductGrid.tsx`

---

### PERF-02 — `/collections/[slug]` did that waterfall twice ✅

It was a client component that fetched the category by slug and only then let
the grid fetch products — two _sequential_ client round trips before a single
card appeared, the first spent turning a slug into an id.

**Done.** Now a server component. Both the category and page 1 resolve
server-side through tagged caches, and the route is prerendered per active
category via `generateStaticParams`.

Two behaviour changes worth knowing:

- A missing category is now a real **404** (`notFound()`), where it used to
  render a "not found" panel with a 200. The friendly panel is preserved in
  `not-found.tsx`.
- Note a pre-existing shadowing this made visible: the hardcoded
  `/collections/sale` route wins over a database category whose slug is `sale`,
  because a static segment beats a dynamic one. Not introduced here, not
  changed here.

---

### PERF-03 — There was not one `loading.tsx` in the entire app ✅

Without a loading boundary an App Router navigation blocks on the server render
before anything on screen changes — no spinner, no skeleton, no
acknowledgement, and nothing streams.

**Done.** Five `loading.tsx` and two `error.tsx` plus one `not-found.tsx`:

| file                                      | renders                     |
| ----------------------------------------- | --------------------------- |
| `(main)/loading.tsx`                      | branded loader              |
| `(main)/collections/loading.tsx`          | `CollectionGridSkeleton`    |
| `(main)/products/[slug]/loading.tsx`      | two-column product skeleton |
| `(main)/account/loading.tsx`              | branded loader              |
| `admin/loading.tsx`                       | light-themed card skeletons |
| `(main)/error.tsx`                        | storefront-themed retry     |
| `admin/error.tsx`                         | admin-themed retry          |
| `(main)/collections/[slug]/not-found.tsx` | the old inline panel        |

The grid skeleton was extracted to `CollectionGridSkeleton` and is now rendered
from both directions — `loading.tsx` and the client grid's own loading state —
so the two cannot drift and cause a layout jump at the handover.

The error boundaries follow the two-themes rule in CLAUDE.md: the storefront one
uses `bg-val-accent text-black` rather than the default `Button`, which would be
near-black on near-white and nearly invisible there.

---

### PERF-04 — Every tRPC request paid for auth, including anonymous ones ✅

`createContext` ran on every request and always did two sequential database
queries — a Better Auth session lookup, then a `user_profiles` role query —
_before_ the procedure ran, for a `publicProcedure` that never reads
`ctx.user`.

**Done, in three parts:**

1. **The context is lazy.** `TRPCContext` now exposes a memoised `getUser()`
   instead of a resolved `user`; `isAuthed` and `isAdmin` await it. Anonymous
   catalogue reads do zero auth work. Handlers below those middlewares keep
   reading `ctx.user` as a non-null `AuthUser`, so none of the 53 call sites
   changed.
2. **`cookieCache` is enabled** (5 minutes), so the session is served from a
   signed cookie instead of a `session` table lookup.
3. **The role is cached in-process** for 60 s, with `invalidateUserRole` wired
   into the profile repository's `update` so a write drops it immediately.

> **Correction.** The original write-up of this document claimed the role was
> already available on the session via `generateSessionData`, and that
> `createContext` merely had to read it. That was wrong, and checking the
> database rather than the config is what caught it: **the `session` table has
> no `role` column**, and none was declared in `additionalFields`. So
> `generateSessionData` was computing a role that had nowhere to persist and
> was discarded — after paying for a query on every sign-in. It has been
> removed, and the short-TTL cache above is the actual fix. Keeping the role
> out of the session is also better on its own terms: a demotion now takes
> effect in a minute rather than surviving in a seven-day session.

`src/server/trpc.ts`, `src/server/utils/auth-helpers.ts`, `src/lib/auth.ts`

---

### PERF-05 — No HTTP caching on any tRPC response ✅

`fetchRequestHandler` had no `responseMeta`, so nothing was cacheable at the
CDN, including catalogue queries that are byte-identical for every anonymous
visitor.

**Done**, and the decision was deliberately pulled out into a pure,
exhaustively tested module rather than left inline, because getting it wrong
has a specific bad consequence.

**The trap.** `httpBatchLink` puts several procedure calls into ONE HTTP
response. If any call in the batch were user-scoped, caching that response
publicly would serve one customer's data to another.

The guard is `touchedAuth()` — whether _anything_ in the request resolved the
user — and it is deliberately stronger than checking that the user came back
null. `protectedProcedure` and `adminProcedure` always resolve the user, so
`false` means the batch was entirely public procedures. A response that never
looked at who was asking cannot vary by who was asking.

All four conditions must hold, and anything unrecognised falls through to
`no-store`:

- nothing in the batch resolved the user
- every operation is a query
- nothing errored
- the request resolved to at least one procedure

`response-cache-policy.test.ts` is exhaustive over the flag space and asserts
that **exactly one** of sixteen combinations is cacheable, so any future edit
that widens the rule fails the test.

`src/server/utils/response-cache-policy.ts` + tests,
`src/app/api/trpc/[trpc]/route.ts`

---

### PERF-06 — Neon autosuspend ⏳ _not code — your call_

Steady-state cold connect is ~560 ms and warm queries are 58 ms, but one
measurement took **3851 ms** to open a single connection. Neon suspends compute
after a few minutes of inactivity on the lower tiers, and the next request pays
the wake. That signature — usually fine, occasionally several seconds, no code
change in between — matches the intermittency you described.

**To do:** disable scale-to-zero or raise the suspend delay on the Neon
project, and confirm the app is deployed in `eu-central-1` too.

**Confidence:** medium-high. The mechanism is certain and the outlier is real,
but I measured one wake, not a distribution.

---

## Tier B — the pool, and why the obvious fix was wrong

### PERF-07 — `max: 1` caps throughput, but raising it naively hurts ✅

My first instinct was that `max: 1` serialises everything and should obviously
be raised. I wrote the benchmark to confirm it, and it said the opposite:

| concurrent requests | `max: 1`  | `max: 5`   | `max: 10` |
| ------------------- | --------- | ---------- | --------- |
| 1                   | **71 ms** | 118 ms     | 117 ms    |
| 2                   | **90 ms** | 121 ms     | 124 ms    |
| 4                   | 128 ms    | **93 ms**  | 145 ms    |
| 8                   | 221 ms    | **152 ms** | 266 ms    |

**`max: 1` is fastest for a single request, and not narrowly.** postgres.js
pipelines, so one connection sends all four catalogue queries together and gets
them back in about one round trip. Spread across four connections they run in
parallel but each pays its own 58 ms. On a link this latent, pipelining beats
parallelism. Raising the pool naively would have made the common case ~65%
slower.

**But it degrades linearly with concurrent users**, because pipelining gives no
server-side parallelism — the `pg_sleep` result proves it. The crossover is
around three to four simultaneous requests. `max: 10` was worse than `max: 5`
at every level, so more is not better.

**Done.** The pool is now `DATABASE_POOL_MAX`, defaulting to 1, with the table
and the rule recorded at the call site — because the right value is a
deployment fact, not a constant:

- **Serverless / per-request isolates (Vercel):** leave it at 1. Each instance
  serves one request at a time, so the crossover never arrives.
- **Long-lived Node server or container:** set `DATABASE_POOL_MAX=5`.

There is no `vercel.json` or `Dockerfile` in the repo and `src/lib/trpc.ts`
checks `VERCEL_URL`, which suggests Vercel — hence the default of 1. Change the
env var if that is wrong.

`src/db/index.ts`

---

## Tier C — caching that was built and under-used

### PERF-08 — Catalogue TTLs, and a real bug found while auditing them ✅

The plan was to raise the blanket 60 s `revalidate` because the fetchers are
also tag-invalidated and the tags do the real work. Auditing that first — as
the plan said to — turned up something worse than a stale cache.

> **Bug found.** `admin/variants.ts` and `admin/images.ts` called **no**
> revalidation at all. Seven mutations — variant add/update/delete/updateStock
> and image add/delete/setPrimary — change exactly what a storefront product
> card renders (`primaryImage`, `variants`, `inStock`), and none of them told
> the cache. An admin setting a new primary image saw the storefront keep the
> old one until the TTL happened to expire. This was live at 60 s and would
> have become an hour-long bug had I raised the TTL without checking.

**Done.** `revalidateCatalogue()` moved out of the products router into
`src/server/utils/revalidate-catalogue.ts` and is now called by all three
routers, all eleven mutations.

Only then was the TTL raised — to **5 minutes**, not the hour the plan
proposed. This audit found two write paths with no invalidation whatsoever, so
the demonstrated rate of missed tags here is not zero, and a stale-for-an-hour
storefront is a much worse failure than a stale-for-five-minutes one. Raise it
further once tag coverage has survived a few more features.

Stock changed by _customer orders_ still is not tag-invalidated, and
deliberately so: `VariantStockProvider` polls live stock and overrides the
cached flag within 15 s.

---

### PERF-09 — Nothing was prerendered, and no page had its own metadata ✅

**Done.** `generateStaticParams` on `/products/[slug]` (36 paths) and
`/collections/[slug]` (per active category). `generateMetadata` on both, plus
static `metadata` on the six fixed collection pages — every page previously
inherited the root layout's "Valkyrie - Premium Clothing", so search results and
shared links were indistinguishable. The product page also emits OpenGraph tags
with its primary image.

`dynamicParams` is left at its default, so a product or category added after a
build still renders on demand. This only removes work.

---

## Tier D — smaller, concrete

### PERF-10 — Two sequential awaits ✅

`getCachedProductBySlug` awaited images then variants in series — two round
trips where `Promise.all` pipelines into roughly one. `src/lib/cache.ts`

### PERF-11 — Infinite scroll started loading 100px too late ✅

`rootMargin` was `"100px"`, so the next page began loading once the customer was
essentially already at the bottom — they met the spinner every time, on every
page, however fast the query was. Now `800px`, roughly a screen of lead time.
`src/hooks/use-infinite-scroll.ts`

### PERF-12 — `ProductReviews` added a third waterfall ✅

Wrapped in `Suspense` with a sized fallback, so a client-side fetch below the
fold no longer participates in what blocks the server-rendered product page.

### PERF-13 — Ten dependencies removed ✅

Four had zero imports anywhere: `@stripe/react-stripe-js`, `@stripe/stripe-js`,
`bcryptjs`, `@trpc/next` (Stripe is used server-side through `stripe` and hosted
Checkout; Better Auth does its own hashing). Five were imported only by a
shadcn primitive that itself had no consumers — `carousel`, `command`,
`drawer`, `input-otp`, `resizable` — and `ui/chart.tsx` turned out to be dead
too, taking `@types/bcryptjs` with it.

Six dead files deleted, 47 → 38 production dependencies. **This does not change
the shipped client bundle** — unused routes were already tree-shaken — so it is
a build- and lint-time win, not a customer-facing one.

### PERF-14 — Nothing was code-split ✅

`recharts` is now loaded through `next/dynamic` in both places it is used, with
placeholders sized to the charts' actual column spans so the grid does not
reflow. `ssr: false` on the analytics page (a client component); plain dynamic
on the dashboard, where `ssr: false` is not permitted in a server component.

### PERF-15 — Composite indexes ⏳ _needs a database write_

`drizzle/0001_glossy_scourge.sql` adds `idx_products_active_created` and
`idx_orders_user_created`. I verified against the live database that the
migration's two catch-up `ADD COLUMN` statements are already satisfied, so
applying it creates **only the two indexes** — but the write itself was blocked
by a permission guard, correctly, since it is a schema change on a production
database.

**To do:** `pnpm db:push` (both indexes are declared in `src/db/schema.ts`), or
run the SQL file directly — it is written to be idempotent and safe on a
`db:push`-built database.

At 36 products and 44 orders these will not measurably help yet. They matter as
the catalogue grows.

### PERF-16 — Stock polling — noted, not changed

`VariantStockProvider` refreshes every 15 s per open tab showing a grid. Already
the fixed version of a worse problem (it was twelve polls), and React Query does
not poll hidden tabs. Recorded so the ongoing cost is known: if catalogue
traffic grows this is where it shows up first, and the answer is a longer
interval, not per-card queries.

---

## Still outstanding

> **Updated 2026-09-02.** Two of the three below were closed in the P3/Pass-2
> remediation pass; see `docs/superpowers/specs/2026-09-02-p3-pass2-design.md`.
> What is left is genuinely not code.

1. **PERF-06 — Neon autosuspend.** ⏳ **Still open, and still the largest
   remaining real-world contributor to "the live site feels slow".** Disable
   scale-to-zero or raise the suspend delay; confirm the app region matches
   `eu-central-1`. A cold connect was measured at 3851 ms against a warm query's
   58 ms — no amount of application work competes with that.
2. **PERF-15 — apply the migration.** ⏳ Still needs a database write.
   `pnpm db:push`, or run `drizzle/0001_glossy_scourge.sql` — verified
   idempotent. **Do not run `pnpm db:migrate`:** the database was built with
   `db:push`, so `__drizzle_migrations` is likely empty and migrate would try to
   replay the 0000 baseline against tables that already exist.
3. **PERF-07 — `DATABASE_POOL_MAX`.** ✅ **No longer a decision.** The default is
   deployment-aware: `process.env.VERCEL ? 1 : 5`, which is the measured answer
   for each deployment shape. An explicit env var still overrides it.

### Closed in the same pass

- **PERF-16 — stock polling.** ✅ Grid polling moved from 15 s to 60 s
  (`GRID_REFRESH_MS`, `STOCK_STALE_MS`). The cart's own check
  (`STOCK_CHECK_MS`) deliberately stays at 15 s: browsing tolerates a stale
  badge because the figure that protects the sale is re-checked at add-to-cart
  and again inside the order transaction, where variant rows are locked
  `FOR UPDATE`. The cart is where a stale figure becomes a failed checkout.
- **Search indexes.** `drizzle/0002_search_trgm.sql` is written and unapplied.
  `ILIKE '%term%'` has a leading wildcard that no btree index can serve, so it
  is a sequential scan; `pg_trgm` with `gin_trgm_ops` fixes that. Deliberately
  premature at 36 products — apply when the catalogue reaches the thousands.
- **A search bug found while looking at this.** The LIKE-escaping fix from #22
  had only reached the products repository. Both customer search paths still
  interpolated raw, so a search for `%` matched every row _and_ forced a full
  scan. Now routed through `containsPattern`.

### Corrections to this document

The **"Still open in this area"** note under ISSUES.md's P2-Performance section
claimed the collection pages "remain fully client-side". That was already false
when written — PERF-01 server-rendered them, which is what took the build from
83 static pages to 92. Corrected there.

`sharp` was checked because pnpm reports it among its ignored build scripts: it
loads correctly with libvips 8.17.3 and its prebuilt `@img/sharp-win32-x64`
binary. Sharp 0.34+ ships platform packages rather than compiling in a
postinstall, so the warning is vestigial and image optimisation is unaffected.

---

## Verification

```
pnpm type-check   clean
pnpm lint         0 errors, 4 warnings (was 5 — all pre-existing)
pnpm test         162 passed (was 124)
pnpm build        succeeds, 92 static pages (was 83)
```

`pnpm test:integration` has not been run against a database in this pass. The
existing integration suite was updated to construct its caller through
`createAnonymousCaller()` — the same path the new server components use — so
running it now also covers the server-rendering route.

New tests, all unit, no database:

| file                                         | tests | covers                                   |
| -------------------------------------------- | ----- | ---------------------------------------- |
| `server/utils/response-cache-policy.test.ts` | 14    | the CDN-caching rule, exhaustively       |
| `server/trpc.test.ts`                        | 14    | lazy context, memoisation, `touchedAuth` |
| `server/utils/auth-helpers.test.ts`          | 10    | role cache: hits, TTL, invalidation      |

---

## What I did not find

Recorded so a later pass does not re-check:

- **No remaining N+1 loops on hot paths.** Every `for`/`await` pair in
  `src/infrastructure` and `src/application` is either inside a write
  transaction (order creation, restock) or already batched.
- **The dashboard analytics query is well built** — five parallel aggregates,
  all pushed to SQL, no post-fetch filtering.
- **Index coverage is good.** `user_profiles.userId` and `session.token` are
  both `.unique()`, so the per-request auth lookups were already indexed.
- **The storefront never calls `cookies()` or `headers()`**, which is what made
  the static prerendering in PERF-01/02/09 available at all.

---

## A note on method

Two of the findings in the first draft of this document were wrong, and both
were caught by checking rather than reasoning.

**The pool.** I expected `max: 1` to be the headline bug and wrote the benchmark
to confirm it. It showed the opposite — `max: 1` is the _fastest_ setting for a
single request — and the naive fix would have made the common case ~65% slower.
The reason turned out to be worth knowing on its own: postgres.js pipelines, so
on a 58 ms link one connection beats four.

**The session role.** I claimed `generateSessionData` already put the role on
the session and `createContext` merely had to read it. Querying
`information_schema` showed the `session` table has no `role` column, so that
value was being computed and thrown away.

That reframes the whole audit. If a single round trip is the unit of cost, the
wins are wherever a round trip can be deleted or moved off the critical path —
which is exactly what Tier A turned out to be, and it is a different conclusion
from "make the queries faster".
