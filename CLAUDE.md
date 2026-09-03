# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Valkyrie ("val-store") — a premium streetwear e-commerce store, targeted at Egypt (phone parsing defaults to `EG`, Stripe charges in `egp`). Next.js 16 App Router + React 19 (React Compiler enabled), TypeScript strict, PostgreSQL via Drizzle, tRPC v11, Better Auth, Stripe + Cash-on-Delivery, UploadThing, Resend, Upstash rate limiting, Tailwind 4 + shadcn/ui, Zustand, Vitest.

Package manager is **pnpm** (v10, Node 22+). `pnpm-workspace.yaml` exists only to pin security overrides — this is not a monorepo.

Baseline as of last check (2026-09-03, after the storefront audit): `type-check` clean, `lint` **0 problems**, **330** unit tests passing, `build` producing 98 static pages, plus `pnpm test:integration`, which needs a database and is **38/41** — the three failures are `products.search` calling `headers()` outside a request scope through the in-process caller, which is a harness limitation rather than a product bug (verified: `search` is only ever reached from client components over HTTP, never via `createAnonymousCaller` and never inside `unstable_cache`).

Two things this file previously claimed that were not true, corrected here because they cost time to re-derive: lint reports **no warnings at all** — the three `@next/next/no-location-assign-relative-destination` warnings described in earlier versions do not fire — and the test count was 270 before the audit added 60.

**Clear `.next` before trusting `pnpm type-check`.** A stale `.next/dev/types/routes.d.ts` or `.next/types/validator.ts` produces errors about routes that no longer exist, which look like real breakage and are not. `rm -rf .next && pnpm type-check`.

## Commands

```bash
pnpm dev              # dev server
pnpm build            # production build
pnpm lint             # eslint (next core-web-vitals + typescript)
pnpm type-check       # tsc --noEmit
pnpm test             # vitest run — unit only, no database needed. This is what CI runs.
pnpm test:integration # vitest against a REAL database (reads DATABASE_URL from .env)
pnpm vitest run src/domain/orders/entities/order.test.ts   # single test file
pnpm vitest run -t "canTransitionTo"                        # single test by name

pnpm db:push          # the day-to-day schema workflow — see the note below
pnpm db:studio        # Drizzle Studio
pnpm seed             # admin user, 12 categories, 35+ products, orders, reviews, coupons, CMS content
pnpm seed:basic       # minimal seed
npx tsx scripts/set-admin.ts <email>   # promote a user to super_admin
```

**Migrations: four files, two journal entries, and the baseline was wrong until 2026-09-03.** `drizzle/` holds `0000_long_ultragirl` (the baseline, all 27 tables), `0001_glossy_scourge` (two composite indexes, **applied**), `0002_search_trgm` (GIN trigram indexes, **not applied**, needs owner privileges, deliberately not urgent at 36 products) and `0003_backfill_currency`. `meta/_journal.json` lists only `0000` and `0001`, so **`pnpm db:migrate` will not run `0002` or `0003`** — both are applied out of band with `db:push` or from the Neon SQL editor, and both say so in their own headers.

**The bug worth remembering:** the baseline and both `meta/*_snapshot.json` files created `orders.currency`, `payments.currency` and `site_settings.currency` as `DEFAULT 'USD'` while `src/db/schema.ts` declared `EGP`. The same schema built two ways disagreed — `db:push` gave EGP, `db:migrate` gave USD — so a database rebuilt through the migration path would have reintroduced the currency bug on a fresh install. All three files now say EGP. If you edit a shipped migration again, note that it changes the file hash, so a database that already ran it will refuse to migrate; that was acceptable here only because the database was being rebuilt.

Day-to-day schema work still goes through `db:push`. **On a database that was built with `db:push`, mark the baseline as applied rather than running it** — the tables are already there.

CI (`.github/workflows/ci.yml`) runs lint → type-check → vitest on push to `main`/`feature/*` and on PRs.

Husky enforces `lint-staged` (eslint --fix + prettier) on commit and **commitlint** on the message: conventional commits, restricted type-enum, **sentence-case subject**, no trailing period, ≤100 chars. Example from history: `refactor(admin): Reorganize components, split settings router, add layout auth check`.

