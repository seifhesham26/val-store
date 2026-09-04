# Audit Findings — 2026-09-03

Findings from an `AUDIT_PROTOCOL.md` pass over the codebase. Two rounds, read
inline rather than by sub-agent (see `AUDIT_LOG.md` for method and coverage).

**Status: all 26 are now fixed** on branch `fix/audit-findings`, uncommitted for
review. Gate at the time of writing: `type-check` clean, `lint` 0 problems,
**393** unit tests passing (330 baseline + 63 added by the fixes). The findings are
kept here as written — the failure scenario under each is the evidence for the
severity, and is what a reviewer should argue with rather than the label.

Fixes were made by five sub-agents partitioned by disjoint file ownership, then
verified diff-by-diff. Two defects escaped the agents' own checks and were caught by
the full gate afterwards: narrowing `gender` to a `z.enum` broke two callers still
typed `string` (fixed with a type-only `Gender` derived from the `pgEnum`, so a
client component does not pull Drizzle into its bundle), and the `usePaymentWindow`
fix set state synchronously in an effect body, which `react-hooks/set-state-in-effect`
rejects.

Coverage was partial and targeted. Read in full: the tRPC tier definitions, every
`public.*` router, every `admin/*` router's procedure tiers, checkout and coupon use
cases, the order repository's create/refund/filter paths, the cart provider, the
dashboard and inventory repositories, the Stripe webhook. Swept by pattern only:
`src/components/` (213 files), `src/app/` (69), most of `src/domain/` and
`src/application/`.

---

## 1. Coupon usage limits are racy — med

**`src/application/coupons/use-cases/validate-coupon.use-case.ts:82`**

`ValidateCouponUseCase` checks `coupon.usageCount + countPendingOrders(...)` against
`usageLimit` with a plain `db.select` and no row lock. `CreateOrderUseCase` then
commits the order in a **separate, later** transaction — it validates at
`create-order.use-case.ts:117` and commits at `:163`.

**Failure scenario.** A one-use 50%-off code. Fire five parallel
`public.checkout.createCodOrder` calls. All five read `usageCount = 0` and
`pending = 0`, all five pass validation, all five commit orders and increment.
The same shape defeats a `perUserLimit` of 1 from a single account.

`countPendingOrders` narrows the window but cannot close it: it counts orders that
_exist_, and the exposure is precisely the interval before either order exists.

**The unique index does not bound this.** `idx_coupon_usages_unique` is on
`(couponId, userId, orderId)` (`schema.ts:599`). A distinct `orderId` per attempt
satisfies it. It provides webhook-redelivery idempotency, not a redemption limit.

**Why this reads as an oversight rather than a tradeoff:** the identical race was
closed twice elsewhere in the same file.

- `order.repository.ts:315-326` locks each variant `FOR UPDATE`, in sorted
  variant-id order to avoid deadlock, with a comment stating it exists so "two
  customers cannot both pass the stock check and oversell the last unit."
- `order.repository.ts:715-732` uses a guarded conditional `UPDATE` on refunds so
  "two returns submitted at the same moment" are arbitrated by the database.

The coupon row is the one contended resource never locked or guarded.

**Fix direction.** Re-check the limit inside the order transaction with the coupon
row locked `FOR UPDATE`, or use a conditional `UPDATE ... WHERE usage_count <
usage_limit RETURNING` and treat zero rows as "limit reached" — the same shape the
refund path already uses.

### What was actually done, and the asymmetry it leaves

Both redemption sites now use the guarded conditional `UPDATE ... RETURNING`, taken
after the sorted variant-id locks so the lock ordering cannot deadlock. The two
paths then diverge, deliberately:

- **Cash on delivery** (`create`) — losing the guard throws and rolls the order
  back. Nothing has been charged, so refusing is free. The limit is **absolute**.
