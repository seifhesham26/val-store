# Audit Log

## Status: IN PROGRESS — round 3 complete (blind sub-agents). NOT converged.

## Findings: 26 total, catalogued in docs/AUDIT_FINDINGS.md

## Round: 2

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
