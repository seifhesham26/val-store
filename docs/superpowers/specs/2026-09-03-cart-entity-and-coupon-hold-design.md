# Cart as an entity, and coupons held on the cart

**Date:** 2026-09-03
**Status:** Design approved, not yet implemented

## Problem

A coupon can only be applied at checkout. It arrives as a `couponCode` string on
`createSession` / `createCodOrder`, is validated, and is redeemed as the order
commits. Nothing remembers it before that moment, so a customer cannot apply a code
and come back to it, and the code is re-typed on every attempt.

The reason it has nowhere to live is that **a cart is not a thing in this codebase**.
There is no `carts` table. A cart is `cart_items` rows filtered by `user_id` — an
implicit collection, not an entity. There is no row to hang a coupon off.

## Decisions

These were settled before design and are not open for reinterpretation during
implementation. Each was a real fork.

1. **A hold reserves nothing.** A coupon on a cart does not consume one of its
   limited redemptions and cannot make the code unavailable to another customer.
   Two customers may hold the last use of a code; the second is told at checkout.
   Rejected: real reservations, which create a denial-of-service surface (park
   limited codes to deny others) and would require changing limit accounting.
2. **The cart stores the coupon; checkout prices it.** The cart persists _which_
   coupon is applied and shows the code. It does **not** compute or display a
   discount amount. Money is calculated in exactly one place, at checkout, so the
   cart and the order cannot disagree on price.
3. **Signed-in customers only.** The coupon field prompts sign-in for guests.
   Every applied coupon therefore has a real user, so `perUserLimit` is checkable
   at apply time and the guest-cart merge path needs no coupon logic.
4. **Expiry re-validates; it does not evict.** At 15 minutes the coupon is
   silently re-checked. Still valid, it stays and the window renews. No longer
   valid, it is dropped with a stated reason. Nobody silently loses a legitimate
   discount.
5. **No visible countdown.** Following from 1 and 4, the 15 minutes is an internal
   freshness check that renews itself. A ticking clock would advertise a deadline
   that does not exist. The UI shows an applied-coupon badge with a remove button.
6. **The cart becomes a real entity** (`carts` table), rather than bolting a
   `cart_coupons` side-table onto the existing shape.

### Why the cart becomes an entity

A side-table keyed on `user_id` was the smaller change and was recommended. It was
rejected in favour of fixing the modelling gap, on the grounds that the gap is the
actual cause — the feature had nowhere to go because the cart does not exist as a
row — and that a second cart-level attribute would force the change anyway.

The objection to doing it was migration risk on live cart data, including two raw
`cart_items.user_id` deletes on the **payment path**. That objection is void here:
**the store is not live and existing cart rows are seed data**, so there is no
backfill, no dual-write, and no cutover window.

## Schema

```
carts
  id                  uuid      PK  default random
  user_id             text      UNIQUE NOT NULL → user.id    ON DELETE CASCADE
  coupon_id           uuid      NULL           → coupons.id  ON DELETE SET NULL
  coupon_applied_at   timestamp NULL
  coupon_checked_at   timestamp NULL
  created_at          timestamp NOT NULL default now()
  updated_at          timestamp NOT NULL default now()

cart_items
  cart_id             uuid      NOT NULL → carts.id ON DELETE CASCADE
  -- replaces user_id; every other column unchanged
```

`user_id UNIQUE` preserves exactly the current "one cart per user" semantics, so no
behaviour changes. Removing that constraint later is what enables saved carts — the
reason for choosing this approach — and costs nothing now.

`coupon_id` is `ON DELETE SET NULL`, deliberately not cascade: an admin deleting a
coupon must not delete customers' carts.

The three coupon columns are nullable and move together. Either all three are set or
all three are null; no other combination is valid.

Indexes: keep the existing `idx_cart_product_id` on `cart_items`; the old
`idx_cart_user_id` moves to `carts.user_id` (satisfied by the unique constraint).
Add an index on `cart_items.cart_id`.

## Repository