- **Card** (`markAsPaid`) — losing the guard cannot refuse. Payment is recognised
  after Stripe has taken the money; throwing would roll back the move to `paid` and
  strand a paying customer on a pending order, which is worse than one redemption
  over a limit.

**When the card path can actually overrun.** The pending order is created _before_
the Stripe redirect (`create-checkout-session.use-case.ts:49`), so
`countPendingOrders` already blocks the sequential attempt — open a second checkout
a minute later and validation refuses. What remains is a true concurrent race: two
checkouts must pass validation within the millisecond gap before either commits its
order, **and** both must then complete payment. Realistically that means a drop
(hundreds of simultaneous checkouts against a "first N" code) or deliberate abuse of
a one-per-customer code by firing parallel requests. Organically, outside a drop, it
is close to unreachable.

**Reconciliation, added after review.** A card overrun no longer disappears into a
log line:

1. The redemption is **counted anyway** with an unguarded increment. Declining to
   count a redemption that really happened would leave `usage_count` under-reporting,
   so the next validation would still see room and let the overrun grow. Counting it
   makes the limit self-correcting — at 101/100 the ordinary pre-check refuses
   everyone after.
2. The `coupon_usages` row is written on both paths, with `onConflictDoNothing` so a
   redelivered webhook cannot double-write it.
3. The order gets an **admin note** recording that the discount was honoured past the
   cap, rendered on the order detail page beside the refund notes.
4. `markAsPaid` returns `couponLimitExceeded`, and both callers log it as a distinct
   anomaly next to the payment.

An admin _notification_ was deliberately not used: `notification_type` has no value
for this, and adding one without applying the enum migration would throw at insert —
the same failure mode as finding #21.

---

## 2. Debounced cart sync fails silently and diverges — med

**`src/components/providers/cart-provider.tsx:266`**

The debounced quantity update is `try { await mutateAsync(...) } finally {
setSyncing(false) }` — **no `catch`** — and `updateMutation` (`:186`) declares only
`onSuccess`, no `onError`.

**Failure scenario.** Customer changes a quantity on a flaky connection. The
optimistic local write already happened (`store.updateQuantity`, `:248`) and nothing
rolls it back. The mutation rejects; the rejection escapes the async timer callback
as an unhandled promise rejection. The customer sees quantity 3, the server holds 1,
and no error is shown. The divergence surfaces at checkout, which prices from the
server.

`addItem` and `removeItem` await inline so their caller can handle a throw. Only the
debounced path has no one to catch it.

---

## 3. `removeItem` leaves a pending quantity timer armed — med

**`src/components/providers/cart-provider.tsx:279`**

`updateQuantity` stores a per-item timer in `updateTimersRef` and clears only the
previous timer _for the same item_ (`:262`). `removeItem` never touches the map.

**Failure scenario.** Bump a quantity (schedules a 1s timer), click remove inside
that second. The remove commits; a second later the timer fires `updateQuantity`
against a `cartItemId` that no longer exists. `UpdateCartItemUseCase` rejects — and
per finding #2 that rejection is unhandled.

`clearCart` has the same gap: it drops every row while per-item timers stay armed.

---

## 4. Six `COUNT(*)` aggregates are typed `number` but arrive as strings — low