`docker-compose.yml` provides local Postgres/Redis/pgAdmin if you don't have a hosted DB.

## Architecture

Strict onion architecture. Dependencies point inward; **never import infrastructure or Drizzle from `domain/`**.

```
src/domain/          entities, value objects, repository *interfaces*, exceptions — zero dependencies
src/application/     use cases + per-domain DI "module" factories
src/infrastructure/  Drizzle repository implementations, Stripe/Resend services
src/server/          tRPC routers — thin adapters only
src/app/             Next.js routes: (auth), (main) storefront, admin, api
```

### Dependency injection

`src/application/container.ts` is a singleton that spreads 12 domain modules (`createProductModule()`, `createOrderModule()`, …) into one flat object. Each module (e.g. `src/application/products/product.container.ts`) lazily memoizes its repositories and use cases behind `getXRepository()` / `getXUseCase()` getters.

Checkout depends on cart + order repos, so `createCheckoutModule()` takes them as a `deps` argument to avoid a circular import — follow that pattern if a new module needs to cross domains.

**Routers should not contain business logic.** The correct shape is: Zod-validate input → `container.getSomethingUseCase()` → return. Two known deviations, both drift rather than intent:

- `admin/{coupons,reviews,inventory,notifications,customers}` and `public/{reviews,notifications,newsletter}` instantiate repositories at module scope or hit `db` directly.
- A few application-layer files import Drizzle types from `@/db/schema` (`address.use-cases.ts`, `validate-coupon.use-case.ts`, `adjust-stock.use-case.ts`), which technically breaks the inward-only rule.

### tRPC

Root router is `src/server/index.ts` → `{ admin, auth, public }`. `src/server/trpc.ts` defines `publicProcedure`, `protectedProcedure` (session required), and **two admin tiers**: `adminProcedure` (roles `worker`/`admin`/`super_admin` — every admin **query**) and `adminWriteProcedure` (`admin`/`super_admin` — every admin **mutation**).

**The tiers are asymmetric and that is the trap.** `adminProcedure` is the permissive one, so a new mutation written with it is silently writable by a read-only `worker`, and nothing about that is a type error. `src/server/admin-write-gating.test.ts` is the guard: it scans the routers and fails if a mutation is on the read tier, if a query is over-gated, or if the scan stops matching anything. Three mutations sit on the read tier deliberately — `admin.notifications.{markAsRead,markAllAsRead,delete}` touch only rows scoped to `ctx.user.id`, so a worker keeps their own notification bell.

**Context is lazy, and that is load-bearing in two directions.** `TRPCContext` exposes a memoised `getUser()` rather than a resolved `user`; `isAuthed`/`isAdmin` await it, so handlers below them still read `ctx.user` as a non-null `AuthUser`. A `publicProcedure` that never asks does **zero** auth queries — which is the point, since catalogue reads used to pay for a session lookup plus a `user_profiles` role query before running. Roles live in `user_profiles`, **not** on the Better Auth `user` table, and are cached in-process for 60s (`invalidateUserRole` drops one on write). The `session` table has no `role` column, so do not try to read a role off the session — a `generateSessionData` that did exactly that was removed as dead.

The other direction is caching: `ctx.touchedAuth()` reports whether anything in the request resolved the user, and `responseMeta` in `src/app/api/trpc/[trpc]/route.ts` uses it to decide whether the HTTP response may be cached publicly. **`httpBatchLink` puts several calls into one HTTP response**, so one user-scoped call in a batch would poison a shared cache. The rule lives in `src/server/utils/response-cache-policy.ts` — pure and exhaustively tested — and fails closed. If you add a procedure that reads user data, make sure it goes through `getUser()`; that is what keeps its response out of the CDN.

`createAnonymousCaller()` (`src/server/caller.ts`) is how server components reach storefront procedures in-process. Everything reached through it must be a `publicProcedure`.

Client access is `trpc.<admin|auth|public>.<router>.<procedure>` via `src/lib/trpc.ts`; `vanillaTrpc` exists for imperative calls outside React Query (used by the login form).

