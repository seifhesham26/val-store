# P3 + Pass 2 + Performance remediation — design

**Date** 2026-09-02
**Branch** `feat/p3-pass2-remediation`
**Revision** 2 — see §0
**Scope** Every remaining open item in `docs/ISSUES.md`, the outstanding items in `docs/PERFORMANCE.md`, and eight findings from the 2026-09-02 audit that neither document records.

This is the last planned remediation pass. After it, `ISSUES.md` should contain only a `Resolved` section and whatever the next audit finds.

---

## 0. Revision 2 — what a design review changed

Revision 1 was reviewed against the code rather than re-read. Three of its claims were wrong and the phase order was poor. Recorded here rather than quietly corrected, because two of them are the kind of mistake that would have shipped.

| #   | Revision 1 said                                            | Actually                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Gate revenue on `payments.payment_status = 'completed'`    | `markAsPaid` is the **only** writer of that value and all three of its callers are Stripe paths; `updateStatus` never touches `payments`. **A COD order's payment row stays `pending` forever**, so this would have reported near-zero revenue for the payment method an Egypt-targeted store most likely depends on — worse than the unfiltered version it replaces. |
| 2   | The palette flip is a one-line change plus a bounded sweep | It also **activates 58 dormant `dark:` variants** that have never applied, four of them on storefront surfaces. Revision 1 did not mention them.                                                                                                                                                                                                                      |
| 3   | Phase order: palette first, so nothing is styled twice     | That gates the highest-value fix in the project (product image uploads are dead for every admin) behind its riskiest and least-testable change. Reordered — see §3.                                                                                                                                                                                                   |

Smaller corrections: `EXISTS` not `JOIN` (§4); guest-cart **prices** re-resolved server-side, not only stock (§5); `:root` and `.dark` have equal specificity (§3, Phase 2); `db:migrate` must not be run (§6); `sharp` checked in Phase 1, not Phase 6.

One Revision 1 assumption was checked and **confirmed**: admin and storefront are reachable from each other by client-side `<Link>` in both directions (`AdminSidebar.tsx:118`, `Navbar.tsx:178`), so the theme re-assertion in Phase 2 is required, not defensive.

---

## 1. Why this is one project and not thirty-five tickets

The open items are not independent. Three dependencies force the order of work:

1. **Nothing that creates UI runs before the palette is fixed.** Phases 3 and 5 add seven pages and several new surfaces. Styling those against a palette that is about to change means restyling all of them.
2. **Revenue must be defined before the customer screens are touched.** `admin.customers.list` and `getById` both compute `totalSpent` from the same column the dashboard reads.
3. **Unused code is deleted last.** Building guest carts, billing addresses and five marketing pages will legitimately consume UI primitives that are unused today.

But **server-side correctness runs before all of it**, because it creates no UI, carries the highest value, and must not be trapped behind a change that needs human eyes to verify.

---

## 2. Decisions

### 2.1 Answered by the user

| #            | Decision                      | Chosen                                                                                        |
| ------------ | ----------------------------- | --------------------------------------------------------------------------------------------- |
| #39          | Storefront palette root cause | `class="dark"` on `<html>`; admin's `next-themes` provider overrides it                       |
| P2-2/3/10    | What counts as revenue        | Net of refunds; Stripe via completed payment, **COD at `delivered`**, plus a write-path fix   |
| #29          | CMS depth                     | Delete the four orphan section types; build the version-history UI                            |
| #26/32/35/37 | Build vs cut                  | **Build all four**: guest carts, billing addresses, five footer pages, strong password policy |
| #32          | `/blog`                       | Coming-soon page using the user-supplied wordmark                                             |
| —            | Component tests               | **Add `@testing-library/react`**; amend CLAUDE.md accordingly                                 |

### 2.2 Decided in design

- **"Without side effects"** means: work on a branch; never write to the user's database; never call Stripe, Resend or Upstash; keep the verification gates green at every phase boundary. Anything needing a database write is written and handed over, not run. Note `next build` **reads** the database via `generateStaticParams` — a read, and the reason the build gate runs at four boundaries rather than six.
- **One commit per phase.** A thirty-five-item branch is unreviewable as a single diff; six labelled commits are not.
- **#16** is implemented now. Only end-to-end _testing_ depended on a verified Resend domain — the code fix does not.
- **P2-12 / shipping.** `CreateOrderUseCase` hardcodes `shippingCost = 0`, so shipping _is_ free. The copy is corrected to match. Real shipping rates are a feature, and out of scope.
- **#34 worker role.** No Postgres enum migration — that is a write to the user's database. The enum value stays; the dead `isWorker()` and type alias go.
- **NEW-6** (six domain interfaces importing Drizzle row types) is **out of scope**; recorded in `ISSUES.md` as accepted debt with its reason.
- **`Money`** is deleted with `Email`, `ProductSKU` and `AddressValueObject`. Stated rather than hidden: the float arithmetic in `create-order.use-case.ts:50,81` stays, bounded by `validateTotal()` and two-decimal storage.
- **PERF-07** becomes deployment-aware rather than a decision anyone must remember.