**`src/infrastructure/database/repositories/dashboard/dashboard.repository.ts:53`**
(also `:61`, `:69`, `:93`, `:157`, and `:168` — **six, not the five this finding originally claimed.** The fix agent enumerated them and found one more inside `getAnalytics`'s revenue-trend query that both auditors missed.)

Postgres `COUNT(*)` is `bigint`; postgres.js returns bigint as a **string** to avoid
precision loss. These are annotated `sql<number>` with no `::int` cast, so
`ordersResult.count` is `"42"` while the type says `number`. It reaches callers
unwrapped: `getDashboardStats` returns `orders`/`lowStock`/`pendingReviews`
(`:75-78`), `getSalesTrend` returns `orders` (`:104`).

**Failure scenario.** Latent, not live. Current consumers interpolate into a
template string (`MetricsCards.tsx:53`) or divide (`avgOrderValue`, `:218`) — both
coerce. The first consumer to use `+` concatenates (`"12" + "5"` becomes `"125"`);
the first to call `.toFixed()` throws a TypeError. Low severity because no current
consumer does either.

**The codebase already defends this everywhere else** — six queries use
`count(*)::int` (including dashboard's own `:196` and `:205`), and
`cart.repository.ts:265`, `:309` and `product-variant.repository.ts:239` wrap the
result in `Number(...)`. These five were missed.

**`CLAUDE.md` is wrong about this.** Under "Traps in the code that is now fixed" it
states: _"Every count uses `count(_)::int`."\* That is not true. Worth correcting
whether or not the code changes — this repo has a documented history of the
catalogue drifting out of true.

---

## 5. `getAllLogs` paginates without a tiebreaker — low

**`src/infrastructure/database/repositories/inventory/inventory.repository.ts:126`**

Paginates with `limit`/`offset` but orders by `createdAt` alone. `ORDER BY
created_at DESC` is not a total order and Postgres gives no stable tie order, so
`offset 100` can repeat a row shown on page 1 and drop another entirely.

**The ties are guaranteed, not hypothetical.** `order.repository.ts:349-358` writes
one `inventory_logs` row per order item inside the create transaction, all using the
same `now`. Any multi-item order produces a block of byte-identical `created_at`.

Reached from `admin.inventory.getAllLogs` (`admin/inventory.ts:54`) — the admin stock
audit trail, which is the one table where a silently skipped row matters.

Every other paginated query appends the key (`order.repository.ts:212`, `:951`;
`user-lookup.repository.ts:28`). `getLogsByVariant` (`:56`) and `getLogsByProduct`
(`:91`) share the missing tiebreaker but take no `offset`, so they only make "the
latest 50" pick an arbitrary member of a tied set — not a paging defect.

---

## 6. Address ownership check serialises two round trips — low

**`src/application/checkout/use-cases/create-order.use-case.ts:66`**

`for (const addressId of [...new Set(addressIds)]) { await findById(...) }`
serialises the shipping and billing lookups. Against Neon at ~58ms warm that is
~58ms added to every checkout, on the critical path before anything else runs.

`Promise.all` over the deduped ids pipelines them into roughly one round trip — the
same fix `order.repository.ts:241` already applies to the two address snapshots.
Bounded at 2 ids, so the ceiling is one round trip; low severity, but it is on the
checkout path and the fix is three lines.

---

## 7. `CreateAddressUseCase` mutates its argument — low

**`src/application/address/use-cases/address.use-cases.ts:183`**

`address.isDefault = true` writes through to the object the router constructed.
Harmless today because every caller builds a fresh literal, but it is a use case
mutating an argument rather than deriving a value, against the repo's stated
convention that entities return new instances rather than mutating in place. Fails
the moment a caller passes a shared or reused object.

---

## 8. `QuickAddSliderBar` timer not cleared on unmount — low

**`src/components/products/QuickAddSliderBar.tsx:114`**

`setTimeout(() => setJustAdded(false), 2000)` with no cleanup. A component unmounted
inside the 2s window still runs the setter. Harmless under React 19 (the
unmounted-setState warning was removed and the update is dropped), so this is
tidiness, not a leak. Listed only because it is the sole uncleaned timer in the
tree — `AnnouncementBarClient:69`, `VerticalWheel:39`, `variant-stock-provider:81`,
`use-debounce:10`, `use-payment-window:43`, `use-infinite-scroll:90/129`,
`use-mobile:15` and `SearchDialog:203` all clear or disconnect correctly.

---

## 9. `getClientIp` trusts a client-supplied header — med

**`src/server/utils/rate-limiter.ts:117`**

Found by a blind sub-agent, verified independently.

`getClientIp` returns the leftmost value of `X-Forwarded-For` with no
trusted-proxy check. That entry is the one furthest from the server and the one an
attacker writes directly. Rotating the header per request gives every request a
fresh rate-limit bucket.

**What it protects, and therefore what it costs.** Four consumers, all IP-keyed:

- `public/products.ts:150` — `search`, unauthenticated, and an `ILIKE '%…%'`
  sequential scan. IP is its **only** throttle.
- `public/newsletter.ts:27` — unauthenticated insert. Its only throttle.
- `auth.ts:89` — `signin:ip:${ip}`, one of two limits on sign-in.
- `api/csp-report/route.ts:90`.

**Severity is deployment-dependent, and this is the honest caveat.** On a host that
_overwrites_ `X-Forwarded-For` (Vercel does), the leftmost value is the real client
and this is not exploitable. On a host that _appends_, or any path reaching the app
directly, it is. The repo pins no host, so this is a latent dependency on
deployment topology that nothing in the code states or enforces.

**Why it matters more than it looks:** `auth.ts:85` documents the IP limit as the
layer that "slows a single host walking the keyspace." Walking the keyspace is
enumeration — see finding #10, which this one uncaps.

---

## 10. Phone sign-in leaks registration status through timing — med

**`src/server/routers/auth.ts:127`**

Found by a blind sub-agent, verified independently.

`signIn` deliberately returns one message for every failure, and the code says so:
_"An unregistered phone number and a wrong password are indistinguishable from out
here — the whole point of routing the lookup through sign-in."_ The **response body**
is indistinguishable. The **timing** is not.

- Unregistered phone → `findAccountsByPhone` returns empty → `candidates.length === 0`
  → `throw unauthorized()` at `:137`. No password hashing happens.
- Registered phone → the loop calls `auth.api.signInEmail`, which runs a real
  password hash comparison — deliberately expensive — before failing.

One request per number, timed, separates the two. Any password works; the attacker
never needs to guess one.

**The per-identifier rate limit does not bound this.** `signin:id:${normalized}` is
keyed on the _normalized phone number_, so every distinct number an attacker probes
gets its own fresh budget. Enumerating 10,000 numbers means 10,000 identifiers with
one request each — comfortably inside a per-identifier limit. The layer that would
catch it is the per-IP one, which is finding #9.

**Combined effect:** #9 removes the IP ceiling, #10 supplies the oracle. Together
they enumerate which phone numbers hold accounts on an Egypt-targeted storefront.
Neither is critical alone; the pair is worth fixing together.

**Fix direction.** Make both paths do comparable work — hash a dummy password when
no candidate exists — so the response time does not depend on whether the number is
registered.

---

## 11. The cart debounce is per-hook-instance, not per cart line — med

**`src/components/providers/cart-provider.tsx:168`**

Found by a blind sub-agent, verified independently — and the mechanism is broader
than first reported.

`updateTimersRef` is a `useRef` declared **inside `useCart()`**, so every component
calling the hook gets its own timer map. The "clear the previous timer for this
item" logic at `:262` therefore only clears timers _this instance_ created. It is
not a debounce on the cart line; it is a debounce per line per mounted component.

**`CartDrawer` is mounted in `(main)/layout.tsx:46`** — on every storefront page.
So it is always co-mounted with whatever else calls `useCart()`:

- `/cart` → `CartPopulated` (`cart/page.tsx:26`) + `CartDrawer`
- any product page → `ProductDetail` / `QuickAddSliderBar` + `CartDrawer`

**Failure scenario.** On `/cart`, adjust a line's quantity in the page, then adjust
the same line in the drawer within one second. Two independent timers are armed;
neither clears the other. Both fire, both write, and the one that lands second wins
— which is not necessarily the customer's last action, since the two timers started
at different moments. The customer's final choice can be silently overwritten by an
earlier one.

**Fix direction.** Hoist the timer map out of `useCart()` to module scope or into
`CartProvider`'s context, so it is shared by every consumer — the same reasoning
that put the ref-counting in `variant-stock-registry.ts` outside React.

---

## 12. Server cart sync reverts a pending optimistic edit — med

**`src/components/providers/cart-provider.tsx:42`**

Found by a blind sub-agent, verified independently.

The sync effect calls `setItems(items)` — a wholesale replace of the local store —
whenever `serverCart` changes, with no regard for edits still in flight.

**Failure scenario.** Change a quantity (optimistic write lands locally, 1s timer
armed). Before it fires, any other cart mutation completes — adding an item from the
drawer, removing a different line — and its `onSuccess` calls `invalidateCart()`,
which refetches `cart.get`. The new `serverCart` still holds the _old_ quantity for
the edited line, and `setItems` overwrites the optimistic value with it. The
customer watches their edit revert, then flip back a moment later when the debounced
write finally lands.

State converges correctly in the end — the debounced call still carries the right
quantity in its closure — so this is a visible-correctness bug rather than data
loss. Compounds with #11 and #2, which share the same debounce window.

---

## 13. `usePaymentWindow` seeds from `Date.now()` in a `useState` initializer — low

**`src/hooks/use-payment-window.ts:39`**

Found by a blind sub-agent, verified independently.

`useState(() => Date.now())` runs once during server render and again at client
hydration, producing two different values and therefore two different countdown
labels for the same markup.

**Failure scenario.** Any page rendering a payment countdown hydrates with server
text like `4:58` against client text `4:56`, which React reports as a hydration
mismatch and patches. Four consumers, all client components that still server-render
under the App Router: `account/orders/[id]/page.tsx:38`,
`OrdersList.tsx:35`, `PaymentWindowNotice.tsx:25`, `UpdateStatusCard.tsx:39`.

Low because React recovers and the visible end state is correct. Worth noting that
the codebase already solves exactly this problem elsewhere — the navbar and cart
badges use `useSyncExternalStore` to force a stable SSR value rather than reading a
live one during render.

---

# High severity — found by blind agents, verified independently

## 14. Cancelling after a partial refund double-restocks the returned units — high

**`src/infrastructure/database/repositories/orders/order.repository.ts:570`**

On the closing path, `restockQuantity` falls back to `item.quantity` — the full
ordered quantity — with no subtraction of `item.refundedQuantity`.

**Failure scenario.** Order 5 units. Customer returns 2: the refund path restocks
those 2 and sets `refundedQuantity = 2`. A partial return deliberately leaves the
order in its existing status, so it remains cancellable. An admin then cancels the
order. Cancellation restocks `item.quantity` = 5. Total returned to inventory: 7
units for 5 sold. Stock is now overstated by 2, and the store will accept orders it
cannot fill.

**The asymmetry is the tell.** The reverse direction _is_ guarded:
`OrderEntity.stockAlreadyReturned()` blocks restocking on a refund against an
already-cancelled order, with a comment explaining that the same units must not be
added twice. Cancel-after-refund is the same hazard in the other direction, and
nothing checks it.

**Fix direction.** Restock `item.quantity - item.refundedQuantity`, floored at zero.

---

## 15. `AdjustStockUseCase` reads then absolutely overwrites, with no lock — high

**`src/application/inventory/use-cases/adjust-stock.use-case.ts:38`**, writing
through **`inventory.repository.ts:181`**

`getVariantStock` reads the current level, then `updateVariantStock` issues an
absolute `SET stockQuantity = <n>`. No transaction, no `FOR UPDATE`, nothing
between them.

**Failure scenario.** Variant holds 10. An admin opens the adjust dialog and submits 12. Between the read and the write, a customer's checkout commits — the order
transaction correctly locks the row, decrements to 7, and logs a sale. The admin's
absolute write then lands: stock is set to 12. The sale's decrement is erased. Three
units were shipped and inventory never recorded it, so the store will oversell them
again later.

The use case's own docblock claims "Ensures atomic updates." It does not.

**Second defect in the same use case:** `updateVariantStock` (`:62`) and `createLog`
(`:65`) are separate statements outside any transaction. A failure between them
leaves stock changed with no audit row — in the one subsystem whose stated purpose
is that every movement leaves an audit row.

---

## 16. `ProductVariantRepository.updateStock` has the same overwrite race — high

**`src/infrastructure/database/repositories/products/product-variant.repository.ts:171`**

A second, independent path doing an absolute `SET stockQuantity = quantity` with no
lock — reached from the product edit page rather than the inventory screen. Same
interleaving as #15, same result.

**What makes this one damning:** `adjustStock`, six lines below at `:190`, does it
correctly — `GREATEST(0, ${productVariants.stockQuantity} + ${delta})`, a single
atomic statement with no read-modify-write. The correct primitive exists in the same
file and this path does not call it.

---

# Medium and low — found by blind agents, verified independently

## 17. Admin `minTotal`/`maxTotal` order filter is silently dropped — med

**`src/application/orders/use-cases/list-orders.use-case.ts`**

The admin router accepts `minTotal`/`maxTotal`, the use case drops them before
building filters, and the repository interface's differently-named
`minAmount`/`maxAmount` is never implemented. Three layers, none connected.

**Failure scenario.** An admin filters orders to "total over 5000" and gets the
unfiltered list back with no error. Every row shown is presented as matching a
filter that was never applied — a silently wrong answer, which is worse than a
broken control.

## 18. Category cycle guard only catches direct self-parenting — med

**`src/application/categories/use-cases/update-category.use-case.ts:55`**

Rejects `parentId === id` but does not walk ancestors.

**Failure scenario.** With A → B → C, set A's parent to C. Each individual edit looks
valid; the result is a cycle. `categories.parentId` has no FK constraint, so nothing
in the database catches it either. Any subsequent tree walk — `collectCategoryTree`,
the nav builder — recurses until it exhausts the stack.

## 19. Changing `addressType` bypasses the last-shipping-address guard — med

**`src/application/address/use-cases/address.use-cases.ts`, `UpdateAddressUseCase`**

`DeleteAddressUseCase` refuses to remove a customer's only shipping address, because
checkout requires one. `UpdateAddressUseCase` will happily flip that same address's
`addressType` to `"billing"`, reaching the identical end state — a customer with no
shipping address — by a different route. They then cannot check out.

## 20. Signup hook races on the phone-keyed customer insert — med

**`src/lib/auth.ts`, `databaseHooks.user.create.after`**

Two concurrent signups with the same phone number both miss the existence check and
both insert, so the second violates the unique constraint and throws — after the
Better Auth `user` row has already committed. The account exists but signup reports
failure. `onConflictDoNothing` is the fix, the same tool `newsletter.subscribe`
already uses.

## 21. `products.list` accepts an unvalidated `gender`, reaching the enum column — med

**`src/infrastructure/database/repositories/products/product.repository.ts:343`**

An unauthenticated `publicProcedure` takes `gender: z.string().optional()`, casts it
to a 4-value union, and binds it against a Postgres enum column. `gender: "foo"`
produces an unhandled `invalid input value for enum` from the driver — a 500 with a
database error message where a 400 belongs. Fix is `z.enum([...])` at the router.

## 22. CMS content is `JSON.parse`d and cast on read, bypassing its own Zod schemas — low/med

**`src/lib/cache.ts`, `ServerHeroSection.tsx`, `ServerAnnouncementBar.tsx`**

`heroContentSchema` and `announcementContentSchema` exist and are enforced on write,
but the read path parses and force-casts. A row written by hand, a migration, or a
schema change surfaces as `undefined` fields rendered into the page. Degrades via
try/catch to the hardcoded defaults rather than crashing, which is why it has gone
unnoticed. The validator already exists — the read path just does not call it.

## 23. Cart stock ceiling is skipped when stock is exactly zero — low

**`src/application/cart/use-cases/update-cart-item.use-case.ts:47`**

`if (quantity > existingItem.maxStock && existingItem.maxStock > 0)` — the second
clause disables the check precisely when stock is 0, so an out-of-stock line accepts
any quantity.

**Downgraded from the agent's "medium" after checking the consequence:** this cannot
oversell. `order.repository.create` re-checks every line under `FOR UPDATE` and
rejects the checkout. The damage stops at a cart that displays a quantity the
customer can never buy.

## 24. `getMetrics` runs four independent queries sequentially — med (performance)

**`src/infrastructure/database/repositories/dashboard/dashboard.repository.ts:41`**

Four queries with no data dependency, each awaited in turn — about 4 round trips
(~230ms on Neon warm) where postgres.js pipelining would make it roughly one.
`getAnalytics`, in the same file, already does exactly this correctly with
`Promise.all`. Loads on every admin dashboard open.

## 25. Unbounded admin list queries — med (performance)

**`review.repository.ts:72`**, **`coupon.repository.ts:27`**,
**`inventory.repository.ts:157`**

`findAll`-style queries with no `LIMIT`, feeding client tables that render every row
with no pagination or virtualisation. Harmless at current data volume; the review
table is the one that grows without bound, and it is the one most likely to be
opened on a phone.

## 26. COD checkout blocks its HTTP response on the confirmation email — med (performance)

**`src/application/checkout/use-cases/create-order.use-case.ts:184`**

The order is already committed, but the response waits on a live Resend API call
before returning. The customer's "order placed" spinner includes a third-party mail
round trip on the critical path. The card path does not pay this — its email is sent
from the webhook.

---

## Note on one performance finding I did not accept

The performance agent's top finding — that the checkout stock loop
(`order.repository.ts:315`) costs ~3 sequential round trips per cart line — is
factually correct but **must not be "fixed" by parallelising it.** Those statements
are `SELECT … FOR UPDATE` taken in sorted variant-id order specifically to serialise
concurrent checkouts and prevent both overselling and deadlock. The sequencing is
the correctness mechanism. Any rework has to preserve the ordered locking; combining
the select and update into one statement is the only safe direction.

---

## Verified clean

Worth as much as the findings, and recorded so nobody re-derives it:

- **No IDOR on any user-scoped procedure.** Every `public.*` procedure that reads or
  writes user data derives identity from `ctx.user.id`, never from input. Checked:
  orders (`:104` explicit ownership check, `:148`/`:186` scope the query itself),
  address (use cases re-verify at `address.use-cases.ts:201/232/261`), wishlist,
  notifications (repository is `and(id, userId)` scoped).
  `CreateOrderUseCase.assertAddressesOwnedBy` checks both client-supplied address ids
  before any read or write.
- **Admin write-tier gating has not drifted.** Every router under
  `src/server/routers/admin/` scanned: the only mutations on the permissive
  `adminProcedure` tier are the three documented `notifications` exceptions, all
  scoped to `ctx.user.id`.
- **Stripe webhook** verifies the signature before parsing, acts only on
  `metadata.orderId` with `payment_status === "paid"`, and `markAsPaid` is guarded so
  redelivery neither double-notifies nor resurrects a cancelled order.
- **Checkout never trusts a client discount** — the code is re-validated and the
  amount re-derived server-side.
- **Stock cannot oversell** — `FOR UPDATE` with sorted lock ordering.
- **The raw-`sql` relational-rewrite trap is still correctly handled** in
  `buildFiltersConditions`.
- **Refund money math** is derived from lines, guards divide-by-zero, rounds at the
  boundary.
- **Zero** `any`, `as any`, `@ts-ignore`, `@ts-expect-error`, `z.any()`,
  `z.unknown()` in 51k LOC. Zero `dangerouslySetInnerHTML`/`innerHTML`.
- **No N+1** in `infrastructure`/`application`/`server` beyond finding #6.
