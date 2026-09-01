# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Valkyrie ("val-store") — a premium streetwear e-commerce store, targeted at Egypt (phone parsing defaults to `EG`, Stripe charges in `egp`). Next.js 16 App Router + React 19 (React Compiler enabled), TypeScript strict, PostgreSQL via Drizzle, tRPC v11, Better Auth, Stripe + Cash-on-Delivery, UploadThing, Resend, Upstash rate limiting, Tailwind 4 + shadcn/ui, Zustand, Vitest.

Package manager is **pnpm** (v10, Node 22+). `pnpm-workspace.yaml` exists only to pin security overrides — this is not a monorepo.

Baseline as of last check (2026-08-31): `type-check` clean, `lint` 0 errors / 5 unused-var warnings, 124 unit tests passing, plus an integration suite that needs a database.

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

**Migrations were regenerated and are current.** `drizzle/` used to hold three stale files describing an abandoned schema; it is now a single baseline, `0000_long_ultragirl.sql`, covering all 27 tables in `src/db/schema.ts`, with one matching entry in `meta/_journal.json`. Day-to-day schema work still goes through `db:push`; `db:generate`/`db:migrate` are real commands again for a deploy. **On a database that was built with `db:push`, mark the baseline as applied rather than running it** — the tables are already there.

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

Root router is `src/server/index.ts` → `{ admin, auth, public }`. `src/server/trpc.ts` defines `publicProcedure`, `protectedProcedure` (session required), `adminProcedure` (role `admin`/`super_admin`).

Context is built per-request from the Better Auth session, then the role is looked up from `user_profiles` (roles live there, **not** on the Better Auth `user` table). Client access is `trpc.<admin|auth|public>.<router>.<procedure>` via `src/lib/trpc.ts`; `vanillaTrpc` exists for imperative calls outside React Query (used by the login form).

Note: most `public.*` routers are actually `protectedProcedure` (cart, checkout, orders, wishlist, address, profile, coupons, notifications) — "public" means "storefront", not "unauthenticated".

Several procedures have no caller at all. Before extending one, check whether anything uses it: the whole `public.config` router, `public.categories.{list,getFeatured}`, `public.products.{getBySlug,getFeatured}`, `admin.products.getBySlug`, `admin.notifications.clearAll`, and `admin.settings.{getAllContentSections,getContentHistory,revertToVersion}`. Mostly collateral from the homepage moving to server components. (`admin.categories.{create,delete}`, `admin.variants.updateStock` and the featured-item mutations were on this list and now have callers.)

### Auth

Better Auth (`src/lib/auth.ts`) with email+password, Google, Facebook. Its tables live in the root `auth-schema.ts` (with `phone` and `birthday` added to `user`) and are re-exported through `src/db/schema.ts`.

- A `databaseHooks.user.create.after` hook auto-creates the `user_profiles` row (default role `customer`) and a phone-keyed `customers` row.
- Client-side typing for the custom fields lives in `src/types/auth.ts` (`ExtendedSignUpEmail`) to avoid `any`.
- **Login accepts email or phone.** The form heuristically detects a phone, normalizes to E.164 (`PhoneValueObject.toE164`, default country `EG`), then calls `auth.getEmailByPhone` — IP rate-limited via Upstash specifically to block phone enumeration.
- Rate limiting no-ops silently when `UPSTASH_*` env vars are absent (local dev).

Admin access is gated in three places that must stay in sync: `src/proxy.ts` (edge, cookie existence only), `src/app/admin/layout.tsx` (server session + role), and `adminProcedure`.

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

Verified against the code on 2026-08-31. Read this before touching the relevant area. **`docs/ISSUES.md` has the full catalogue** — exact file:line locations, root cause, and a concrete fix for each, plus a suggested order of work and a `Resolved` section recording what each fix actually did and what stays easy to break again. The summary below is the index.

Every P0 and all but one P1 are now fixed. What is left:

### The one real feature gap

