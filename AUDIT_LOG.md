# Audit Log

## Status: IN PROGRESS — round 4 complete (post-fix verification). NOT converged.

## Findings: 26 fixed (docs/AUDIT_FINDINGS.md) + 13 new in round 4, of which the 1 high and 5 med are now fixed and 7 low are open by decision — see the two round 4 sections at the bottom of this file

## Round: 4

> Round 4 is the first pass to read `src/components/` and `src/app/`. It found
> 1 high, 4 med and 8 low, including one bug that writes the wrong stock
> number to the wrong variant, and three of the 26 fixes that are incomplete
> or that traded one defect for another. Security is the only category
> `[CLEAN]`. Convergence needs all five clean twice running, so the earliest
> possible is round 6.

> **Method note.** The protocol's five parallel Opus sub-agents exhausted the
> session rate limit on 2026-09-03 before any of them wrote output. Re-run inline
> instead: one context, sequential, checking all five category checklists per file.
> Category isolation exists to stop five agents colliding; a single reader does not
> need it.
>
> **Coverage so far is partial and deliberately targeted** at the highest-signal
> surface: `src/server/routers/` (tRPC tiers, IDOR, input validation), the checkout
> and coupon paths, the order repository's create transaction, and the Stripe
> webhook. Not yet covered: `src/components/` (213 files), `src/app/` (69),
> most of `src/domain/` and `src/application/`, and the Performance and Type Safety
> checklists beyond what surfaced incidentally.

## Logic & Correctness

- [FOUND] src/application/coupons/use-cases/validate-coupon.use-case.ts:82 — coupon usage limits are checked outside the order transaction with no row lock, so concurrent checkouts can redeem a coupon past `usageLimit` and past `perUserLimit` — **med**
  The check reads `coupon.usageCount + countPendingOrders(...)` via a plain
  `db.select` in `ValidateCouponUseCase`, then `CreateOrderUseCase` creates the
  order in a separate later transaction
  (`create-order.use-case.ts:117` validates, `:163` commits). Two requests issued
  simultaneously both read the pre-write count, both pass, and both commit.
  Concretely: a one-use 50%-off code, five parallel `public.checkout.createCodOrder`
  calls — all five read `usageCount = 0`, `pending = 0`, all five create orders and
  all five increment. The same shape defeats a one-per-customer code from a single
  account.
  `countPendingOrders` narrows the window but cannot close it: it counts orders
  that exist, and the exposure is precisely the interval before either order exists.
  The unique index `idx_coupon_usages_unique` does not bound this — it is on
  `(couponId, userId, orderId)`, so a distinct `orderId` per attempt satisfies it.
  It provides webhook-redelivery idempotency, not a redemption limit.
  **Contrast with stock, which got this right** in the same transaction:
  `order.repository.ts:315-326` locks each variant `FOR UPDATE`, in sorted variant-id
  order to avoid deadlock, explicitly so "two customers cannot both pass the stock
  check and oversell the last unit". The coupon row is never locked the same way.

## Logic & Correctness (round 2)

- [FOUND] src/infrastructure/database/repositories/inventory/inventory.repository.ts:126 — `getAllLogs` paginates with `limit`/`offset` but orders by `createdAt` alone, so rows sharing a timestamp duplicate and skip across pages — **low**
  This is the documented pagination trap, still live in one place. `ORDER BY
created_at DESC` is not a total order and Postgres gives no stable tie order, so
  `offset 100` can repeat a row already shown on page 1 and drop another entirely.
  The ties are not hypothetical here — they are guaranteed. `order.repository.ts`
  writes one `inventory_logs` row per order item inside the create transaction, all
  using the same `now` (:349-358), so any multi-item order produces a block of rows
  with byte-identical `created_at`.
  Reached from `admin.inventory.getAllLogs` (`admin/inventory.ts:54`) — the admin
  stock audit trail, which is the one table where a silently skipped row matters.
  Every other paginated query already appends the key: `order.repository.ts:212`
  and `:951` use `[desc(orders.createdAt), desc(orders.id)]`, and
  `user-lookup.repository.ts:28` uses `[asc(user.createdAt), asc(user.id)]`.
  `getLogsByVariant` (:56) and `getLogsByProduct` (:91) share the missing
  tiebreaker but take no `offset`, so they only make "the latest 50" pick an
  arbitrary member of a tied set — not a paging defect.

## Security