---

## 3. Phases

### Phase 1 — Server-side correctness and security

Creates no UI, so it is not blocked by the palette. Highest value in the project.

| Item          | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NEW-1**     | `src/lib/uploadthing.ts:52,81` reads `session.session.role` — a field that does not exist, since the `session` table has no `role` column and none is declared in `additionalFields`. The comparison is therefore always true and **product and category image uploads throw "Admin access required" for everyone, including super_admins**. Replace with `getUserRole(user.id)`. Collapse the duplicate session readers; drop the four `console.log`s. |
| **P2-0**      | `markAsRead` and `delete` take an owner id in both notification repositories (`admin_notifications` has `adminUserId`, so the admin half is a real hole), added to an `and(...)`. All four procedures pass `ctx.user.id`. Non-matching rows no-op silently, leaking nothing about whether the id exists.                                                                                                                                                |
| **P2-1**      | `clearCart()` before all three sign-out redirects **and** on `isAuthenticated` going false in `CartProvider`. Both. Deletes `localStorage.removeItem("user")`, which clears a key nothing writes.                                                                                                                                                                                                                                                       |
| **NEW-8**     | `containsPattern` reached `product.repository.ts` but not `customer.repository.ts:112-113` or `admin/customers.ts:52`. A search for `%` matches every row and degenerates to a full scan. Route all three through it with `ESCAPE '\'`.                                                                                                                                                                                                                 |
| **P2-11**     | `MIN(image_url)` becomes `DISTINCT ON (product_id) … ORDER BY product_id, is_primary DESC, display_order ASC`.                                                                                                                                                                                                                                                                                                                                          |
| **NEW-2**     | `admin.customers.getById` paginates orders (default 20) instead of loading every order, item and product.                                                                                                                                                                                                                                                                                                                                               |
| **NEW-3/4**   | `apiRateLimiter` — defined with zero consumers — wired into `newsletter.subscribe` by IP, reusing the `auth.ts:31` pattern. Explicit `rateLimit` block on `betterAuth()`.                                                                                                                                                                                                                                                                               |
| **#16**       | `SendOrderConfirmationUseCase` loads the order by `metadata.orderId` and sends the real `orderNumber`, real lines and resolved `shippingAddress` — all already on the entity. Called from the webhook **and** the COD path. Swallows its own errors: an email failure must never fail a paid order. (Its success-page copy change is UI and lands in Phase 3.)                                                                                          |
| **#43**       | `admin.variants.update` accepts optional `{ stockQuantity, reason }` and writes metadata plus `AdjustStockUseCase` in one transaction. #15 holds: every stock movement still leaves an audit row.                                                                                                                                                                                                                                                       |
| **#36 / #31** | Four lint warnings, including the `NewsletterSection` catch that discards the real error. Untrack the four build artifacts; extend `.gitignore`.                                                                                                                                                                                                                                                                                                        |
| **`sharp`**   | Verify it is actually built. It is among pnpm's ignored build scripts, and if it is not built Next's image optimisation is degraded — which partly undoes PERF-47. Checked here, not at the end.                                                                                                                                                                                                                                                        |

### Phase 2 — Palette (#39, P2-6, P2-7)

`src/app/layout.tsx` renders `<html lang="en" className="dark">`. `globals.css` keeps its complete `.dark` block (line 96) and `@custom-variant dark (&:is(.dark *))` (line 4) — the storefront has simply never had the class. Admin's `next-themes` provider writes the resolved theme onto the same element, so both trees get correct tokens, and Radix portals — which attach under `<body>`, inside `<html>` — inherit correctly in both for the first time. That is the whole of P2-7's problem class.

**The 58 dormant variants.** `dark:` appears 58 times, 32 outside `ui/`. None apply today. All storefront ones activate the moment the class lands. The admin files are unaffected (admin resolves to `light`), but four storefront surfaces change appearance:

```
AboutContent.tsx   ReturnsContent.tsx   ShippingPolicy.tsx   CheckoutOrderSummary.tsx
```

`CheckoutOrderSummary` is the known case — ISSUES.md #39 records that its coupon chip "used `dark:` variants that never apply", and it was then patched _around_. After the flip both the patch and the variant apply. **Every one of the 58 is audited before the class is added, not after.** This is the step Revision 1 missed.

