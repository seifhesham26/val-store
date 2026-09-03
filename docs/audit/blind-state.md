# Side Effects & State — audit findings

Scope covered: `src/application/container.ts` and every `*.container.ts` (13
modules), `src/server/utils/auth-helpers.ts` (role cache), `src/server/trpc.ts`

- `src/server/caller.ts` (request context), `src/lib/cache.ts`
  (`unstable_cache` fetchers), `src/lib/stores/cart-store.ts`,
  `src/components/providers/*` (5 files), `src/hooks/*` (5 files), and a
  targeted sweep of `src/components/**` for `setTimeout`/`setInterval`/
  `addEventListener`/`IntersectionObserver`/optimistic-update/`useEffect`
  patterns (search dialog, announcement bar, checkout, admin order-close
  dialog, wishlist, notifications, featured-items editor, image upload).

The DI container and every domain `*.container.ts` module were checked
first, as the highest-value target: repositories are constructed once and
memoized at module scope, but every one of them is stateless after
construction (no repository sets an instance field after its constructor
runs — verified by grepping for `this.<field> =` outside constructors across
`src/infrastructure/database/repositories/`), and every use case takes the
caller's identity as a method argument rather than capturing it at
construction time. The role cache in `auth-helpers.ts`
(`ROLE_CACHE_TTL_MS`/`roleCache`) is keyed per-user-id, bounded
(`ROLE_CACHE_MAX_ENTRIES`), and invalidated from the one place a role is
written (`user-profile.repository.ts` calls `invalidateUserRole` on every
update) — no leak between users found there. `createContext`/
`createDirectContext` in `trpc.ts` build a fresh `TRPCContext` (and a fresh
`pending` promise closure) per request/per call, so nothing request-scoped
survives into the next request. No cross-user leak was found in this pass.

## Findings

- [FOUND] src/components/providers/cart-provider.tsx:168 — `useCart()`'s debounce-timer map is per-component-instance, so quantity edits made through two simultaneously-mounted cart surfaces for the same line race and can silently lose the customer's last edit — medium.
  - `CartDrawer` (src/components/cart/CartDrawer.tsx) is mounted unconditionally in `src/app/(main)/layout.tsx`, so it stays mounted (with its own `useCart()` call and its own `updateTimersRef`) on every storefront route, including `/cart`, where `CartPopulated` (src/components/cart/CartPopulated.tsx) makes a _second_, independent `useCart()` call with its own empty `updateTimersRef`.
  - A customer bumps the quantity of line X from 2→3 through one surface (e.g. opens the drawer from a product page, edits X); this starts a 1000ms `setTimeout` in that hook instance's `updateTimersRef` (cart-provider.tsx:261-273).
  - Before that timer fires, the customer navigates to `/cart` (client-side, so the drawer instance and its pending timer are untouched) and edits the same line X again through `CartPopulated`'s stepper, e.g. 3→5; this is a _different_ `useCart()` instance whose `updateTimersRef` has no entry for X, so it cannot see or cancel the first timer — it just schedules its own second 1000ms timer for X.
  - ~1s later both timers fire as independent `updateQuantity` mutations (`quantity: 3` then `quantity: 5`, or reversed if the network reorders the two in-flight requests); whichever server write lands last wins, and if it's the stale one, the next `cart.get` refetch replaces the store's `items` (cart-provider.tsx:42-57) with quantity 3 — the customer's final on-screen choice of 5 is silently reverted with no error shown.

- [FOUND] src/components/providers/cart-provider.tsx:42-57 — the server→store cart sync effect does a wholesale `setItems(items)` replace, which can overwrite an optimistic quantity edit that is still sitting in `useCart()`'s pending 1000ms debounce — medium.
  - Authenticated customer on `/cart` has line A at quantity 2. They click "+" on A: `store.updateQuantity` (cart-provider.tsx:249) immediately sets the local/UI quantity to 3, and a 1000ms debounce timer is scheduled to PATCH the server (cart-provider.tsx:266-273).
  - Within that 1000ms window the customer also adds a different product via `addItem`, whose mutation's `onSuccess` calls `invalidateCart()` (cart-provider.tsx:177-180), invalidating and refetching `cart.get`.
  - The refetch reflects server truth as of _before_ A's debounced PATCH has landed, i.e. A is still quantity 2. The sync `useEffect` at line 42 fires on the new `serverCart` and calls `setItems(items)`, replacing the entire store array — line A's on-screen quantity flips back from 3 to 2 for up to the remainder of the debounce window, even though the customer's edit is still in flight and will eventually land.
  - The pending timer still fires afterward and corrects A back to 3 (using its own closed-over quantity, not the reverted store value), so the end state is usually right — but the customer saw their own edit visibly reverted for up to ~1s, and if they react to the flicker by clicking "+" again, that starts a fresh debounce that will push the final quantity one higher than intended.

- [FOUND] src/hooks/use-payment-window.ts:39 — the countdown's initial value is `Date.now()` captured in a `useState` initializer, which runs once during the server render and again at client hydration, producing two different "remaining time" labels for the same first paint — low.
  - An admin opens an order detail page for an order with an open Stripe payment window; `PaymentWindowNotice` (src/components/admin/orders/detail/PaymentWindowNotice.tsx) renders `usePaymentWindow(deadline)`, whose `const [now] = useState(() => Date.now())` (use-payment-window.ts:39) runs during the server-side render, computing e.g. a "4:59" label baked into the HTML sent to the browser.
  - The browser downloads and hydrates the page; the same `useState` initializer runs again on the client at a later real-world instant, computing a different `now` (e.g. one or more seconds later, possibly crossing a `m:ss` second boundary), so the client's first render of the same text node disagrees with what the server sent.
  - This is a genuine SSR/CSR content mismatch on first paint (not merely a later re-render), reproducible on any order-detail load while a payment window is open; `OrdersList.tsx` and the customer-facing `account/orders/[id]` page share the same hook and are subject to the same mismatch.

None of the module-scope DI container, the role cache, the `unstable_cache`
catalogue fetchers, the variant-stock / cart-stock providers, or the
wishlist optimistic-update flow showed a reproducible cross-user leak,
missing-cleanup, or lost-update sequence — those were checked and are
clean (see rationale above and inline comments in
`variant-stock-registry.ts` / `cart-stock-provider.tsx`, which already
address the ref-counting and re-open-after-dismiss races an unbiased read
would otherwise flag).