Note: most `public.*` routers are actually `protectedProcedure` (cart, checkout, orders, wishlist, address, profile, coupons, notifications) — "public" means "storefront", not "unauthenticated".

**Every procedure now has a caller.** `public.categories.list` was the last one without — it drives the storefront navigation as of 2026-09-03 (`getCachedNavCategories`), so an admin creating a category gets a link and deleting one no longer leaves a 404. `admin.settings.getAllContentSections`, which earlier versions of this file listed as uncalled, had already been deleted. This list used to be long; verified 2026-09-02, everything else on it has been resolved one way or the other. Deleted outright: the whole `public.config` router, `public.categories.getFeatured`, `public.products.{getBySlug,getFeatured}`, `admin.products.getBySlug` and `admin.notifications.clearAll` — mostly collateral from the homepage moving to server components. Now have callers: `public.categories.list`, `admin.settings.{getContentHistory,revertToVersion}` (via `ContentHistoryDialog`), `admin.categories.{create,delete}`, `admin.variants.updateStock` and the featured-item mutations.

### Auth

Better Auth (`src/lib/auth.ts`) with email+password, Google, Facebook. Its tables live in the root `auth-schema.ts` (with `phone` and `birthday` added to `user`) and are re-exported through `src/db/schema.ts`.

- A `databaseHooks.user.create.after` hook auto-creates the `user_profiles` row (default role `customer`) and a phone-keyed `customers` row.
- Client-side typing for the custom fields lives in `src/types/auth.ts` (`ExtendedSignUpEmail`) to avoid `any`.
- **Login accepts email or phone, and the server decides which.** The form posts `identifier + password` to one mutation, `public.auth.signIn`. That procedure classifies the identifier (`PhoneValueObject.looksLikePhone`), normalizes a phone to E.164 (`toE164`, default country `EG`), resolves it to an email internally, calls `auth.api.signInEmail`, and forwards the resulting `Set-Cookie` onto the tRPC response — which is the only reason `TRPCContext` carries `resHeaders`. It replaced `auth.getEmailByPhone`, a public procedure that returned the account's email for any phone number handed to it. **Every failure returns one message**; distinguishing "no such account" from "wrong password" is what made the old endpoint an enumeration oracle. Two Upstash limits guard it, per IP and per normalized identifier — and they are the only ones on that path, because `auth.api.*` bypasses the Better Auth handler along with its own `rateLimit.customRules`. The form navigates with `window.location` rather than `router.push` on success: the session came from a tRPC `Set-Cookie`, not the Better Auth client, so the client session store every `useSession` reads is still holding its signed-out value until a real page load.
- Rate limiting no-ops silently when `UPSTASH_*` env vars are absent (local dev).

Admin access is gated in three places that must stay in sync: `src/proxy.ts` (edge, cookie existence only), `src/app/admin/layout.tsx` (server session + role), and the procedure tier. The layout and `adminProcedure` both ask `isAdminAreaRole`, so they cannot drift into a screen that renders and then rejects everything on it.

The role predicates live in `src/domain/customers/value-objects/user-role.ts`, **not** in `auth-helpers.ts`, because that file imports `@/db` — a client component importing a predicate from there would pull Drizzle into the browser bundle. `auth-helpers` re-exports them for server code; `useAdminWriteAccess` and `AdminReadOnlyBanner` use the domain module.

### Data model

`src/db/schema.ts` (~880 lines) is the single source of truth; relations are split into `src/db/relations.ts` to dodge circular initialization. Note there is **no `orders → user` relation**, which is why the dashboard and admin-customers code join `user` manually.

Two identity concepts coexist:

- Better Auth `user` + `user_profiles` (role) — what login, orders, cart, and the admin "Customers" page actually use.
- `customers`, keyed on **phone**, modeling "a real human" so multiple accounts can map to one person (loyalty points, totals, admin notes). Written by the signup hook, read by essentially nothing; `GetOrCreateCustomerUseCase` has no callers.

Deletion semantics differ by entity: products soft-delete (`isActive = false`), categories **hard-delete**. `categories.parentId` still has no FK constraint, so the protection against orphaning a parent's children is application-level — `DeleteCategoryUseCase` refuses to delete a category that has children or products. Anything writing outside that use case can still orphan rows.