**The navigation wrinkle, confirmed.** `next-themes` writes to `documentElement` and only runs where mounted. `AdminSidebar.tsx:118` (`<Link href="/">`) and `Navbar.tsx:178` (`href="/admin"`) are both client-side, so navigating admin→storefront leaves `class="light"` behind and the storefront renders light until a hard reload. A small client component in `(main)/layout.tsx` and `(auth)/layout.tsx` re-asserts `dark` on mount. SSR still emits `class="dark"`, so first paint is always right; the residual cost is one frame on that transition, and it goes in the test plan rather than being papered over.

**Specificity note, added to `globals.css`.** `:root` and `.dark` are both `(0,1,0)`. `.dark` wins only because it appears later in the file. Reordering the file would silently return the storefront to the light palette, so the constraint is written down where someone editing it will see it.

**Bounded sweep.** Only the workarounds #39 and P2-6 name as compensating for the broken palette are removed — the five outline/default buttons in the cart and checkout funnel. Hardcoded brand colours (`bg-zinc-900`, `text-gray-400`, `bg-white/[0.06]`) are left alone.

**P2-7 is live, not latent.** ISSUES.md says all three offenders are unused. `sheet.tsx` is imported by `CartDrawer.tsx`, so `SheetContent`'s unpaired `bg-background` renders in the storefront cart drawer today. It is **patched**, not deleted. `menubar.tsx` genuinely has no importer and is deleted. `drawer.tsx` no longer exists.

**Verification is by eye.** No test can see this.

### Phase 3 — UI correctness, on the fixed palette

- **#42** — `getOrderById` widened with `orderNumber`, `refundedAmount`, `refundedItems`, `fullyRefunded`, `awaitingPayment`, `paymentDeadline`, the same fields `getMyOrders` already returns. Four components updated; `shippingAddress` is fetched today and never rendered, so it gets rendered.
- **P2-5** — root `not-found.tsx` and `global-error.tsx`, storefront-styled. `ErrorBoundary.tsx` deleted; the route files cover it.
- **P2-8** — `(main)/page.tsx:12` and `account/layout.tsx:47`. The second is a nested `<main>` that ISSUES.md does not record.
- **#16 (UI half)** — `checkout/success/page.tsx:83` stops promising an email unconditionally.

### Phase 4 — Revenue (P2-2, P2-3, P2-4, P2-10)

**The definition, corrected for COD:**

```
recognised revenue =
    SUM(o.total_amount)
    WHERE EXISTS (SELECT 1 FROM payments p
                  WHERE p.order_id = o.id AND p.payment_status = 'completed')
       OR (o.payment_method = 'cash_on_delivery' AND o.status = 'delivered')
  - SUM(oi.unit_price * oi.refunded_quantity)
    * CASE WHEN o.discount_amount <= 0 OR o.subtotal <= 0 THEN 1
           ELSE GREATEST(0, (o.subtotal - o.discount_amount) / o.subtotal) END
```

**`EXISTS`, not `JOIN`.** The entity mapper explicitly anticipates an order carrying more than one payment row (`order.repository.ts:990-995`, "the most recently updated row is the authoritative one"). A plain join would fan out and double-count in `getSalesTrend`'s per-day `SUM`.

**Why COD recognises at `delivered`.** COD cash arrives when the courier hands the goods over. It cannot key off the `paid` status because the transition table is `pending → processing → paid → shipped → delivered` — `paid` comes _before_ `shipped`, which is backwards for cash on delivery, so any admin using it for COD is recording money before the goods have left.

**The write-path fix.** `updateStatus` transitioning a COD order to `delivered` also completes its payment row, inside the same transaction, and only when that row is still `pending` so it stays idempotent. This makes the schema tell the truth going forward; new COD orders then satisfy the first clause on their own. The second clause remains for existing rows, which cannot be backfilled without a database write.

The `CASE` is `OrderEntity.paidFraction()` (`order.entity.ts:295-298`) transcribed to SQL, so a coupon order refunds what the customer actually paid.

**Where it lives.** One exported fragment in `src/infrastructure/database/queries/revenue.ts`, consumed by `dashboard.getMetrics`, `getSalesTrend`, `getAnalytics` (twice), `customers.list` and `customers.getById`. `getTotalRevenue()` and its interface declaration are deleted (P2-3) rather than left as a seventh answer.