- **The Stripe confirmation email is dishonest** (ISSUES #16). `src/app/api/webhook/stripe/route.ts:93,104` builds the email from the Stripe session rather than the order it just updated: it sends `session.id.slice(-12)` as the "order number" (matching nothing the customer can look up) and the literal text "Address will be confirmed separately". COD orders get no email at all. Deferred until a domain is verified in Resend, not forgotten — the real `orderNumber` and a resolved `shippingAddress` are both already on the order entity.

### Two themes, one `:root` — the recurring trap

`:root` holds the **light** palette and the storefront overrides only `<body>` (`bg-black text-white`), so a shadcn primitive styled with tokens renders light-on-dark on the storefront; anything Radix portals attaches to `<body>` and escapes the admin's `ThemeProvider` too. This has produced six separate white-on-white/white-on-black bugs, each found by a person looking at a screen rather than by any test. All six are patched; the root cause is not. Rules in [Conventions](#conventions) — follow them for any new surface. Note the trap that caught `ProductReviews`: the **default `Button` variant** is `bg-primary text-primary-foreground`, near-black on near-white, so a plain `<Button>` on the storefront is nearly invisible. Storefront buttons need `bg-val-accent text-black`, and `variant="outline"` needs `bg-transparent` or it renders as a white pill.

### Features that exist but do nothing

- **CMS version history has no UI.** `content_sections_history`, the repository methods, and `revertToVersion` all work; nothing calls them.
- **Four of six CMS section types are unreachable.** `promo_banner`, `brand_story`, `newsletter` and `instagram` have schemas, DB rows, seed data and a public API; their components use hardcoded props and the admin has no editors.
- **Most site settings are unused.** Only `storeName` and the four social URLs (both in the Footer) are consumed. `logoUrl`, `faviconUrl`, `storeTagline`, `defaultMetaTitle`, `defaultMetaDescription`, `contactEmail`, `contactPhone` are settable but read nowhere.
- **The `worker` role** is in the enum and entity but never checked.
- **Guest cart persistence** exists in the store but `addItem` shows a sign-in toast instead, so the guest branch never runs.
- **Billing addresses never exist.** `public.address.create` hardcodes `addressType: "shipping"`, and checkout reuses the shipping address id for both.

### Dead code

- Value objects written but never used: `Money`, `Email`, `PasswordValueObject` (enforces strong-password rules no form applies — signup and reset both check only length ≥ 8), `ProductSKU`, `AddressValueObject`. Wired in: `PhoneValueObject`, `CategorySlug`, `OrderStatus`, and the shared `slugify`.
- Unused components: `ProductSidebar` (a mockup with dead buttons), `CreateProductHeader`, `AddToCartButton`, `CollectionPageLayout`.
- `src/components/account/AddressList.tsx` and `AddressFormDialog.tsx` are byte-identical duplicates of the versions in `account/addresses/`; only the nested ones are imported.
- `DrizzleProductRepository.search()` does a proper SQL `ILIKE` query — and is never called. `public.products.search` loads all products and filters in JS instead.
- Committed build artifacts: `build_output.log`, `build_output3.log`, `type_output.log`, `tmp/tsc_errors.txt`.

### Performance

`public.products.list`/`search` and `ListProductsUseCase`/`ListOrdersUseCase` all fetch everything then `.slice()`. `getMyOrders` pulls 1000 rows per page request **and** runs the expired-checkout sweep first. `public.categories.list` and `public.products.getFeatured` still call `findAll()` once per category inside a loop — the homepage no longer does, and `countProductsByCategory` exists for exactly this. `getRecentOrders` fetches each customer name in its own query.

### Smaller things

- `orders.currency`/`payments.currency` default to `'USD'`; rows written before the currency work say `USD` though they were charged in EGP. Nothing reads either column yet.
- Footer links to `/size-guide`, `/careers`, `/sustainability`, `/press`, `/blog` — none exist.
- `/collections/new` filters on `isFeatured`, and `/collections/accessories` applies no filter at all.
- The shipping page, FAQ and homepage trust badges carry hardcoded dollar copy (`$5.99`, "On orders over $200") — placeholder marketing numbers, not computed prices.
- `NEXT_PUBLIC_APP_NAME` is read by the email service but is in neither `.env` nor `.env.example` (falls back to "Valkyrie").

### Traps in the code that is now fixed

These are working. They are listed because each is easy to break again — the full version of each is in the `Resolved` section of `docs/ISSUES.md`.

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
- **Two suites.** `pnpm test` is unit-only and needs no database — `src/**/*.test.ts`, colocated with what they cover, and the only thing CI runs. `pnpm test:integration` runs `src/**/*.integration.test.ts` against a real database via `vitest.integration.config.ts`; it is excluded from the default `include` so it can never break CI, which has no `DATABASE_URL`.
- **Integration tests are read-only by rule.** They assert that the SQL the repositories emit agrees with the domain logic it replaced — `refundableOnly` against `OrderEntity.canRefund()`, `returnedOnly` against `getRefundedItems()`, the batched card lookups against the per-product ones. That comparison is the whole point, so keep them read-only and safe to point at real data. They log a summary of what they found, so a failure is diagnosable from the output alone.
- Component tests still do not exist; there is no DOM testing library installed. Where client logic is worth testing, extract it into a plain module and test that instead — `src/lib/variant-stock-registry.ts` is the pattern: the ref-counting lives outside React, and `VariantStockProvider` is a thin wrapper over it.

## Docs in-repo

`docs/ISSUES.md` is current and verified — the defect catalogue described above.

Everything else in `docs/` and all of `clothing-brand-project/` is planning/roadmap markdown written before implementation. Those describe intent, not current state — verify against code before trusting them.