Money is stored as Postgres `decimal` strings and parsed with `parseFloat` at the repository boundary.

### CMS + caching

Homepage sections are server components reading through `src/lib/cache.ts` (`unstable_cache`, 60s revalidate, tagged). Each wraps its fetch in try/catch and falls back to hardcoded defaults, so a DB failure degrades instead of crashing — preserve that when editing.

Section content is JSON validated by the Zod schemas in `src/domain/site/value-objects/content-schemas.ts`. **Only `hero` and `announcement` are wired end to end.** `promo_banner`, `brand_story`, `newsletter`, and `instagram` have schemas, DB rows, seed data, and a public API, but their components (`PromoBanner`, `BrandStory`, `NewsletterSection`) use hardcoded props and the admin has no editors for them.

Adding a new section type means touching all of: `contentSchemaMap` in the schema file, `sectionTypeSchema` in `src/server/routers/admin/settings/content-sections.ts`, the enum in `src/server/routers/public/config.ts`, the admin editor, **and** an actual consumer. Admin writes call `revalidateTag("cms-<type>")`.

### Cart

Zustand store (`src/lib/stores/cart-store.ts`) persisted to localStorage, hydrated from the server by `CartProvider`. `useCart()` in `src/components/providers/cart-provider.tsx` is the API components should use — it wraps the store with server mutations, optimistic updates, and a 1s debounce on quantity changes. Guests cannot add to cart; `addItem` shows a sign-in toast instead.

Navbar/cart badges use `useSyncExternalStore` to force 0 during SSR — Zustand's localStorage rehydration otherwise causes hydration mismatches.

### Checkout & orders

Both payment paths create a `pending` order plus a `pending` `payments` row **first**, then diverge:

- **COD** → redirect to `/checkout/success?order_id=…`
- **Stripe** → hosted Checkout Session; session id stored in `payments.transactionId`; `/api/webhook/stripe` verifies the signature, sets order `paid` + payment `completed`, sends the confirmation email, clears the cart.

Order numbers are `VLK-YYYYMMDD-XXXXXX`, generated in `DrizzleOrderRepository.create` inside a transaction that writes order + items + payment together — and that also decrements variant stock, logs a `sale` row in `inventory_logs`, and records coupon usage, so an order never commits without its side effects.

Some of `OrderEntity` is resolved by the repository rather than carried on the row: `orderNumber` (assigned at insert, null on the entity being written), `shippingAddress`/`billingAddress` (joined `OrderAddress` values alongside the raw ids), and `customer` (there is no `orders → user` relation, so `loadCustomers()` does one batched `inArray` query per call — never one per row). All are null on write and populated on read.

Returns are **partial and derived**: `order_items.refundedQuantity` is the only stored fact, and `refundedAmount()` / `getRefundedItems()` compute from it, scaled by `paidFraction()` so a coupon order refunds what the customer actually paid. Nothing caches a refund total that could drift.

Status changes go through the `OrderStatus` value object's transition table — the repository rejects invalid transitions, so a new status must be added to the DB enum, the entity's `OrderStatus` union, the value object's `transitions` map, and the admin dropdown together.

## Known gaps

Re-verified against the code on 2026-09-02. Read this before touching the relevant area. **`docs/ISSUES.md` has the full catalogue** — exact file:line locations, root cause, and a concrete fix for each, plus a suggested order of work and a `Resolved` section recording what each fix actually did and what stays easy to break again. The summary below is the index.

Every P0, every P1 and every P2 is now fixed. The 2026-09-02 verification pass re-checked every remaining entry against the code and found **23 that were already done and still listed as open** — including the confirmation email this file called "the one real feature gap" for a whole pass after it was fixed. Assume nothing here is current without checking; that is exactly the failure it just caught.

What is actually left:

### Two themes, one `:root` — the recurring trap