- [CLEAN] Round 1 — no new Security issues found in the surface covered.
  Checked and found correctly scoped: every `public.*` procedure that reads or
  writes user-scoped data derives the id from `ctx.user.id` and never from input
  (`orders.ts:104` explicit ownership check, `:148` and `:186` scope the query
  itself; `address.ts` passes `ctx.user.id` into use cases that re-verify ownership
  at `address.use-cases.ts:201/232/261`; `wishlist.ts`, `notifications.ts` and the
  notification repository's `markAsRead`/`delete` are `and(id, userId)` scoped).
  `CreateOrderUseCase.assertAddressesOwnedBy` (:62) checks both client-supplied
  address ids before any read or write, and returns one message for missing and
  not-yours.
  **Admin write-tier gating has not drifted.** Scanned every router under
  `src/server/routers/admin/`: the only mutations on the permissive `adminProcedure`
  tier are the three documented `notifications` exceptions
  (`admin/notifications.ts:43,53,61`), all scoped to `ctx.user.id`.
  Stripe webhook verifies the signature before parsing (`route.ts:29`), acts only on
  `metadata.orderId` with `payment_status === "paid"`, and `markAsPaid` is guarded so
  redelivery neither double-notifies nor resurrects a cancelled order.
  Checkout never trusts a client-supplied discount — the code is re-validated and the
  amount re-derived server-side (`create-order.use-case.ts:110-131`).

## Side Effects & State

- [FOUND] src/application/address/use-cases/address.use-cases.ts:183 — `CreateAddressUseCase.execute` mutates its caller's input object — **low**
  `address.isDefault = true` writes through to the object the router constructed.
  Harmless today because every caller builds a fresh literal, but it is a use case
  mutating an argument rather than deriving a value, and the repo's stated
  convention is that entities return new instances rather than mutating in place.
  Fails the moment a caller passes a shared or reused object.

- [FOUND] src/components/providers/cart-provider.tsx:266 — the debounced quantity update has no `catch`, so a failed sync is an unhandled rejection and the local cart silently diverges from the server — **med**
  The timer body is `try { await updateMutation.mutateAsync(...) } finally { setSyncing(false) }`
  with no `catch`, and `updateMutation` (:186) declares only `onSuccess` — no
  `onError`. Any rejection escapes the async callback as an unhandled promise
  rejection.
  It also loses the write silently: `store.updateQuantity` (:248) already applied
  the new quantity optimistically, and nothing rolls it back. A customer on a flaky
  connection sees quantity 3, the server still holds 1, and they are never told —
  the divergence only surfaces at checkout, priced from the server.
  Contrast `addItem`/`removeItem`, which await inline so the caller can handle the
  throw; only the debounced path swallows its context.

- [FOUND] src/components/providers/cart-provider.tsx:279 — `removeItem` does not clear that item's pending quantity timer, so a remove within the 1s debounce fires an update against a deleted row — **med**
  `updateQuantity` stores a timer per cart item in `updateTimersRef` and clears only
  the previous timer _for the same item_ (:262). `removeItem` never touches the map.
  Sequence: bump quantity (schedules a 1s timer), click remove inside that second.
  The remove commits, then the timer fires `updateQuantity` for a `cartItemId` that
  no longer exists; `UpdateCartItemUseCase` rejects, and per the finding above that
  rejection is unhandled.
  `clearCart` has the same gap — it drops every row while per-item timers stay armed.

## Performance

- [FOUND] src/application/checkout/use-cases/create-order.use-case.ts:66 — address ownership check awaits inside a `for` loop, costing two sequential round trips where one would do — **low**
  `for (const addressId of [...new Set(addressIds)]) { await findById(...) }`
  serialises the shipping and billing lookups. Against Neon at ~58ms warm that is
  ~58ms added to every checkout, on the critical path before anything else runs.
  `Promise.all` over the deduped ids pipelines them into roughly one round trip —
  the same fix `order.repository.ts:241` already applies to the two address
  snapshots. Only ever 2 ids, so the ceiling is one round trip; low severity, but
  it is on the checkout path and the fix is three lines.

- [FOUND] src/components/products/QuickAddSliderBar.tsx:114 — `setTimeout(() => setJustAdded(false), 2000)` is never cleared on unmount — **low**
  A component unmounted inside the 2s window still runs the state setter. Harmless
  under React 19 (the unmounted-setState warning was removed and the update is
  dropped), so this is a tidiness finding, not a leak of consequence. Listed because
  it is the only uncleaned timer in the tree — every other one
  (`AnnouncementBarClient:69`, `VerticalWheel:39`, `variant-stock-provider:81`,
  `use-debounce:10`, `use-payment-window:43`, `use-infinite-scroll:90/129`,
  `use-mobile:15`, `SearchDialog:203`) clears or disconnects correctly.

## Type Safety

- [FOUND] src/infrastructure/database/repositories/dashboard/dashboard.repository.ts:53 — five `COUNT(*)` aggregates are typed `sql<number>` with no `::int` cast, so they arrive as strings while declaring `number` — **low**
  Also :61, :69, :93 and :157. Postgres `COUNT(*)` is `bigint` and postgres.js hands
  bigint back as a string to avoid precision loss, so `ordersResult.count` is `"42"`.
  It reaches callers typed as `number`: `getDashboardStats` returns
  `orders/lowStock/pendingReviews` (:75-78) and `getSalesTrend` returns `orders`
  (:104), all unwrapped.
  Nothing breaks today — `MetricsCards` interpolates into a template string and
  `avgOrderValue` divides, and both coerce. It is latent: the first consumer to use
  `+` concatenates (`"12" + "5"` → `"125"`) and the first to call `.toFixed()` throws
  a TypeError. Low severity because no current consumer does either.
  **The codebase already knows this trap and defends it everywhere else** — six
  queries use `count(*)::int` (order, product, category, product-image repositories,
  and dashboard's own :196 and :205), and `cart.repository.ts:265`,
  `:309` and `product-variant.repository.ts:239` wrap the result in `Number(...)`.
  These five are the ones that were missed.
  **`CLAUDE.md` is wrong about this.** It asserts under "Traps in the code that is
  now fixed": "Every count uses `count(*)::int`." That is not true, and the doc
  reads as a guarantee. Worth correcting whether or not the code is changed.

  Otherwise clean, and unusually so: **zero** `any`, `as any`, `@ts-ignore`,
  `@ts-expect-error`, `z.any()` or `z.unknown()` anywhere in `src/`. The non-null
  assertions that exist (`order.repository.ts:313/563/703`, `coupons.ts:42-45`,
  `collections/page.tsx:79-82`) are each guarded by a preceding filter or validity
  check on the same value.

## Round 2 sweep — patterns checked across files not read individually

- [CLEAN] XSS — **zero** occurrences of `dangerouslySetInnerHTML` or `innerHTML`
  anywhere in `src/`.
- [CLEAN] N+1 — no `await` inside a `for`/`while` loop or `.map(async …)` in
  `src/infrastructure`, `src/application` or `src/server`, with the two exceptions
  already logged (`assertAddressesOwnedBy`, bounded at 2; and the deliberate
  sequential locking in the order/refund transactions, which must be sequential).
  `check-cart-stock.use-case.ts:136` batches via `findByProducts`.
- [CLEAN] Timers/listeners — every one clears or disconnects except the single
  `QuickAddSliderBar` case logged above.
- [CLEAN] Type escapes — zero `any`, `as any`, `@ts-ignore`, `@ts-expect-error`,
  `z.any()`, `z.unknown()`.
- [CLEAN] Rate limiting and input bounds on unauthenticated write surfaces
  (`newsletter.subscribe`, `reviews.create`) — both throttled, both bounded.
- [CLEAN] Refund money math (`order.entity.ts:295-320`) — `paidFraction`,
  `refundedAmount`, `isFullyRefunded` are derived from lines, guard divide-by-zero,
  and round at the boundary.

## Convergence status

**Not converged.** Round 2 produced a new Logic finding, so by the protocol's Step 3
the counter has not started: convergence needs every category `[CLEAN]` for two
consecutive rounds.

Coverage remains partial. Read in full: the tRPC tier definitions, every
`public.*` router, every `admin/*` router's procedure tiers, checkout and coupon
use cases, the order repository's create/refund/filter paths, the cart provider,
the dashboard and inventory repositories, the Stripe webhook. Swept by pattern but
not read line by line: `src/components/` (213 files), `src/app/` (69), and most of
`src/domain/` and `src/application/`. A genuine round 3 should read those.

## Round 3 — blind sub-agent pass

Five agents, one per category, on Sonnet, explicitly forbidden from reading
CLAUDE.md, docs/, AUDIT_LOG.md or any test file. Given only raw stack facts
(postgres.js returns bigint as string; the React Compiler auto-memoizes) so they
would not generate noise, and told nothing about prior findings or decisions.

**Result: the blind pass outperformed the primed pass.** It produced 18 new
findings including three high-severity ones the primed rounds missed entirely, all
three concerning stock integrity. Every finding recorded was re-verified against the
source by the orchestrator before being accepted; one was downgraded (#23) and one
was rejected as unsafe to act on (the checkout locking loop).

Not converged: round 3 found more than rounds 1 and 2 combined.

---

# Round 4 — post-fix verification (2026-09-03)

## Status: NOT CONVERGED. 13 new findings, 1 high.

Run after all 26 round-1..3 findings were fixed on `fix/audit-findings`.
Two halves: (a) a regression review of the 26-fix diff by the orchestrator,
who had read `docs/AUDIT_FINDINGS.md`; (b) five blind Sonnet sub-agents, one
per category, forbidden from reading `CLAUDE.md`, `docs/`, `AUDIT_LOG.md` or
any test file, and pointed at the surface rounds 1-3 never read
(`src/components/`, `src/app/`, `src/domain/`).

**Every agent finding was re-verified against source by the orchestrator
before being recorded. Three were rejected or downgraded — see the bottom.**

## Gate (no regressions from the 26 fixes)

- `rm -rf .next && pnpm type-check` — clean
- `pnpm lint` — 0 problems
- `pnpm test` — **393/393** passing, 31 files
- `pnpm test:integration` — **38/41**, the 3 failures being exactly the
  documented `products.search` / `headers()` harness limitation. Unchanged.

## Logic & Correctness

- [FOUND] src/components/admin/inventory/AdjustStockDialog.tsx:44,77-81 — the dialog is a single reused instance and its `newQuantity` state is only reset on a _successful_ submit, so opening a second variant after cancelling the first writes the first variant's number to the second — **high**
  Found independently by both the Logic and the State agent. Verified: the
  parent (`src/app/admin/inventory/page.tsx:87-92`) renders one
  `<AdjustStockDialog>` with no `key`, only swapping the `variant` prop, so
  React keeps the instance and its state. The populate guard is
  `if (variant && newQuantity === "") setNewQuantity(String(variant.stockQuantity))`,
  and `newQuantity` returns to `""` only in the mutation's `onSuccess`.
  Escape, the X button and an overlay click all just call
  `onOpenChange(false)`.
  **It is worse than either agent reported: no typing is required.** Open
  variant A (stock 10) — the field auto-populates "10". Press Escape. Open
  variant B (stock 3) — the guard does not fire because `newQuantity` is
  "10", so the field shows 10 while "Current Stock" correctly reads 3.
  Submit and B is set to 10.
  `reason` has the same lifecycle; `changeType` is never reset at all.
  This lands on the one path rounds 1-3 hardened at the repository layer:
  `AdjustStockUseCase` is an absolute "set stock to N", so the write is
  applied verbatim and `adjustStockWithLog` records a truthful-looking
  audit row (previous 3 -> new 10) for a number nobody chose. The repository
  is now atomic and correctly logged; the wrong number is supplied above it.
  `CategoryFormDialog` solves exactly this with `key={category?.id ?? "new"}`.

- [FOUND] src/components/admin/dashboard/SalesChart.tsx:45-63 — the 7d/30d/90d selector is partly a no-op and the trend percentage compares mismatched date ranges — **med**
  `getSalesTrend()` (`dashboard.repository.ts:99`) takes no parameter and
  hardcodes a 30-day window. `SalesChart` renders a 7/30/90 selector and
  filters client-side with `chartData.slice(-days)`, so "90d" slices 90 from
  an array that never holds more than 30 entries — byte-identical to "30d",
  with no indication that 60 days are missing.
  Compounding it: the query is `GROUP BY DATE(created_at)`, which emits no
  row for a day with no orders, so the array is calendar-gapped.
  `calculateTrend()` then compares `slice(-7)` against `slice(-14,-7)` **by
  array index**, not by date — with gaps, those two slices span different
  numbers of real days, so the "+/-X% from last period" figure can compare,
  say, 10 calendar days of sales against 4.

## Security

- [CLEAN] Round 4 — no new Security issues found.
  The blind agent re-derived, without access to prior notes: every admin
  mutation is on `adminWriteProcedure` except the three documented
  `notifications` exceptions, which the repository scopes by
  `adminUserId`; no IDOR on any user-scoped procedure; every raw `sql` uses
  Drizzle's parameter interpolation, never concatenation; the Stripe webhook
  verifies before parsing and its handlers are idempotent; UploadThing routes
  resolve the admin role server-side; `safeRedirect`/`safeHref` close open
  redirect; sign-in collapses to one message and pays a dummy
  `verifyPassword`; the only writer of `userProfiles.role` is the signup hook
  with a hardcoded `"customer"`.

## Side Effects & State

- [FOUND] src/components/account/profile/ProfileForm.tsx:13 — `useState(user?.name || "")` seeds from a prop that is `undefined` on first render, so the Name field never populates — **med**
  `ProfilePage` renders `<ProfileForm user={user} />` unconditionally while
  `trpc.public.profile.me.useQuery()` is still loading, and never remounts it.
  A `useState` initializer runs once, so `name` is pinned to `""` after the
  query resolves. The customer sees an empty Name field beside a correctly
  populated Email (read straight from the prop), and the Save button —
  `disabled={... || name === user?.name}` — is _enabled_ with no edit made.
  **The State agent's claimed impact is wrong and is corrected here:** it
  reported that clicking Save "silently wipes their stored display name".
  It does not. `public.profile.updateName` validates
  `z.string().min(2).max(60)` (`profile.ts:13`), so an empty submit is
  rejected server-side and surfaces as a "Failed to update profile" toast.
  No data loss — a broken form and a misleading error, hence med not high.

## Performance

- [FOUND] src/application/checkout/use-cases/create-order.use-case.ts:204-221 — checkout's HTTP response blocks on admin notification fan-out, ~4+ sequential round trips after the order has already committed — **med**
  `orderPlaced()` is awaited (`fanOutToAdmins` = `findAdminUserIds` +
  `createMany`, then `userNotifications.create` — 3 round trips), then
  `stockSold()` is awaited (`getVariantsStock`, then a `for` loop calling
  `await emitLowStock(...)` per variant that crossed the threshold, each
  costing 2 more round trips inside `fanOutToAdmins`,
  `notification.service.ts:215-221`). At ~58ms warm on Neon that is ~230ms
  minimum, plus ~116ms per crossing variant, added to the customer's
  "order placed" wait for bookkeeping only an admin will ever read.
  **This is the same argument fix #26 made about the confirmation email
  eleven lines above** — which was changed to fire-and-forget for exactly
  this reason while these two awaits were left alone. See the regression
  section: #26 removed the smaller cost and kept the larger one.

- [FOUND] src/infrastructure/database/repositories/cart/cart.repository.ts:150,300 — `addItem` reads the same variant row twice in two round trips — **low**
  The ownership check selects `{productId, isAvailable}` for `variantId`
  (:150); `assertWithinStock`, called unconditionally at :183, re-selects
  `stockQuantity` for the same row (:300). Adding `stockQuantity` to the
  first select removes one ~58ms round trip from every add-to-cart of a
  variant product, which is most of the catalogue.

- [FOUND] src/components/home/NewArrivals.tsx and src/components/collections/CollectionSection.tsx — client-fetched rows with no `initialData`, inconsistent with every server-rendered sibling — **low**
  Both are `"use client"` with a `trpc.public.products.list.useQuery` on
  mount, and neither is seeded (verified: no `initialData` anywhere in
  either file or in `collections/page.tsx`). The homepage's other sections
  (`ServerHeroSection`, `ServerFeaturedCategories`, `ServerFeaturedProducts`)
  and `/collections/[slug]` are server components reading through
  `src/lib/cache.ts`. So `/collections` shows four empty skeleton grids, and
  the homepage one empty row, until hydration completes.

- [FOUND] Assorted sequential-await and unbounded-query sites — **low**
  `admin/customers.ts:70-76` (page query + count awaited in series) and
  `:100-139` (three independent queries in series); `coupon.repository.ts:27`
  `findAll()` with no LIMIT, the one table given no ceiling when reviews and
  inventory got one; `ImageUploadSection.tsx:101-112` and
  `CartStockDialog.tsx:91-99` both `await` per item in a loop where
  `Promise.all` applies; five `next/image` `fill` usages without `sizes`
  (`AppearanceSettings.tsx:110,141`, `SearchDialog.tsx:116`,
  `UserDialog.tsx:72,95`), which makes the optimizer serve full-viewport
  candidates for 40-80px thumbnails.

- [DOWNGRADED] src/app/(main)/layout.tsx:28 — the agent rated the nav-category
  await a medium waterfall in front of all 69 storefront routes. It is real
  but **low**: `getCachedNavCategories` is an `unstable_cache` read, so the
  round trip is paid only on a miss or after a category write revalidates
  the tag, not per request.

## Type Safety

- [FOUND] src/server/routers/admin/orders.ts:16 — `status: z.string().optional()` is looser than the `order_status` enum column it reaches through a raw `sql` comparison — **low**
  `listOrdersSchema.status` is an unbounded string; `OrderFilters.status` is
  `string` (interface :39, commented "Changed to string for compatibility");
  `order.repository.ts:1165` emits a raw `sql` equality between
  `orders.status` and the filter value.
  A value outside the enum reaches Postgres as a comparison against a native
  enum type and raises `invalid input value for enum order_status`, i.e. a
  500 on the admin orders table rather than a validation error or an empty
  result.
  **Latent, and verified as latent:** `OrdersTable.tsx:68` sends
  `filters.status === "all" ? undefined : filters.status`, so the sentinel
  never reaches the server, and the dropdown is built from `ORDER_STATUSES`.
  Reaching it needs an authenticated admin crafting the call by hand — hence
  low, not the agent's high. Recorded because
  `updateOrderStatusSchema.status` twenty lines below already does the right
  thing with `z.enum(ORDER_STATUSES)`, so the fix is one token.

- [FOUND] src/server/routers/admin/settings/content-sections.ts:43,72,94,105,132 — the admin CMS read path still does a bare `JSON.parse` with no schema validation, five times — **med**
  Fix #22 introduced `parseSectionContent` (`src/lib/cms-content-parser.ts`)
  to validate CMS content on read against the same Zod schemas the write
  path enforces. **It was wired into one of the two read paths.** Verified:
  the only importer is `src/lib/cache.ts` (the storefront). Every admin read
  — `getContentSection`, `updateContentSection`, `toggleSectionStatus`,
  `getContentHistory`, `revertToVersion` — still parses and returns
  unvalidated.
  Concrete failure: `HomepageSettings.tsx:129-136` does
  `stored.map((m: {text: string; link?: string}) => ...)` on
  `announcementSection?.content?.messages`, where the element type is an
  unchecked annotation. A row whose `messages` is absent, not an array, or
  differently shaped — most plausibly via `revertToVersion`, which surfaces
  historical rows verbatim — throws `TypeError: stored.map is not a function`
  inside a `useEffect`, breaking the admin Homepage Settings page.

## Regressions and gaps introduced by the 26 fixes

Found by the orchestrator reviewing the diff; the blind agents could not see
these, since they were denied `docs/AUDIT_FINDINGS.md`.

- [FOUND] src/application/checkout/use-cases/create-order.use-case.ts:195 — fix #26 replaced `await sendOrderConfirmation` with bare `void`, which on a serverless host can be killed before it runs, dropping the COD confirmation email entirely — **med**
  The fix's stated precedent is
  `void container.getCancelExpiredCheckoutsUseCase().execute()`. **That
  precedent does not transfer.** The sweep is best-effort and re-runs on
  every subsequent request, so a dropped invocation costs nothing. The
  confirmation email is a one-shot, per-order side effect with no retry
  anywhere — losing it means that customer never receives it, which is the
  exact gap fix #26's own comment says was being closed ("COD used to
  receive no confirmation at all").
  Once the response is returned, a serverless instance may be frozen or
  terminated with the promise still pending. `after()` from `next/server`
  exists precisely for this and **is available in this Next version**
  (verified: `node_modules/next/server.d.ts:21`). Calling it from the
  application layer would breach the onion rule, so it belongs in the
  router, or behind an injected scheduler.
  Not an unhandled-rejection risk: `SendOrderConfirmationUseCase.execute`
  wraps its whole body in try/catch.
  Note this sits directly above the two awaited notification calls in the
  Performance section — so #26 removed the one deferrable cost that was
  safe to await and kept ~230ms of cost that was not.

- [FOUND] src/application/orders/use-cases/cancel-expired-checkouts.use-case.ts:80 — the third `markAsPaid` caller drops the new `couponLimitExceeded` flag — **low**
  Fix #1 added the flag so a coupon honoured past its cap is greppable next
  to the payment, and wired it into two of three callers (the Stripe webhook
  and `public.checkout`). The expired-checkout sweep calls
  `await this.orderRepository.markAsPaid(orderId)` and ignores the result,
  so an overrun recovered through that path produces no log line. The admin
  note is still written inside the repository transaction, so the record
  itself is not lost — only the log half of the reconciliation.

- [FOUND] src/server/utils/rate-limiter.ts:115 — fix #9 (`getClientIp` trusts a client-supplied header) was resolved with a comment, not a control — **low**
  No code changed. The justification is that Vercel overwrites
  `X-Forwarded-For` at its edge. That may well be right, but **the repo pins
  no deployment target**: there is no `vercel.json`, no `Dockerfile`, no
  `output: "standalone"`, and no dependency naming a platform (verified).
  So the one assumption holding up four IP-keyed limiters — including the
  only throttle on the unauthenticated `products.search` ILIKE scan and on
  `newsletter.subscribe` — is recorded nowhere enforceable and nothing fails
  if it stops being true.

- [FOUND] inventory.repository.ts:166 and review.repository.ts — fix #25 replaced unbounded admin queries with silent caps and no paging UI — **low**
  `getAllVariantsWithStock` defaults to 500 and `admin/inventory.ts:20`
  calls it with no argument; `review.findAll` defaults to 200. Neither
  screen paginates or reports a total, so past the cap rows simply stop
  appearing with nothing to indicate truncation — on the inventory screen
  that means stock an admin cannot see or edit. Unreachable at ~36 products;
  recorded because the failure mode is invisible rather than loud, and the
  fix is a "showing first N of M" signal or real pagination.

- [FOUND] src/application/cart/use-cases/update-cart-item.use-case.ts:47 — fix #23 makes an out-of-stock cart line impossible to decrement — **low**
  Dropping `&& maxStock > 0` was correct for the ceiling. The side effect is
  that with `maxStock === 0`, _any_ positive quantity throws, so a customer
  holding 3 of a now-sold-out item cannot reduce it to 1 — every `-` click
  returns "This item is out of stock". They must remove the line. Defensible,
  but it is a behaviour change the finding did not mention.

## Rejected

- **ProductDetail carries selections across products** (State agent, med-high).
  Claimed that navigating `/products/a` -> `/products/b` preserves
  `selectedSize`/`quantity`/`selectedImage` because there is no
  `key={product.id}`. **False.** Next keys each dynamic segment by its param
  value: `createRouterCacheKey(['slug','red-hoodie','d'])` returns
  `slug|red-hoodie|d`
  (`next/dist/client/components/router-reducer/create-router-cache-key.js:15-17`),
  and that value is passed as the React `key` in `layout-router.js:674`. The
  subtree remounts and the state re-initialises from the new product's props.
- **ProfileForm silently wipes the stored name** — server rejects it,
  `z.string().min(2)`. Downgraded to med; see above.
- **Checkout stock loop should be parallelised** — re-rejected, as in round 3.
  The sequential `SELECT ... FOR UPDATE` in sorted variant-id order is the
  correctness mechanism.

## Convergence

**Not converged.** Round 4 produced findings in four of five categories;
only Security logged `[CLEAN]`, its first. The protocol needs all five clean
for two consecutive rounds, so the earliest possible convergence is round 6.

Round 4 is the first pass to read `src/components/` and `src/app/`, and both
of the round's most serious findings (the stock dialog, the profile form) are
there — in client state, which no prior round had examined. The prior rounds'
coverage note was accurate about its own blind spot.

---

# Round 4 — fixes applied (high + med, 6 of 13)

Applied on `fix/audit-findings`, uncommitted. The 7 low-severity findings
above are **left open** by the user's decision, not by oversight.

## Gate after the fixes

- `rm -rf .next && pnpm type-check` — clean
- `pnpm lint` — 0 problems
- `pnpm test` — **403/403** (393 before, +10 for the new pure module)
- `pnpm build` — succeeds, full route table, `/products/*` still SSG-prerendered
- `pnpm test:integration` — **38/41**, the same 3 documented `headers()`
  harness failures. Unchanged.

## 1. AdjustStockDialog wrote one variant's number to another — high

`src/components/admin/inventory/AdjustStockDialog.tsx`

The seeding guard was `if (variant && newQuantity === "")`, and `newQuantity`
was emptied only in the mutation's `onSuccess` — so any close that was not a
successful submit left the previous variant's value in state.

Replaced with a `seededFor` id that tracks which variant the fields currently
hold values for, computed as `open && variant ? variant.variantId : null`.
Closing sets it to `null`, so the next open always re-seeds — including
reopening the _same_ variant after a cancel, which an id-only comparison
would have missed. `changeType` and `reason` are re-seeded with it;
`changeType` previously was never reset at all.

The two `setNewQuantity("")` / `setReason("")` lines in `onSuccess` were
removed rather than left as belt-and-braces: they were what made the reset
look handled while a cancelled close reset nothing.

## 2. ProfileForm never populated the Name field — med

`src/components/account/profile/ProfileForm.tsx`

`useState(user?.name || "")` seeded from a prop that is `undefined` on first
render, and the parent never remounts the form. Added the same `seededFor`
shape, keyed on `user.id`.

Keyed on the id rather than syncing on every prop change deliberately: a
refetch — including this form's own post-save invalidation — must not
overwrite a name the customer is part-way through typing.

## 3. SalesChart's 90d button was a no-op — med

`dashboard.repository.ts`, `sales-series.ts` (new), the repository interface,
`get-sales-trend.use-case.ts`, `admin/dashboard.ts`, `SalesChart.tsx`

Three separate changes, because it was three problems:

1. **The window is now a parameter.** `getSalesTrend(days = 30)` replaces a
   hardcoded 30 days, the router takes `days` (bounded `1..365` — the value
   drives a per-day loop, so leaving it open would let an admin query build an
   arbitrarily long series), and the chart passes it, which also makes the
   query refetch when the selector moves.
2. **The series is dense.** `GROUP BY DATE(...)` emits nothing for a day with
   no orders, and the chart compares periods by slicing the array _by index_,
   so gaps made `slice(-7)` vs `slice(-14,-7)` cover different numbers of real
   days. Zero-filling every day is what makes index arithmetic equal calendar
   arithmetic.
3. **The date key is honestly typed.** `DATE(...)` was selected as
   `sql<string>`, but postgres.js decodes a Postgres `date` into a JS `Date` —
   the assertion was false. It is `TO_CHAR(DATE(...), 'YYYY-MM-DD')` now, which
   is really a string and is also the key the zero-filling joins on.

The gap-filling and date-key logic were extracted to
`src/domain/dashboard/sales-series.ts` as pure functions, following the repo's
"extract it and test that instead" convention for logic that cannot be reached
through a component or a database. **10 unit tests** cover the window
boundaries, month crossing, local-vs-UTC day keys, zero-filling, out-of-window
rows, and the index-slice property the chart depends on.

**Verified against the live database**, since none of that SQL had ever run:
`days` of 7 / 30 / 90 return exactly 7 / 30 / 90 entries (the 90d bug, gone),
3 non-zero days out of 90 confirms the zero-filling, dates come back strictly
ascending, and `revenue`/`orders` arrive as `number`, not strings.

## 4 + 5. Deferred work now survives the response — med

`task-scheduler.interface.ts` (new), `next-task-scheduler.service.ts` (new),
`create-order.use-case.ts`, `checkout.container.ts`, `container.ts`

These were one problem wearing two hats.

Fix #26 had moved the confirmation email off the checkout critical path with a
bare `void`. On a serverless host the instance can be frozen the moment the
response is flushed, leaving that promise permanently unresumed — so the fix
risked losing the email entirely, which is the exact gap #26 existed to close.
Its cited precedent (`void cancelExpiredCheckouts()`) does not transfer: that
sweep is best-effort and re-runs on the next request, whereas a confirmation
email is one-shot with no retry anywhere.

Meanwhile the two calls immediately below it — `notifications.orderPlaced()`
and `notifications.stockSold()` — were still awaited, and they are the
expensive ones: three round trips for the first, one plus two per
threshold-crossing variant for the second. Roughly 230ms of admin bookkeeping
on the customer's checkout response.

Both now go through a `TaskSchedulerInterface` port, implemented over Next's
`after()`, which hands the work to the platform so the invocation is kept
alive for it. The interface lives in the application layer and the `next/server`
import stays in infrastructure, so the use case defers work without knowing
that "the response" is a Next concept. The implementation absorbs failures
(nothing is left to throw to) and falls back to detached execution when there
is no request scope, so scripts and tests still work.

## 6. Admin CMS reads were still unvalidated — med

`admin/settings/content-sections.ts`, `HomepageSettings.tsx`

Fix #22 built `parseSectionContent` to validate CMS content on read, then
wired it into only the storefront path (`src/lib/cache.ts`). All five admin
reads still did a bare `JSON.parse`. All five now validate against the same
Zod schemas the write path uses.

They degrade to `null` rather than throwing, but for the opposite reason the
storefront does: the storefront falls back to defaults so a customer still
sees a page; the admin editor must still _load_ for the one person who can
repair a bad row, which `null` allows by leaving the form on its defaults.

**This immediately exposed a second defect the `any` had been hiding.** With
the reads typed, `HomepageSettings` no longer compiled: it was reading `.title`
and `.messages` off a value that is genuinely a union of the two section
shapes. Both effects now narrow with the `in` operator, and the inline
`(m: { text: string; link?: string })` annotation — an assertion, not a check,
and the thing that let `stored.map is not a function` reach production — is
gone, with the element type coming from the schema instead.