**It gets an integration test.** The suite exists to assert that emitted SQL agrees with the domain logic it replaced — `refundableOnly` against `canRefund()`. Same shape here: compare the SQL figure against `OrderEntity.refundedAmount()` computed in JavaScript over the same orders. Read-only, and the only thing that catches the SQL and the entity drifting apart — including whether `roundMoney` and `ROUND(x::numeric, 2)` agree at the half-cent.

**P2-4** — both fabricated sub-labels deleted; the order count bounded to the same 30 days as revenue; both cards state their window. **P2-10** — the search predicate moves into a shared `where` used by both the rows and the count.

### Phase 5 — The four features

**Testing setup first.** `@testing-library/react` and `@testing-library/user-event` added (`jsdom` is already a devDependency); `vitest.config.ts` given a jsdom environment for component specs; CLAUDE.md's Conventions section amended, since it currently states component tests do not exist.

**Guest carts (#35).** `useCart().addItem` writes to the store for anonymous visitors instead of showing a sign-in toast. `CartProvider` merges local items into the server cart when `isAuthenticated` becomes true; duplicate `productId + variantId` lines sum, capped at stock. One new procedure, `cart.mergeGuestItems`.

> **The server re-resolves prices, not only stock.** The store persists `productPrice` to localStorage, so a cart can sit for days holding a stale price. Quantities _and_ prices come from the database at merge time; the client's copies are display state only. Revision 1 specified stock alone, which would have let a guest carry an old price into a real order.

Merge and conflict resolution live in a plain module and are unit tested, per the `variant-stock-registry.ts` pattern; the surfaces get component tests. Composes with P2-1: guest adds → signs in → merge → signs out → clear.

**Billing addresses (#37).** `public.address.create` stops hardcoding `addressType: "shipping"`. Checkout gains a "billing same as shipping" checkbox with a selector when unchecked. `CreateOrderUseCase` takes `billingAddressId` separately rather than receiving the shipping id twice (`create-order.use-case.ts:96-97`). Edits the `account/addresses/` pair; the byte-identical flat duplicates die in Phase 6.

**Five footer pages (#32).** `/size-guide`, `/careers`, `/sustainability`, `/press` as static pages, and `/blog` as coming-soon. None reads the database, so all five prerender. A reusable `ComingSoon` component wraps `public/brand/coming-soon.png` (2040×528, supplied by the user for reuse across the site later) and takes an optional heading and body. **The copy on the four real pages is structural placeholder the user is expected to rewrite**, and is flagged as such in the test plan rather than presented as finished marketing.

**Strong passwords (#26).** `PasswordValueObject` — uppercase, lowercase, digit, special character, with a strength score — adopted in `SignupForm` and `reset-password`, replacing the length-only check that is the sole enforcement today. Server-side enforcement is an open question: if Better Auth exposes no password-validation hook, the policy is enforced client-side, **that limitation is stated plainly, and no claim is made that the server checks it**.

### Phase 6 — Cleanup, performance, docs

**CMS** — the four orphan types removed from `contentSchemaMap`, `sectionTypeSchema`, the config enum and the seed; `PromoBanner`, `BrandStory` and `NewsletterSection` keep their hardcoded props, which becomes honest. A version-history panel with Revert added to `HomepageSettings`, turning `getContentHistory` and `revertToVersion` into a working feature.

**#28** — delete `public.config` entirely, plus `public.categories.{list,getFeatured}`, `public.products.{getBySlug,getFeatured}`, `admin.products.getBySlug`, `admin.notifications.clearAll`.

**#30** — the seven unread site settings consumed through `getCachedSiteSettings()` with fallbacks.

> **Verified explicitly.** Turning the root layout's static `metadata` into `generateMetadata` could drop the 92 prerendered pages to dynamic. `unstable_cache` should prevent it. **If the build disagrees, this one item is reverted and reported** — a settable title is not worth the static build.

**#33** — `/collections/new` sorts by `createdAt` desc; `men`, `women` and `accessories` become redirects into `[slug]` so a real category stops being shadowed; `[slug]/page.tsx:21` uses `getCachedCategoryBySlug` instead of pulling every product in the category to read its name.

**#27 / P2-13** — delete `ProductSidebar`, `CreateProductHeader`, `AddToCartButton`, `CollectionPageLayout` and the byte-identical flat `account/AddressList.tsx` / `AddressFormDialog.tsx`. Re-run the orphan scan **after** Phase 5, then delete the primitives still unused plus `@radix-ui/react-toast`.

**#38** — drop `STRIPE_PUBLISHABLE_KEY` from `.env.example`; converge zod imports on plain `"zod"` (24 files against 8); remove `update()` from `OrderRepositoryInterface`, whose only implementation throws "not implemented".

**Performance**

| Item    | Change                                                                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PERF-07 | `DATABASE_POOL_MAX ?? (process.env.VERCEL ? 1 : 5)` — the measured answer per deployment shape, selected automatically                                           |
| PERF-16 | Grid polling (`GRID_REFRESH_MS`, `STOCK_STALE_MS`) 15s → 60s; the cart (`STOCK_CHECK_MS`) stays 15s, because that is where stale stock becomes a failed checkout |

**Prepared, not run.** `drizzle/0001_glossy_scourge.sql` (verified idempotent); a new `drizzle/0002_search_trgm.sql` enabling `pg_trgm` with `gin_trgm_ops` indexes — premature at 36 products, and said so; a currency backfill for #41 plus the schema default change; a `Content-Security-Policy-Report-Only` header, which cannot break the site while revealing what a real policy would block. The deprecated `X-XSS-Protection` header is removed.

> **Do not run `db:migrate`.** `_journal.json` lists 0000 and 0001, but the database was built with `db:push`, so `__drizzle_migrations` is likely empty and `migrate` would try to replay the baseline against tables that already exist. Use `db:push`, and **read the diff it proposes before confirming** — it will also pick up the `currency` default change.

**PERF-06 (Neon autosuspend)** is not code and remains the largest real-world contributor to perceived slowness. Dashboard steps go in the test plan.

---

## 4. Verification gates

| Gate                           | Baseline                             | Runs at                    |
| ------------------------------ | ------------------------------------ | -------------------------- |
| `tsc --noEmit`                 | clean                                | every phase                |
| `eslint`                       | 0 errors (warnings 4 → 0 in Phase 1) | every phase                |
| `vitest run`                   | 162 passing, rising                  | every phase                |
| `next build` static page count | **92**, → ~97 with the footer pages  | phases **2, 3, 5, 6** only |

The build gate is new to this project because `PERFORMANCE.md`'s headline result is the static page count and several Phase 6 changes can silently convert a prerendered route to a dynamic one. It runs at four boundaries rather than six because it reads the database through `generateStaticParams`, waking the Neon instance each time.

`pnpm` is not on `PATH` here; `node_modules/.bin/pnpm` is a local shim forwarding to `corepack pnpm@10`. The durable fix is a `packageManager` field in `package.json` plus `corepack enable`.

---

## 5. Deliverables

1. The code changes above, six commits on `feat/p3-pass2-remediation`.
2. **`docs/P3-TEST-PLAN.md`** in the `P0`/`P1` convention: per item, what to do, what you should see, what a regression looks like — with an explicit section for what cannot be automated (the palette sweep, the upload fix, the confirmation email).
3. `ISSUES.md` and `PERFORMANCE.md` updated: items moved to `Resolved`, deferrals recorded with reasons, and **six stale entries corrected**:

   | Entry                        | Says                                           | Actually                                                  |
   | ---------------------------- | ---------------------------------------------- | --------------------------------------------------------- |
   | #36                          | 5 lint warnings                                | 4                                                         |
   | P2-5                         | no error/loading/not-found boundaries anywhere | 8 exist; only root `not-found` and `global-error` missing |
   | P2-7                         | `drawer.tsx` is one of three offenders         | it no longer exists                                       |
   | P2-7                         | all three unused, so this is latent            | `sheet.tsx` is imported by `CartDrawer.tsx` — it is live  |
   | P2-13                        | 60 ui files, 29 unused, 8 dead deps            | 51 files, 21 unused, 1 dead dep                           |
   | P2 "Still open in this area" | collection pages remain fully client-side      | server-rendered since PERF-01                             |

4. SQL and commands for everything needing a database write, unrun.

---

## 6. Unknowns still open

1. Whether Better Auth exposes a server-side password validation hook (Phase 5).
2. Whether root `generateMetadata` costs the static build (Phase 6, with a stated revert).
3. Whether `getOrderNumberById` can be deleted once #42 widens `getOrderById`, or must survive for the Stripe-session lookup (Phase 3).
4. Whether `sharp` is actually built (Phase 1).

Resolved since Revision 1: admin↔storefront client-side navigation exists in both directions; `roundMoney` versus SQL `ROUND` is answered by the Phase 4 integration test rather than by inspection.

---

## 7. Explicitly out of scope

- **Real shipping rates and tax.** `shippingCost` and `tax` stay 0.
- **NEW-6**, the six domain interfaces importing Drizzle row types.
- **`Money` adoption**, and therefore the float arithmetic in order totals.
- **An order-fulfilment view for the `worker` role.**
- **Backfilling historical COD orders' payment rows** — it needs a database write. The second clause of the revenue definition covers them instead.
- **Any write to the user's database, or any call to Stripe, Resend or Upstash.**