`:root` holds the **light** palette and the storefront overrides only `<body>` (`bg-black text-white`), so a shadcn primitive styled with tokens renders light-on-dark on the storefront; anything Radix portals attaches to `<body>` and escapes the admin's `ThemeProvider` too. This has produced six separate white-on-white/white-on-black bugs, each found by a person looking at a screen rather than by any test. **The root cause is fixed as of 2026-09-03.** `<body>` no longer carries colour literals: `globals.css` has always had `@layer base { body { @apply bg-background text-foreground } }`, but the utility classes on `<body>` outranked it, pinning the body to white text under _both_ palettes — so every Radix portal inherited `text-white` even in the light-themed admin. `.dark` now _defines_ `--background`/`--foreground` as pure black/white, so the storefront renders exactly as before while the base layer wins. Measured with headless Edge: a portalled surface with a background and no foreground went from **1.00:1 (invisible)** to **19.80:1** under the light palette. `calendar.tsx` and the `outline` button variant were the two unpaired consumers and are paired now. Rules in [Conventions](#conventions) — follow them for any new surface, because the default is now correct rather than merely patched. Note the trap that caught `ProductReviews`: the **default `Button` variant** is `bg-primary text-primary-foreground`, near-black on near-white, so a plain `<Button>` on the storefront is nearly invisible. Storefront buttons need `bg-val-accent text-black`, and `variant="outline"` needs `bg-transparent` or it renders as a white pill.

### Features that exist but do nothing

Only one of the six entries this section used to list is still true.

