# Optimistic storefront + cart stock ceilings

**Date:** 2026-09-04
**Status:** Approved, not yet implemented
**Scope:** Storefront only. Admin is explicitly out of scope.

## Problem

Two problems that turn out to share a root cause.

**The storefront is not optimistic.** Of eleven storefront mutations, exactly
two update the UI before the server answers: the cart's `updateQuantity` and
the wishlist heart button. Everything else awaits a round trip and then
invalidates a query. Against Neon in `eu-central-1` that is ~58ms warm and
~560ms on a cold connection, and it is visible: the notification badge lags
every click, an address takes a beat to disappear, the wishlist grid pauses
before dropping a row.

**Add-to-cart cannot be pressed twice.** Every press does
`await addMutation.mutateAsync(...)` with an `isAdding` flag disabling the
button for the duration (`QuickAddButton.tsx:36`, `ProductActions.tsx:44`).
Adding ten of something means ten round trips, each one behind a dead button.

**The client does not know the stock ceiling.** The server enforces
`existing.quantity + requested <= stock` (`cart.repository.ts:241-254`), but
`ProductDetail.tsx:91` sets the stepper maximum to raw variant stock, ignoring
what the cart already holds. With three of a five-stock item in the cart the
stepper offers five and the server rejects the add. The customer discovers the
limit only by hitting it.

## Goals

1. Add-to-cart is a local write. Press it thirty times in a row; the cart reads
   thirty immediately and the server hears one request.
2. The client refuses the thirty-first press without sending anything.
3. Every remaining storefront mutation updates its UI immediately and reverts
   with a Retry affordance on failure.

## Non-goals

- **Checkout.** It is a payment. Optimism there means claiming an order
  succeeded before it did.
- **Reviews.** Submission is moderated; "queued for approval" is the honest
  response and is what it says today.
- **Coupons.** The server decides validity and the discount amount. An
  optimistic "applied" that reverses is worse than the current inline error.
- **Admin.** Single-operator, not worth the complexity.
- **Guest checkout.** See Future work.

## Design

### 1. Shared foundation

#### 1a. `src/lib/optimistic-toast.ts`

`showRetryToast(message, onRetry)` over `sonner`'s action API, so revert-and-
retry looks identical on every surface. The retry replays the mutation _and_
re-applies the optimistic patch, so a successful retry reads as the action
having worked late rather than as a second action.

#### 1b. `src/hooks/use-optimistic-mutation.ts`

`WishlistButton.tsx:52-79` already performs the correct sequence by hand:
`cancel` -> snapshot -> `setData` -> rollback in `onError` -> `invalidate` in
`onSettled`. That is roughly 25 lines per mutation, which is why no other
surface has it. The hook takes the query to patch plus a patch function and
does the rest.

Per this repo's convention (`variant-stock-registry.ts`,
`cart-sync-registry.ts`), anything that can be pure is pure: retry policy and
delta arithmetic live in plain modules with unit tests, and the hook is a thin
React wrapper over them.

### 2. Cart: optimistic debounced add

#### 2a. `src/lib/cart-add-registry.ts` (new pure module)

**The constraint that shapes this:** `cart.add` is additive on the server —
`requestedQuantity = existing.quantity + cartItem.quantity`
(`cart.repository.ts:241`). Additive writes do not compose with debouncing.
Thirty presses must not become thirty `+1` calls, and they must not become one
`quantity: 30` call when the line already held five.

So the registry accumulates a **delta** per `productId:variantId` key and
flushes it as a single additive call:

- key: `` `${productId}:${variantId ?? "-"}` ``
- `queueAdd(key, delta, run)` accumulates and re-arms a 1s debounce
- `pendingDelta(key)`, `isPending(key)`, `cancel(key)`, `cancelAll()`
- on flush, `run(totalDelta)` issues one `cart.add`; the delta clears when it
  settles

Same shape, same debounce window, and the same "last call wins" semantics as
`cart-sync-registry.ts`. A module-scope singleton created in
`cart-provider.tsx`, for the reason documented there: a registry scoped inside
`useCart()` gives every mounted component its own timers, and several cart
surfaces are co-mounted on any given page.

#### 2b. Two problems this exposes

**`reconcileServerCart` drops optimistic lines.** It maps over _server_ items
(`cart-sync-registry.ts:125`), so a local-only line with no server row yet is
not in its output at all. Any unrelated refetch — and every cart mutation's
`onSuccess` calls `invalidateCart()` — would make a just-added line vanish and
reappear a second later. It must also carry through local lines that have a
pending add and no server counterpart.

**A new optimistic line must not use the `guest-` prefix.** `CartProvider`'s
merge effect keys off that prefix to decide what to fold into the server cart
at sign-in, so an authenticated optimistic line carrying it would be added a
second time. New prefix `pending-`, excluded from both the merge filter and
`clearSignedOutItems`.

#### 2c. `src/lib/cart-stock-limit.ts` (new pure module)

`remaining = max(0, liveStock - quantityAlreadyInCart)`.

Because adds are optimistic, the local cart quantity already includes pending
presses, so `remaining` counts down to zero as the customer presses and the
guard needs no separate knowledge of what is in flight.

`liveStock` resolves the same way the existing code already does: the shared
variant-stock poll when it has a figure, falling back to the server-rendered
snapshot (`selectedVariant.availableStock`). For a product with no variants
there is no variant row to poll, so the fallback is the line's `maxStock`,
which is what `CheckCartStockUseCase` also uses for variant-less lines. When
no figure is available at all, `remaining` is unconstrained and the server
stays the authority — the same posture as today.