**`CartRepositoryInterface` keeps every existing `userId`-keyed signature.**
`findByUserId(userId)`, `clearCart(userId)`, `getCartTotal(userId)`,
`getCartItemCount(userId)`, `isProductInCart(userId, productId)` are unchanged. The
implementation resolves `userId → cart_id` internally.

This is what keeps the change affordable: the use cases, routers and the cart
provider do not change at all.

Two private helpers in `DrizzleCartRepository`:

- `findCartByUserId(userId): Promise<Cart | null>` — used by **reads**. A user with
  no cart row reads as an empty cart. Reads never create rows.
- `getOrCreateCart(userId): Promise<Cart>` — used by **writes**. Inserts with
  `onConflictDoNothing` on `user_id` and re-reads, so two concurrent first-adds
  cannot both insert.

New interface methods for the coupon:

- `getAppliedCoupon(userId): Promise<{ couponId, appliedAt, checkedAt } | null>`
- `setAppliedCoupon(userId, couponId): Promise<void>` — sets all three columns
- `clearAppliedCoupon(userId): Promise<void>` — nulls all three
- `touchCouponCheckedAt(userId): Promise<void>` — bumps `coupon_checked_at` only

`clearCart(userId)` deletes the items and clears the applied coupon, but leaves the
`carts` row in place.

### Call sites that genuinely move

- `src/infrastructure/database/repositories/cart/cart.repository.ts` — internals.
- `src/app/api/webhook/stripe/route.ts:127` and
  `src/server/routers/public/checkout.ts:139` — both currently run
  `db.delete(cartItems).where(eq(cartItems.userId, …))`, reaching past the
  repository into the table from the payment path. Both become
  `cartRepository.clearCart(userId)`. This is a correctness improvement
  independent of the feature.
- `src/db/relations.ts:161` — the `cartItems → user` relation becomes
  `cartItems → carts` plus `carts → user`.
- `MergeGuestCartItemsUseCase` — no signature change; its `addItem` calls go
  through the repository, which now creates the cart on demand.

Anything else still referencing `cart_items.user_id` fails at `pnpm type-check`,
loudly, rather than at runtime. That is the main reason this is safe.

## Applying and removing

Two new `protectedProcedure`s on the existing cart router:

**`public.cart.applyCoupon({ code })`**

1. Read the cart items; if empty, reject ("Add something to your cart first").
2. Compute the subtotal exactly as `CreateOrderUseCase` does —
   `sum(productPrice * quantity)`.
3. Run the existing `ValidateCouponUseCase(code, subtotal, userId)`. It already
   checks active, date window, usage limits, per-user limits and minimum purchase,
   and already returns customer-facing messages. Reuse them verbatim.
4. On success, `setAppliedCoupon`. On failure, return the reason and change nothing.

Applying a second code replaces the first. One coupon per cart; stacking is out of
scope.

**`public.cart.removeCoupon()`** — `clearAppliedCoupon`. Always succeeds.

**`public.cart.get`** gains:

```ts
appliedCoupon: { code: string } | null
couponRemoved: { code: string; reason: string } | null
```

`appliedCoupon` carries the **code only**. No discount amount, per decision 2 — a
figure the cart did not compute is exactly the drift being avoided.

## Re-validation

A pure module, `src/lib/cart-coupon-freshness.ts`, following the
`cart-sync-registry.ts` precedent so the decision is unit-testable outside React and
outside the database:

```ts
export const COUPON_RECHECK_MS = 15 * 60 * 1000;
export function needsRecheck(checkedAt: Date | null, now: number): boolean;
```

On every `cart.get`, when an applied coupon exists and `needsRecheck` is true:

- re-run `ValidateCouponUseCase` against the **current** subtotal
- valid → `touchCouponCheckedAt`, return `appliedCoupon`
- invalid → `clearAppliedCoupon`, return `appliedCoupon: null` and
  `couponRemoved: { code, reason }` for the UI to toast

Not stale, or no coupon applied: no validation runs and no extra query is issued.