- ~~The `worker` role does nothing~~ — **implemented 2026-09-03 as the read-only tier.** A worker opens every admin screen and can change nothing; see [tRPC](#trpc) for the two procedure tiers and the guard test. **What it does not buy:** a worker still reads every customer's address and order history, because read-only constrains writes, not scope. Splitting catalogue work from customer data is a larger change and was not taken. Individual write controls are also still rendered — the server rejects them and `AdminReadOnlyBanner` explains why, but they are not disabled per control yet.

Verified done 2026-09-02, listed so nobody re-does them:

- ~~CMS version history has no UI~~ — `src/components/admin/settings/ContentHistoryDialog.tsx` calls `getContentHistory` and `revertToVersion`.
- ~~Four of six CMS section types are unreachable~~ — the four were **deleted** rather than wired. `contentSchemaMap` holds `hero` and `announcement` only, and adding a new type means touching every place listed in [CMS + caching](#cms--caching).
- ~~Most site settings are unused~~ — `logoUrl`, `faviconUrl`, `storeTagline`, `defaultMetaTitle`, `contactEmail` and `contactPhone` all have consumers.
- ~~Guest cart persistence is unreachable~~ — `public.cart.mergeGuestItems` folds a local cart into the server cart at sign-in. Only ids and quantities cross the wire; price and stock are re-resolved server-side, because a guest cart can sit in localStorage for days.
- ~~Billing addresses never exist~~ — `addressSchema` carries `addressType: z.enum(["shipping", "billing"])`, and checkout takes a separate required `billingAddressId` that `CreateOrderUseCase` verifies belongs to the caller.

### Dead code — cleared

This section used to list five kinds of dead code. All of it is gone, verified 2026-09-02: the unused value objects (`Money`, `Email`, `ProductSKU`, `AddressValueObject`) are deleted, so are `ProductSidebar`, `CreateProductHeader`, `AddToCartButton` and `CollectionPageLayout` and the duplicate `account/AddressList.tsx` / `AddressFormDialog.tsx`, and no build artifacts are tracked. Every file in `src/components/ui/` has an importer.

`PasswordValueObject` is no longer dead either — `hooks.before` in `src/lib/auth.ts` runs `PasswordValueObject.validate` on `/sign-up/email` and `/reset-password`, so the strong-password rules it declares are now actually enforced server-side.

Still worth knowing: six shadcn primitives were deleted (`carousel`, `chart`, `command`, `drawer`, `input-otp`, `resizable`) along with ten unused dependencies. If you reach for one of those, reinstall it deliberately — do not assume it is still there.

### Performance

Two passes are done and **`docs/PERFORMANCE.md` is the current record** — measured numbers, what changed, and what is still outstanding. The short version:

- **The unit of cost is a round trip**, not a slow query. The database is Neon in `eu-central-1`: ~58ms warm, ~560ms to open a cold connection. postgres.js **pipelines** queries down one connection, so four queries issued together cost about _one_ round trip — which is why `max: 1` is the fastest pool setting for a single request and why `DATABASE_POOL_MAX` defaults to 1. Raise it to 5 only for a long-lived Node server; see the table in `src/db/index.ts`.
- **Collection pages are server components.** `/collections/*` resolve page 1 through `getCachedFirstProductPage` and seed the client grid with `initialData`, so they prerender with products in the HTML. `/products/[slug]` and `/collections/[slug]` have `generateStaticParams`. When adding a collection page, follow that shape — do not add another client component that fetches on mount.
- **The cached fetchers call the routers**, not reimplementations of their queries, so a server-rendered page 1 cannot drift from the page 2 the client fetches.

One thing is still outstanding and it is outside the code: Neon's autosuspend (a multi-second wake on the first request after idle — the most likely remaining cause of "the site feels slow"). **`0001_glossy_scourge.sql` IS applied** — verified against the live database 2026-09-03, `idx_orders_user_created` and `idx_products_active_created` both exist; every doc that said otherwise was wrong. `0002_search_trgm.sql` is genuinely unapplied (no `pg_trgm`, no trigram indexes) and deliberately not urgent: at 36 products a sequential scan beats the index, and it needs privileges the app role may not have. See the migrations note above for why `db:migrate` will not run it.

### Smaller things

- ~~The three `currency` column defaults are `'USD'`~~ — **fixed 2026-09-03** in the baseline, both snapshots, and the live database (defaults only, zero rows touched). The 25 `USD` rows still in `orders` are seed fixtures with no payment rows, not mischarged orders, so the backfill half of `drizzle/0003` was deliberately not run — rewriting them would assert a charge that never happened. Nothing reads either column yet.
- `NEXT_PUBLIC_APP_NAME` is read by the email service but is in neither `.env` nor a tracked `.env.example` — there is no `.env.example` in the repo, since `.gitignore` matches `.env*`. Falls back to "Valkyrie".
- ~~One procedure still has no caller.~~ None do, as of 2026-09-03 — see the tRPC section.
- ~~Footer links to pages that do not exist~~ — `/size-guide`, `/careers`, `/sustainability`, `/press` and `/blog` all build now.
- ~~`/collections/new` filters on `isFeatured`, `/collections/accessories` applies no filter~~ — replaced wholesale 2026-09-03. "New" is now a recency window (`NEW_ARRIVAL_WINDOW_DAYS`) shared by the collection page, the homepage carousel and the `/collections` index, because four surfaces claimed to show new arrivals and no two agreed.
- ~~Hardcoded dollar shipping copy~~ — `ShippingOptions` no longer quotes the `$5.99 / $14.99 / $24.99` tiers.

### Traps in the code that is now fixed

These are working. They are listed because each is easy to break again — the full version of each is in the `Resolved` section of `docs/ISSUES.md`.

- **Raw `sql` in a relational query rewrites every column to the root table.** Inside `db.query.<table>.findMany({ where: sql`…` })`, Drizzle rewrites _every embedded column object_ to the query's root table, whatever table it actually belongs to: `${payments.orderId}` renders as `"orders"."order_id"` and Postgres rejects it with 42703. The core builder (`db.select().from(…)`) does not do this. That asymmetry is what made `count()` and `findAll()` emit **different SQL from the same filter builder** — count worked, the admin orders list 500'd on its Refundable and Returned filters. The rule, in `buildFiltersConditions` in the order repository: outer references stay column objects (a root-table column rewrites to itself, so it is right either way); the subquery's own columns are written as literal `alias.column` text. Table names as `${table}` are safe — only columns are rewritten. Putting `${payments.paymentStatus}` back looks like a type-safety improvement and silently restores the bug.
- **A category resolves to itself plus its descendants.** Every product is filed against a _leaf_ category while the navigation links to parents, so `eq(products.categoryId, id)` matched the zero products filed directly against a parent — `/collections/women` rendered "No products found" on a store with 13 women's products. Use `collectCategoryTree` and `ProductFilters.categoryIds`, never `categoryId`, for a collection page.
- **A static route under `/collections/` silently shadows a category of the same slug.** Next resolves a static segment before a dynamic one, so `/collections/men` never reached `[slug]`. `RESERVED_COLLECTION_SLUGS` plus `reserved-slugs.test.ts` — which reads the route directory — enforces both directions: an admin cannot name a category over a static route, and a new static route fails the suite unless it is declared.
- **Orders carry their own copy of the address.** `orders.shipping_address_snapshot` / `billing_address_snapshot` are jsonb, written at checkout and authoritative on read; the joined address is only a fallback for older rows. This is what lets a customer delete a saved address and lets an account be deleted at all — the three FKs involved (`orders.*_address_id`, `inventory_logs.created_by`) are `ON DELETE SET NULL` as of `drizzle/0004`, which is **not journalled** and must be applied by hand.
- **Order numbers retry on collision.** `order_number` is unique and its insert shares a transaction with the items, payment, stock and coupon writes, so a duplicate used to abort the whole checkout. `create()` retries with a fresh number, and only for a name clash — `isOrderNumberCollision` walks the `cause` chain, because Drizzle wraps the driver error and the Postgres code is _not_ on the object you catch.
- **`count(*)` returns a string unless you cast it.** `sql<number>` is a compile-time assertion; postgres.js hands back `bigint` as a string. Every count uses `count(*)::int` — but treat that as a rule to enforce, not a fact to rely on. This file asserted it as settled and it was false: an audit on 2026-09-03 found **six** uncast `COUNT(*)` sites in `dashboard.repository.ts` alone, typed `sql<number>` and returning strings, while the same file cast correctly three lines away. All six are fixed. The lie was invisible because every consumer happened to coerce — a template literal or a division — so nothing broke and nothing flagged it. Grep `sql<` before trusting this line again.
- **Paginated queries need a tiebreaker.** `ORDER BY created_at DESC` alone is not a total order, and a seeded catalogue writes 35 products with the same timestamp — paging duplicated some products and skipped others. Every paginated `orderBy` appends the primary key.

- **Notifications swallow their own failures** and log `[Notifications] <label> failed:`. An emit that breaks is invisible in the UI, so read the server log before the code. Low stock fires on the **crossing**, not the level. A partial return is not a status change, which is why refunds notify through `orderRefunded()` rather than the status hook.
- **Featured items fall back** when the curation is empty _or_ when every curated item has since been deactivated. Never render the section heading above an empty grid.
- **Categories delete hard, products soft.** `categories.parentId` still has no FK; the orphan guard is application-level in `DeleteCategoryUseCase`. The delete guard and the table's product count both count archived products, deliberately.
- **`admin.variants.update` no longer accepts `stockQuantity`.** All stock moves through `AdjustStockUseCase` so every movement leaves an audit row. Opening stock on a _new_ variant is not a movement and writes no row.
- **Password reset answers identically** for registered and unregistered addresses. That is anti-enumeration, not an oversight.
- **Currency is deployment config** (`NEXT_PUBLIC_STORE_CURRENCY`, default `EGP`) via `src/lib/currency.ts`, not a DB setting — a Stripe account is bound to the currency it charges in.
- **`admin.products.create` takes images and variants** and writes all three in one transaction; the edit page still saves them one at a time on purpose.

## Conventions

- Path alias `@/*` → `src/*`.
- Prettier: double quotes, semicolons, 80 cols, es5 trailing commas, LF.
- Storefront is hard-coded dark (`bg-black text-white` on `<body>`) with brand tokens `val-accent` / `val-accent-light` / `val-silver` / `val-steel` (steel-blue/silver, defined in `src/app/globals.css`). Admin is light-themed via its own `ThemeProvider` (`storageKey: "admin-theme"`).
- **Two themes, one set of shadcn primitives — check the primitive before styling a consumer.** `:root` is the light palette and `<body>` is `bg-black text-white`, so anything Radix renders through a **portal** (dialog, alert-dialog, drawer, sheet, popover, select, dropdown, context-menu, menubar, hover-card, tooltip, command) escapes the admin's theme wrapper and inherits the storefront's white text. A portalled surface must therefore set **both** halves of a pair — `bg-background text-foreground`, `bg-popover text-popover-foreground`, `bg-foreground text-background` — never a background alone. `AlertDialogContent` set only `bg-background` and rendered white-on-white in the admin; `DialogContent` had the pair and was fine. When a dialog looks wrong in one theme, fix `src/components/ui/*.tsx` so every consumer gets it, rather than patching a `text-foreground` onto the one call site.
- **Only style with tokens that exist.** `globals.css` defines `--destructive` but **no `--destructive-foreground`**, so `text-destructive-foreground` silently applies nothing and the element inherits — which reads as "working" against whichever body colour happens to be behind it. Prefer `buttonVariants({ variant: "destructive" })` (it uses `text-white`) over hand-written colour classes, and grep `globals.css` before reaching for a `--*-foreground` you have not seen there.
- Domain classes use constructor-parameter properties (`ProductEntity`, `OrderEntity`, `CartItemEntity`) or private-props + static factory (`Customer`, `SiteSettingsEntity`); value objects use private constructors with static `create`/`from*`. Entities that mutate return new instances rather than mutating in place.
- `zod` is imported both as `"zod"` and `"zod/v4"` depending on the file — match whatever the file already uses.
- **Any admin write that changes what a product card shows must call `revalidateCatalogue()`** (`src/server/utils/revalidate-catalogue.ts`). A card renders `primaryImage`, `variants` and `inStock`, so the variants and images routers count just as much as the products one — all three were found silently stale because only products announced its writes. The catalogue TTL (5 min, `CATALOGUE_REVALIDATE` in `src/lib/cache.ts`) is a backstop; the tags are the actual correctness mechanism, which is why the TTL is not longer.
- **Two suites.** `pnpm test` is unit-only and needs no database — `src/**/*.test.ts`, colocated with what they cover, and the only thing CI runs. `pnpm test:integration` runs `src/**/*.integration.test.ts` against a real database via `vitest.integration.config.ts`; it is excluded from the default `include` so it can never break CI, which has no `DATABASE_URL`.
- **Integration tests are read-only by rule.** They assert that the SQL the repositories emit agrees with the domain logic it replaced — `refundableOnly` against `OrderEntity.canRefund()`, `returnedOnly` against `getRefundedItems()`, the batched card lookups against the per-product ones. That comparison is the whole point, so keep them read-only and safe to point at real data. They log a summary of what they found, so a failure is diagnosable from the output alone.
- Component tests still do not exist; there is no DOM testing library installed. Where client logic is worth testing, extract it into a plain module and test that instead — `src/lib/variant-stock-registry.ts` is the pattern: the ref-counting lives outside React, and `VariantStockProvider` is a thin wrapper over it.

## Docs in-repo

`docs/ISSUES.md` is current and verified — the defect catalogue described above.

`docs/POST-LAUNCH.md` is the other half: work deferred past the production cutover, the checks that belong at the cutover, and the limitations that were chosen rather than missed. Nothing in it is a defect. **Read it before adding anything to the issues catalogue** — several entries there look like bugs and are decisions, and the cutover section names the one setting whose absence fails silently (`UPSTASH_*`, without which every rate limiter no-ops with no warning).

`docs/PERFORMANCE.md` is the performance record — measured numbers, what changed, what is still outstanding.

`docs/REFUNDS.md`, `docs/LOYALTY-POINTS.md` and `docs/PHONE-VERIFICATION.md` are **planned work, not defects**. Refunds record a return correctly but move no money — deliberate, pending the payment gateway decision, with the interim exposure stated (the admin button says "Refund", so refunds must be issued by hand in the provider's dashboard until then). Loyalty and phone verification are designed and agreed but entirely unbuilt: no table, no column, no code.

**That is the whole of `docs/` now.** Fifteen files were deleted on 2026-09-03: eight pre-implementation domain roadmaps, `connections.md`, a merged branch’s UI checklist, the P0/P1/P3 test plans, and the plan and spec for a pass that had shipped. All of them described intent or a finished branch rather than current state, which is the specific way documentation becomes actively misleading — this catalogue had already been caught listing 23 fixed items as open. `git log --diff-filter=D -- docs/` recovers any of them.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