Applied at:

- `ProductDetail.tsx:91` — stepper maximum becomes `remaining`, not raw stock
- `QuickAddButton` — disabled at `remaining === 0`, reading "All N in cart"
  rather than "Sold Out", which would be false
- `CartItem.tsx:41` — already correct against `availableFor(item.id)`, unchanged

#### 2d. `isAdding` is deleted from both add buttons

Debouncing alone would fix nothing: the button would still be dead between
presses. The press path loses its round trip entirely, so there is nothing to
show a spinner for. The button is live at all times and the stock ceiling is
the only thing that stops it.

Two consequences:

- **The confirmation counts instead of blinking.** `QuickAddSliderBar.tsx:118`
  sets `justAdded` on a fixed 2s timer; under burst pressing that re-arms
  thirty times and reads "Added!" throughout. It reads the live pending delta
  instead — "Added 7" — so the button is itself the evidence that presses are
  landing, and the ceiling is legible as it climbs.
- **Quick Add stops auto-opening the drawer.** `QuickAddSliderBar.tsx:120`
  calls `openCart()` on every add. That was correct when one press meant one
  add; with burst pressing, press one slides the drawer over the card still
  being pressed. Quick Add drops the auto-open and lets the navbar badge
  confirm. The product page keeps it — there is no burst-pressing problem
  behind a full-width button.

#### 2e. Un-freezing the cart

`CartDrawer.tsx:97,137` and `CartPopulated.tsx:37,54` apply
`disabled={isSyncing}` to every control, so editing one line locks the entire
cart while a write is in flight — the optimistic value lands instantly and the
UI locks anyway. These become per-line, driven by `registry.isPending(id)`.

The Checkout button (`CartSummary.tsx:85`) is the one place where blocking is
correct, but disabling is the wrong instrument. It **flushes pending writes**
before proceeding — both registries, since a cart can hold a pending add and a
pending quantity edit at the same time — and awaits them, so checkout can never
open against a cart the server has not caught up to. The current `disabled`
provides that only by accident. This requires a `flushAll()` on both
registries: fire every armed timer immediately and return a promise that
settles when the writes it triggered do.

### 3. Remaining surfaces

All four use the 1b hook, so each is a small uniform change.

| Surface             | File                                                                | Patch                                               |
| ------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| Wishlist remove     | `account/wishlist/page.tsx:22`                                      | drop row from `getMyWishlist`, decrement `getCount` |
| Notification read   | `UserNotificationsBell.tsx:44`, `account/notifications/page.tsx:43` | flip row in `list`, decrement `unreadCount`         |
| Mark all read       | same                                                                | all rows read, `unreadCount` to 0                   |
| Notification delete | `account/notifications/page.tsx:56`                                 | drop row, adjust count if unread                    |
| Address CRUD        | `account/addresses/page.tsx:29-73`                                  | patch `address.list`; create needs a temp id        |
| Set default address | `account/addresses/page.tsx:66`                                     | pure list transform, no server data needed          |
| Profile name        | `ProfileForm.tsx:34`                                                | patch `profile.me`                                  |

Notifications is the most visible of these: the badge currently lags every
interaction.

Wishlist takes **only** optimistic removal. Stock constrains the cart, never
the wishlist — a saved item is allowed to be sold out, and the grid already
handles that correctly (`WishlistGrid.tsx:90`, "Unavailable right now — it
stays saved here"). The grid's cart button is a link to the product page
(`WishlistGrid.tsx:112`), not an add, because a wishlist entry is a product
rather than a variant, so no ceiling applies there.

## Testing

Follows the repo's split. The pure modules carry the real logic and get unit
tests in `pnpm test` (no database, what CI runs), colocated as `*.test.ts`:

- `cart-add-registry.test.ts` — delta accumulation across a burst, one flush
  per burst, last-call-wins, `cancel` before removal, delta cleared on settle
- `cart-stock-limit.test.ts` — the ceiling arithmetic, including the case that
  motivated this (three in cart of a five-stock item leaves two)
- `cart-sync-registry.test.ts` — extended for `reconcileServerCart` carrying
  through a pending local-only line

The guard worth naming explicitly: **the thirty-first press issues no
request.** That is a property of `cart-stock-limit` plus the call site, and it
is the single assertion that says this feature works.

No component tests. There is still no DOM testing library, and per the repo
convention client logic worth testing gets extracted into a plain module —
which is exactly what the three modules above are.

## Risks

- **Delta drift.** If a flush fails and the rollback misses, the local cart and
  the server disagree until the next `cart.get`. Mitigated by rolling back the
  exact delta that failed and letting reconciliation settle it; the pending-line
  handling in 2b is what keeps the two from fighting.
- **Ceiling staleness.** `remaining` is computed against the shared stock poll,
  which is 60s on browsing surfaces (`GRID_REFRESH_MS`). A customer can still
  be refused server-side if stock moved inside that window. That is acceptable
  and unchanged from today — the server remains the authority, and the cart's
  own check runs at 15s (`STOCK_CHECK_MS`) where staleness actually costs a
  failed checkout.

## Future work

**Guest checkout.** The guest cart pipeline is complete and unreachable:
`useCart().addItem` has a guest branch, `mergeGuestItems` folds local lines
into the server cart at sign-in, and `clearSignedOutItems` preserves guest
lines across session expiry — but `QuickAddButton.tsx:20` and
`ProductActions.tsx:26` render "Sign In" instead of the add button, so nothing
reaches it. The intended end state is that **checkout** requires sign-in and
the existing local cart is carried in. Deliberately deferred; the gate stays
for now.