There is no cron, queue or worker. Nothing needs re-checking unless somebody is
looking at the cart, and if nobody is looking, nothing is wrong yet.

Two concurrent stale reads may both re-validate. That is harmless — both reach the
same verdict, and both writes are idempotent.

## Checkout

`createSession` and `createCodOrder` **drop `couponCode` from their Zod input** and
read the applied coupon from the cart instead. The cart owns the coupon; accepting
one from the request would be a second source of truth that the client controls.

This is a breaking change to two tRPC inputs and to the checkout client that calls
them.

`CreateOrderUseCase` is **unchanged**. It already takes an optional `couponCode` and
already re-validates it server-side and derives the discount itself — its docblock
already says the code is "always re-validated here, never trusted from the client."
What changes is only where its caller gets that code: from the cart rather than from
the request.

**If the coupon is invalid at checkout**, `CreateOrderUseCase` continues to fail
loudly rather than silently dropping the discount, and the cart's applied coupon is
cleared so a retry succeeds. The customer chose to apply a code and is entitled to
be told it did not hold, rather than being charged full price without comment.

The guarded conditional `UPDATE` that arbitrates redemption limits is **untouched**
and remains the sole authority on whether a redemption is allowed.

## Migration

The store is not live and cart rows are seed data, so no data is preserved.

1. New migration file adding `carts` and re-pointing `cart_items`.
2. Because `cart_items.user_id` is `NOT NULL` and is being replaced rather than
   altered, `cart_items` is dropped and recreated. Existing cart rows are discarded
   deliberately.
3. Applied with `pnpm db:push`, the day-to-day workflow in this repo.
4. `drizzle/meta/_journal.json` must list the new file if `db:migrate` is ever to
   run it. This repo already has unjournalled migrations (`0002`, `0003`, `0004`),
   so the new file states in its own header how it is applied.

Re-seeding (`pnpm seed`) restores fixture carts.

## Testing

- **`cart-coupon-freshness.ts`** — pure unit tests: null `checkedAt`, exactly at the
  boundary, side of the boundary, far past.
- **`applyCoupon` / `removeCoupon`** — use-case-level tests with a mocked cart
  repository and a mocked `ValidateCouponUseCase`: empty cart rejected, invalid code
  rejected with its reason, valid code stored, second apply replaces the first.
- **`cart.get` re-validation** — mocked repository: fresh coupon is not re-validated
  (assert the validator is not called), stale-and-valid renews, stale-and-invalid
  clears and reports.
- **Checkout** — the coupon is read from the cart, not from input; an invalid
  coupon at checkout fails and clears the cart's coupon.
- Existing cart tests must keep passing unchanged. That they do is the evidence the
  repository refactor preserved behaviour.

No integration tests: they are read-only by project rule.

## Out of scope

- Stacking more than one coupon per cart.
- Showing a discount amount or a discounted total in the cart (decision 2).
- Guest coupons (decision 3).
- A visible countdown (decision 5).
- Saved / multiple carts per user. The schema permits it later by dropping
  `carts.user_id UNIQUE`; nothing else is built for it now.
- Abandoned-cart tracking. `carts.created_at` / `updated_at` make it possible later.

## Risks

- **The two payment-path deletes.** Moving them behind `clearCart` is correct but
  touches the flow that empties a cart after payment. If it regresses, a customer
  pays and their cart still shows the items. Covered by asserting `clearCart` is
  called on both the webhook and the success-page paths.
- **`applyCoupon` reads the cart twice** — once for the subtotal, once inside
  validation for the per-user count. Two round trips on a user action, acceptable,
  and pipelined where the queries are independent.
- **A coupon can be applied and then invalidated by the customer's own edits** —
  removing items below `minPurchaseAmount` is the common case. Re-validation catches
  it within 15 minutes, and checkout catches it immediately. The cart may briefly
  show a coupon that would not survive checkout. Accepted: the alternative is
  re-validating on every cart mutation, which is a query on every quantity change.
