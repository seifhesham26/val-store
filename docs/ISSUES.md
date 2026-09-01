# Known Issues

A catalogue of defects and gaps found by reading the codebase in full. Unlike the other files in `docs/`, this one describes **current state**, not plans.

Each entry gives the location, what actually happens, why, and a concrete fix.

Verified baseline, re-checked 2026-08-31 on `fix-p1`: `pnpm type-check` clean, `pnpm lint` 0 errors / 5 warnings, 124/124 unit tests pass. Every open issue below is a runtime or design problem, not a compile error — which is exactly why they survived.

Coverage improved with the P2 work but is still narrow. `pnpm test` is unit-only and is all CI runs; `pnpm test:integration` adds repository and router tests against a real database, and is where the SQL introduced by the performance work is checked against the domain logic it replaced. There are still no component tests.

Issues 1-43 are the original catalogue and are the work in progress. [Pass 2](#pass-2--full-source-audit-deferred) is a later audit, numbered separately and deliberately not started — finish 1-43 first.

**Contents**

- [Resolved](#resolved) (19)
- [Follow-ups — residue from the P0/P1 work](#follow-ups--residue-from-the-p0p1-work) (2)
- [P1 — Features that are broken or missing](#p1--features-that-are-broken-or-missing) (1)
- [P2 — Performance](#p2--performance-) (5, all resolved ✅)
- [P3 — Cleanup](#p3--cleanup) (15)
- [Pass 2 — full-source audit, deferred](#pass-2--full-source-audit-deferred) (14)
- [Suggested order of work](#suggested-order-of-work)

---

## Resolved

Every P0 is fixed and verified against the code on `main`. They keep their original numbers so older references still resolve, and they stay in this file because each one names a trap the architecture makes easy to fall into again — the **Still true** notes are the part worth re-reading before working nearby.

### 1. Editing a product silently wiped its detail fields ✅

`UpdateProductUseCase` built a fresh `ProductEntity` from 13 positional arguments, so `gender`, `material`, `careInstructions`, `metaTitle` and `metaDescription` were written back as `NULL` on every save.

**Fixed** in `a75d98e`. The use case now passes all 18 and distinguishes the two meanings of "absent" — `input.data.x !== undefined ? input.data.x : existing.x` (`update-product.use-case.ts:81-90`) — so `undefined` keeps the stored value and `null` clears it. The five fields were added to the router schema and to `ProductEditForm`, so they are settable again.

**Still true** The 18-argument positional constructor is what hid this from the type checker. Nothing stops the next field from being dropped the same way; an object-shaped constructor or a partial patch at the repository boundary would.

---

### 2. The admin order status dropdown offered an invalid status and omitted a valid one ✅

The dropdown listed `confirmed`, which exists in neither the Postgres enum nor `OrderStatus`, and omitted `paid`, which the Stripe webhook sets.

**Fixed** in `c62da0b`. `ORDER_STATUSES` is exported from `order-status.value-object.ts:23` and is now the only list: the router validates with `z.enum(ORDER_STATUSES)`, and `UpdateStatusCard`, `OrdersListHeader` and `OrderDetail` all render from it. Four consumers, one source.

---

### 3. The admin order detail showed a UUID where the shipping address should be ✅

`mapToEntity` put the address id straight back into the entity's address field, and `AddressesCard` rendered it raw.

**Fixed** by taking the second of the two options originally suggested — the structured one. The repository joins `shippingAddress`/`billingAddress` (`order.repository.ts:110,145,803`) and the entity now carries `shippingAddressId` **plus** a resolved `OrderAddress`, so the id/text overloading that caused the bug is gone rather than papered over.

---

### 4. Store and Appearance settings refused to save when any field was blank ✅

Both tabs POSTed `""` into fields validated with `.url()` / `.email()`.

**Fixed** in `c9f214a` at the schema boundary, not in the two forms: an `emptyToNull` preprocessor (`site-settings.ts:18`) wraps every optional string field, so the rule holds for any future caller too.

---

### 5. `pnpm db:migrate` would have built the wrong database ✅

The chain dated from before the app schema existed: a uuid-keyed `users` table, a `password_reset_tokens` table, none of the ~20 business tables, and an `0002` that re-created what `0000` had already made.

**Fixed** in `a75d98e` by regenerating rather than deleting. `drizzle/` is now a single baseline — `0000_long_ultragirl.sql`, 27 tables, one journal entry — matching `src/db/schema.ts`. `db:generate` and `db:migrate` are real commands again.

**Still true** An already-pushed database has those tables without the journal row. Mark the baseline as applied there; do not run it.

---

### 6. Buying something never reduced stock ✅

Nothing decremented `product_variants.stockQuantity`, and the `sale` value in `inventory_change_type` was defined and never written.

**Fixed** inside the existing order transaction (`order.repository.ts:248-280`), so stock, the `sale` log row and the order commit together or not at all. Cancellation and refund restock through the same path. Variants are sorted by id before locking, so two concurrent orders touching the same pair cannot deadlock.

---

### 7. Coupons were validated, displayed, and then thrown away ✅

The coupon lived only in React state; orders always stored `discountAmount: "0"` and Stripe charged full price.

**Fixed** end to end. `couponCode` is an input to both checkout paths, `CreateOrderUseCase` **re-runs validation server-side** and computes the discount itself (a client-sent amount is never trusted), and the discount, the `coupon_usages` row and the `usageCount` increment are written in the order transaction — and reversed on cancel or refund. The Stripe session carries the discount too.

---

### 8. The cart discarded the selected size and colour ✅

`variantId` was hardcoded `null` on insert, so the chosen variant never reached the database, `maxStock` resolved to 0, and adding size M then size L produced one row of quantity 2.

**Fixed** by threading `variantId` through the whole path: the cart insert (`cart.repository.ts:200`), `findByUserAndProduct` matching on `(userId, productId, variantId)`, `maxStock` read from the joined variant, and `order_items.variantId` (`order.repository.ts:200`). This is what unblocked #6.

---

### 9. The SKU an admin typed was discarded ✅

`DrizzleProductRepository.create()` wrote `sku: product.slug`, so the SKU the form required, validated and checked for uniqueness was thrown away. `ProductEntity` had no `sku` property at all, so the value had nowhere to travel. Renaming a slug later did not update the SKU, so the two drifted apart silently.

**Fixed** by giving the value somewhere to live: `ProductEntity.sku` (`product.entity.ts:24`) carries it from the use case to the repository, which now writes `sku: product.sku`. The duplicate uniqueness check that ran against the _slug_ — and reported a `DuplicateSKUException` naming the wrong string — is gone, and SKU is an editable field on the edit form. Validation is bounded at `.max(100)` to match the column, on every input path.

**Still true** SKU uniqueness is only checked when the value changes, so a product cannot collide with itself. Variant SKUs are trimmed in the use case and the product SKU is trimmed on create — keep both, or they diverge again.

---

### 10. A sale price could never be removed ✅

The edit form sent `salePrice ?? undefined`, and `undefined` correctly means "keep existing" in a partial update.

**Fixed** on both sides: the form sends `null` (`ProductEditForm.tsx:128`), and the router's update schema widened to `z.number().positive().nullable().optional()` (`products.ts:81`) so `null` survives validation and reaches the use case as "clear it".

---

### 11. Nothing ever created a notification ✅

Both tables, both repositories, both routers and both bell dropdowns were complete, and no code anywhere called `create()` or `createMany()`. Both bells always showed zero.

**Fixed** with one writer rather than scattered inserts: `NotificationService` (`src/application/notifications/notification.service.ts`) is the only thing that writes either table, and is injected into `CreateOrderUseCase`, `UpdateOrderStatusUseCase`, `RefundOrderUseCase`, `AdjustStockUseCase`, the review router, the signup hook, the Stripe webhook and the success page.

**Still true** **Every emit swallows its own failure** and logs `[Notifications] <label> failed:`. That is the safety contract — an order must never fail over a courtesy message — but it means a broken emit is invisible in the UI. If a notification does not appear, read the server log before reading the code. Two further traps: admin notifications are per-admin-user rows fanned out in one insert, so a new admin gets no backlog; and low stock fires on the **crossing**, not the level, so an already-low variant does not notify on every subsequent sale.

**A gap that survived the first pass:** a _partial_ return is not a status change, so `orderStatusChanged` never fired for it and refunds notified nobody. `NotificationService.orderRefunded()` now handles returns separately, reporting the money moved by that return rather than the running total.

---

### 12. The Featured settings tab controlled nothing ✅

The admin curated into `featured_items` and the homepage read `products.isFeatured` and "the first three active categories". The Add button had no handler, the search box filtered nothing, and the "drag to reorder" tip described behaviour that was never built.

**Fixed** by adopting `featured_items` as the source of truth — the first of the two options originally offered. `resolveFeaturedProducts` and `getCachedFeaturedCategories` (`src/lib/cache.ts`) read the curated list, and the tab gained working search, add, remove and up/down reorder. Every write drops the cache tag, so the homepage updates within a second rather than after 60.

**Still true** The fallback is load-bearing: an empty curation — **or one whose every item has since been deactivated** — falls back to the `isFeatured` set and the first three active categories. The section must never render its heading above an empty grid. The first implementation checked the raw list rather than the resolved one and got this wrong.

---

### 13. There was no way to manage categories ✅

Categories were seed-only. `admin.categories.list` existed purely to fill the product dropdown; `create`/`delete` had no UI and `UpdateCategoryUseCase` was reachable from nothing.

**Fixed** with `/admin/categories` — table plus create/edit dialog plus guarded delete. Both fixes the entry asked for are in: slug generation goes through one shared `slugify` (`src/domain/shared/slug.ts`), and `DeleteCategoryUseCase` refuses to delete a category with children or products, so a parent can no longer orphan its rows through the missing FK.

**Still true** `categories.parentId` still has **no FK constraint** — the guard is application-level, so anything writing outside the use case can still orphan children. Category delete is still **hard** while products soft-delete. The delete guard and the table's product count both count archived products on purpose: a table reading "0 products" beside a server that refuses would just look broken.

---

### 14. `/forgot-password` did not exist ✅

An empty directory linked from two live buttons — the login form and the profile's "Change Password" card. Both 404'd. The backend half (`sendResetPassword`, `sendPasswordResetEmail`) was already written.

**Fixed** with both pages, and `passwordResetRateLimiter` — defined and unused — is now wired in `src/lib/auth.ts:45`.

**Still true** The request form answers **identically** for a registered and an unregistered address, deliberately: a different response would let a stranger test which addresses have accounts. Do not "improve" that into a helpful error. Rate limiting no-ops without `UPSTASH_*`, so it will not trigger locally.

---

### 15. One of the two stock-editing paths skipped the audit log ✅

Editing stock on the product page wrote the number straight to the variant; editing it on the Inventory page logged. The history was silently incomplete.

**Fixed** at the schema boundary rather than by adding a second logging call: `admin.variants.update` **no longer accepts `stockQuantity` at all**, and stock moves through `AdjustStockUseCase` on every path, writing an `inventory_logs` row with the author and a reason.

**Still true** Creating a _new_ variant with an opening stock figure writes no log row — that is an opening balance, not a movement. Every change after it is logged.

---

### 17. Currency was inconsistent in four places ✅

Stripe charged `egp`, the order repository wrote `EGP`, `site_settings.currency` defaulted to `USD`, and every price in the UI was rendered with a hardcoded `$`. Customers in Egypt were billed in pounds and shown dollars.

**Fixed** by making currency **deployment configuration** rather than a database setting: `src/lib/currency.ts` exports `STORE_CURRENCY` (`NEXT_PUBLIC_STORE_CURRENCY`, default `EGP`), `STRIPE_CURRENCY`, and one `formatCurrency` used by every price display. A Stripe account is bound to the currency it charges in and every stored price is already denominated in it, so switching is a migration, not a dropdown — the Settings dropdown that implied otherwise is now a read-only row.

**Still true** Four admin displays still hardcode `$` — see #40 — and rows written before this change still say `USD` — see #41.

---

### 18. Wishlist stock status was not stock ✅

`WishlistItemEntity.inStock` came from `products.isActive`, so a sold-out product showed as in stock.

**Fixed** in two halves. The repository sums `stockQuantity` across available variants in **one grouped query for the whole page**, not one per row, and requires `isActive` _and_ stock. The grid then had to be taught to read it — for a while `inStock` was correct and every card still rendered the same "Choose Options" button. Out-of-stock cards are now dimmed, badged, and their button disabled.

**Still true** The item stays on the wishlist while sold out. That is the point of a wishlist; do not "tidy" it away.

---

### 19. Reviews were never marked as verified purchases ✅

`isVerifiedPurchase` was hardcoded `false` and `reviews.orderId` was always null, so the badge could never appear.

**Fixed** by looking for an order by this user containing this product before inserting, and storing the `orderId` alongside the flag (`public/reviews.ts:77,91`).

**Still true** Only `paid`, `processing`, `shipped` and `delivered` count. A purchase that came undone — cancelled or refunded — does not earn the badge.

---

### 20. A failed image or variant save left a half-created product ✅

The browser created the product, then looped through images and variants one request at a time, each in its own `try/catch` that only raised a toast — and redirected anyway.

**Fixed** by accepting `images` and `variants` as arrays on `admin.products.create` and persisting all three in one server-side transaction.

**Still true** The **edit** page still saves images and variants one at a time, on purpose: there each change is its own deliberate action, not part of building one object.

---

Work done in the same period that this file never catalogued — partial returns with derived refund totals, the payment expiry window and stale-checkout sweep, coupon-scaled refunds, and order numbers and customer names in the admin — is documented in `docs/P0-TEST-PLAN.md` instead.

---

## Follow-ups — residue from the P0/P1 work

Not part of the original catalogue. These were found by reading the finished P0
and P1 work back against the code, and each one exists **because** of a fix
rather than in spite of it — a change applied to one screen and not its
sibling, or a split that was right in principle and left a seam. They are
listed apart from P1-P3 so it stays obvious that the fix is nearly done rather
than not started.

### 42. The customer order detail page never received the P0/P1 order work

**Where** `src/server/routers/public/orders.ts:106-118` (`getOrderById`), and the four components it feeds: `account/order-detail/OrderDetailHeader.tsx:38`, `OrderItems.tsx:30`, `OrderSummaryCard.tsx`, and the page itself at `src/app/(main)/account/orders/[id]/page.tsx`.

**What happens** Order numbers, partial returns and the payment window were all fixed thoroughly on the **admin** order screens and on the customer order **list**. The customer order **detail** page was missed, so five things the rest of the app knows are invisible on the one screen a customer opens to check an order:

1. **The order number is missing.** The header renders `Order #{orderId.slice(-8)}` — a UUID fragment. The list one click earlier shows the real `VLK-YYYYMMDD-XXXXXX`, so the same order has two identities depending on the screen, and the number a customer would quote to support is on the wrong one.
2. **No refund information at all.** `OrderSummaryCard` takes subtotal/shipping/tax/discount/total and nothing else, so a partly returned order looks untouched. This is precisely the defect the admin orders list fixed — a return is not a status change, so without an explicit signal there is nothing to see.
3. **Per-line returns are missing.** `OrderItems.tsx:30` renders `Qty: {item.quantity}` — the same string the admin items card showed before it was taught to say "1 of 3 returned · 2 still with the customer". `item.refundedQuantity` is already in the payload, unread.
4. **No payment window countdown,** though the list has one — and the detail page is where someone would sit while paying.
5. **`shippingAddress` is fetched and never rendered.** It is in the payload; the page renders header, timeline, items and summary, and no address.

**Why** `getOrderById` returns a hand-written subset of the entity that predates all of this work, and nothing forces it to keep up: `orderNumber`, `refundedAmount()`, `getRefundedItems()`, `isFullyRefunded()`, `isAwaitingPayment()` and `paymentDeadline()` are all on `OrderEntity` and simply are not selected. That the checkout success page needs a whole separate `getOrderNumberById` query is the same omission showing through somewhere else.

**Fix** Widen `getOrderById` with `orderNumber`, `refundedAmount`, `refundedItems`, `fullyRefunded`, `awaitingPayment` and `paymentDeadline` — the same fields `getMyOrders` already returns — then update the four components. Doing so also makes `getOrderNumberById` redundant for anything but the Stripe-session lookup.

**Not affected, checked:** the customer `OrderTimeline` is driven by dates rather than status, so it never had the `confirmed`/`paid` drift the admin timeline did.

---

### 43. Saving a variant is two mutations, not one transaction

**Where** `src/components/admin/products/create/VariantsSection.tsx:60-77`, `src/server/routers/admin/variants.ts`

**What happens** A side effect of #15. Variant metadata and stock are now deliberately separate operations — stock has to carry an author and a reason, metadata does not — but the form calls `admin.variants.update` and `admin.variants.updateStock` one after the other from the browser. If the second fails you get an error toast with the metadata already saved: the same shape as the create-product bug fixed in #20, at a smaller scale.

**Fix** The split itself is right and should stay. Either fold both into one server-side operation that writes metadata and calls `AdjustStockUseCase` inside a single transaction, or make the form save them as two visibly separate actions so a partial save is not a surprise.

**Checked while here:** `admin.variants.updateStock` does route through `AdjustStockUseCase`, so there is no unaudited stock path — #15 holds.

---

## P1 — Features that are broken or missing

Ten of the original eleven are in [Resolved](#resolved), keeping their numbers. One is left.

### 16. The confirmation email quotes a made-up order number

**Where** `src/app/api/webhook/stripe/route.ts:93,104`

**What happens** The Stripe order-confirmation email shows an order number derived from the Stripe session id (`session.id.slice(-12).toUpperCase()`), which matches nothing the customer can look up, and prints the literal string "Address will be confirmed separately" in place of the shipping address. COD orders get no confirmation email at all.

**Why** The handler builds the email from the Stripe session rather than from the order it just updated — even though `metadata.orderId` is right there.

**Fix** Load the order by `metadata.orderId` and send the real `orderNumber`, real line items, and formatted address. Both halves are already on the entity — `orderNumber` is read back on every load and `shippingAddress` is a resolved `OrderAddress`, not an id — so this is now a matter of using them. Move the send into a small `SendOrderConfirmation` helper and call it from the COD path too, so both payment methods behave the same.

**Deferred on purpose**, not forgotten: it is waiting on a real domain being verified in Resend, so it can be tested end to end rather than merely compiled.

**Added 2026-08-31:** the COD half is worse than "no email". `src/app/(main)/checkout/success/page.tsx:83` tells every customer — on both payment paths — "You'll receive a confirmation email shortly". For COD that is a promise the system cannot keep, and it is shown before the deferred fix lands. Either send the COD email as part of this, or make the success copy conditional on the payment method in the meantime.

---

## P2 — Performance ✅

**All five resolved 2026-08-31**, together with P2-9 and P2-11 from the Pass 2
list and two problems found while measuring. Verified against the live database
and in a real browser, not by reasoning about the code.

Measured on the actual data (36 active products, 516 variants, 13 categories),
best of three runs:

| Path | Before | After | |
| --- | --- | --- | --- |
| Storefront product grid, page 1 | 2877 ms | 472 ms | **6.1×** |
| Product search | 1281 ms | 456 ms | **2.8×** |
| Category list with counts | 1566 ms | 150 ms | **10.4×** |

### 21. Product and order lists fetch every row, then slice ✅

`ProductFilters` and `OrderFilters` gained `offset`, and both repositories now
apply `limit`/`offset` in the query. `ListProductsUseCase`, `ListOrdersUseCase`,
`public.products.list` and `getMyOrders` each fetch one bounded page and run
`count(filters)` beside it in `Promise.all`, rather than loading the filtered
table and slicing.

`ListOrdersUseCase`'s two derived filters were the reason it could not paginate:
refundability and return state are computed on the entity, so a page could only
be cut after every matching order was loaded. Both are now SQL — `returnedOnly`
is an `EXISTS` over `order_items.refunded_quantity`, and `refundableOnly`
mirrors `canRefund()` against the order's payment row. **Note the assumption**
that an order has exactly one payment row, which `create()` guarantees today; if
that ever changes, the predicate needs the same "latest row wins" rule
`mapToEntity` applies.

### 22. Search re-implements in JavaScript what the repository already does in SQL ✅

Resolved by moving search *into* `ProductFilters` rather than by calling the old
`search()` method — a separate method could not compose with `limit`/`offset`,
which is what made the JavaScript version tempting in the first place. The
now-genuinely-duplicate `DrizzleProductRepository.search()` is deleted, along
with its interface declaration.

`gender` and `isOnSale` moved to SQL in the same change; they were the other two
filters applied in JavaScript after the fetch. LIKE metacharacters in the query
are escaped, so searching for `50%` no longer matches the whole catalogue.

### 23. Category product counts issue one full table scan per category ✅

Both remaining callers now use the `countProductsByCategory()` that already
existed: `public.categories.list` and `public.categories.getFeatured`.
`getFeatured` also stopped issuing a `findById` per curated item — it batches
through `findByIds` and re-applies the admin's order.

`getBySlug` was a third instance nobody had catalogued: it returned **every
product in the category** so the page could read `category.id`, then handed that
id to `InfiniteProductGrid`, which queried the products again with pagination.
It returns a count now.

### 24. The dashboard fetches customer names one query at a time ✅

`getRecentOrders` uses a single `leftJoin` on `user`. Guest orders (`user_id` is
null) and orders whose account was deleted are distinguished rather than both
reading "Unknown".

### 25. "My orders" loads 1000 orders per page request ✅

Paginated in SQL like the rest. The expired-checkout sweep in front of it is no
longer awaited: it makes Stripe API calls, so awaiting it put a third-party
round trip ahead of every "My orders" load and every admin order list. It is now
`void`-ed on both, exactly as the cart's stock check already did — the use case
throttles itself to once a minute per process and swallows its own errors, so
the cost of not waiting is that a just-expired order may show as pending until
the next load.

### 44. Every product card ran its own live-stock query ✅

Found while measuring, and the single largest cost on the storefront.

`useVariantStock` keys its query on the variant ids it is handed, and every
`ProductCard` renders a `QuickAddSliderBar` that calls it with *that card's*
variants — so each card had its own query key, its own request and its own
`refetchInterval`. A twelve-card grid called `getStock` twelve times on load and
twelve more every fifteen seconds, forever, growing as the customer scrolled.
The hook's own docstring promised "one cached copy shared by every component";
that is what was missing.

`VariantStockProvider` (`src/components/providers/variant-stock-provider.tsx`),
mounted once in the storefront layout, ref-counts the ids cards register and
serves them all from one query. **Verified in a browser:** `/collections/all`
now issues a single `getStock` request carrying all 131 variant ids, and a
single request per poll.

The refresh interval is deliberately still fifteen seconds, so this is purely a
reduction in how many requests are made and not in how fresh the answer is.

### 45. The footer queried the database on every storefront page ✅

`getCachedSiteSettings` existed in `src/lib/cache.ts` with **no callers**. The
`Footer` — which renders on every page of the site — called
`siteConfigRepo.getSiteSettings()` directly, uncached, while the announcement
bar beside it used the cached path all along. The footer now reads through the
cache, and `admin.settings.updateSiteSettings` calls
`revalidateTag("site-settings")` so a save still shows up immediately.

### 46. React Query had no defaults, so navigation refetched everything ✅

The `QueryClient` was constructed bare: `staleTime: 0` refetches on every mount
and `refetchOnWindowFocus` refetches again on every tab switch. Defaults are now
30 s stale time, no refetch on focus, one retry. Anything needing to be fresher
sets its own values, which still win.

### 47. Images bypassed the optimiser entirely ✅

Every storefront `<Image>` passed `unoptimized`, so the homepage hero served a
full 1920×1080 original as the LCP element with no `sizes` attribute, and each
product card downloaded the original behind a 300 px slot.

`src/lib/image-hosts.ts` now holds the host list `next.config.ts` builds its
`remotePatterns` from, plus the narrower set actually routed through the
optimiser, so the two cannot drift. AVIF/WebP and a 30-day optimiser cache are
on; the hero has `sizes="100vw"` and `fetchPriority="high"`; the first row of
each collection grid is eager rather than lazy.

**`picsum.photos` is deliberately excluded from optimisation.** Optimising means
Next fetches server-to-server, and picsum answers those with 503 — verified
against the live host after the first attempt broke the seed imagery, not
assumed. It is placeholder data; real uploads go to `utfs.io`, which is
optimised. Below-the-fold homepage grids were left lazy on purpose so they do
not compete with the hero for LCP.

### Still open in this area

`ILIKE '%term%'` cannot use a btree index, so search is a sequential scan. Fine
at 36 products; if the catalogue grows into the thousands this wants a `pg_trgm`
GIN index, which means enabling the extension.

The collection pages remain fully client-side — the customer waits for the JS
bundle and then a round trip before any product appears. Server-rendering the
first page would remove that, and is a real refactor rather than a tuning change.

---

## P3 — Cleanup

### 26. Five value objects are written and never used

`Money` (190 lines), `Email`, `PasswordValueObject`, `ProductSKU`, `AddressValueObject` have no importers. Only `PhoneValueObject`, `CategorySlug`, and `OrderStatus` are wired in.

Either adopt them or delete them. Two are worth adopting:

- **`PasswordValueObject`** enforces uppercase, lowercase, digit, and special character. The signup form (`SignupForm.tsx:73`) only checks length ≥ 8, so the documented policy is not enforced anywhere. Use `PasswordValueObject.validate()` in the form (it returns a strength score suited to a meter) and enforce it server-side.
- **`Money`** would fix the float arithmetic currently used for every total.

### 27. Dead components

- `ProductSidebar` — a mockup with dead buttons. `AdditionalDetailsSection` was the other half of this pair and has since been salvaged: it is imported by both `CreateProductForm` and `ProductEditForm`, and its inputs are the fields that #1 used to destroy.
- `CreateProductHeader`, `AddToCartButton`, `CollectionPageLayout` — no importers.
- `src/components/account/AddressList.tsx` and `AddressFormDialog.tsx` are **byte-identical** duplicates of the copies in `account/addresses/`; only the nested pair is imported. Delete the flat pair.

### 28. Unreferenced tRPC procedures

Re-checked 2026-08-31. Still with no caller anywhere: the entire `public.config` router, `public.categories.{list,getFeatured}`, `public.products.{getBySlug,getFeatured}`, `admin.products.getBySlug`, `admin.notifications.clearAll`, and `admin.settings.{getAllContentSections,getContentHistory,revertToVersion}`.

**No longer on this list:** `admin.categories.{create,delete}` (the Categories page calls both — #13), `admin.variants.updateStock` (`VariantsSection.tsx:75`), and `admin.settings.{addFeaturedItem,updateFeaturedItems,reorderFeaturedItems}` (the Featured tab calls all three — #12).

The rest are collateral from the homepage moving to server components. The history procedures are worth wiring rather than deleting — see #29.

### 29. Four of six CMS section types are unreachable

`promo_banner`, `brand_story`, `newsletter`, and `instagram` have Zod schemas, DB rows, seed data, and a public API — but `PromoBanner`, `BrandStory`, and `NewsletterSection` use hardcoded default props, and `HomepageSettings` only edits `hero` and `announcement`.

Either add editors and read the content (the pattern is `ServerHeroSection` + `getCachedHeroSection`), or delete the four schemas and their seed rows.

The **content version history** is the more valuable orphan: `content_sections_history`, `getContentHistory`, and `revertToVersion` are fully implemented and have no UI at all. A version list with a Revert button in `HomepageSettings` is a small amount of work for a feature that already exists end-to-end below the surface.

### 30. Most site settings are decorative

Only `storeName` and the four social URLs are consumed, both in `Footer`. Read by nothing: `logoUrl` and `faviconUrl` (Navbar and Footer hardcode `/logo/VAL-LOGO.png`), `storeTagline`, `defaultMetaTitle` and `defaultMetaDescription` (`src/app/layout.tsx` hardcodes its metadata), `contactEmail` and `contactPhone` (`ContactInfo` hardcodes `support@valstore.com` and a US phone number).

Fix by consuming them: `getCachedSiteSettings()` already exists, so the Navbar, Footer, root `generateMetadata`, and contact page can each read from it with a fallback to the current hardcoded value.

### 31. Committed build artifacts

`build_output.log`, `build_output3.log`, `type_output.log`, and `tmp/tsc_errors.txt` are tracked in git. Delete them and add `*.log` and `tmp/` to `.gitignore`.

### 32. Dead links in the footer

`Footer.tsx` links to `/size-guide`, `/careers`, `/sustainability`, `/press`, and `/blog`. None exist. Build them or remove the links.

### 33. Two collection routes filter incorrectly

`/collections/new` filters on `isFeatured` rather than recency, and `/collections/accessories` applies no filter at all — it renders the full catalogue under an "Accessories" heading (its own comment admits this).

For "new", sort by `createdAt` desc, optionally with a recency window. For accessories, create the category and filter by `categoryId`.

**Added 2026-08-31, same area:** all six static collection routes (`men`, `women`, `new`, `sale`, `all`, `accessories`) take routing precedence over `[slug]`, so a real category created with any of those slugs is unreachable through its own page — including the `accessories` category the fix above asks you to create. Decide whether the static routes should survive at all, or become redirects into `[slug]`. Separately, `[slug]/page.tsx:21` calls `public.categories.getBySlug`, which returns **every product in the category**, purely to read `category.id` and `category.name` before handing off to a grid that queries again.

### 34. The `worker` role does nothing

It exists in the `user_role` enum, `UserProfileEntity.isWorker()`, and both `UserRole` type aliases, but no route or procedure checks it — `adminProcedure` only accepts `admin`/`super_admin`. Either give it meaning (an order-fulfilment view is the obvious one) or drop it from the enum.

### 35. Guest cart persistence is unreachable

`cart-store.ts` persists to localStorage and handles guest items, but `useCart().addItem` shows a sign-in toast instead of adding for unauthenticated visitors, so the guest branch never runs. Either implement guest carts properly (with a merge on login) or delete the guest handling in the store.

### 36. Five lint warnings

Down from seven — two went away with the webhook rewrite. What is left: unused imports in `src/app/admin/products/page.tsx` (`Plus`, `Button`), an unused `error` in `NewsletterSection` (which also swallows the real error), an unused `_width` in `product-image.entity.ts`, and an unused `protectedProcedure` import in `public/user.ts`.

### 37. Billing addresses do not exist

`public.address.create` hardcodes `addressType: "shipping"` (`src/server/routers/public/address.ts:54`), and checkout passes the same address id for both shipping and billing (`create-order.use-case.ts:61-62`). The `addressType` enum and `orders.billingAddressId` column therefore carry no information.

Add a billing-address choice at checkout, or drop the distinction from the schema.

### 38. Smaller notes

- ~~`NEXT_PUBLIC_APP_NAME` is read by `ResendEmailService` but appears in neither `.env` nor `.env.example`.~~ **Done** — verified 2026-08-31, it is in `.env.example` under Store Configuration. The reverse case is now the live one: `STRIPE_PUBLISHABLE_KEY` is documented in `.env.example` and read by no file. It could not be used client-side anyway without a `NEXT_PUBLIC_` prefix, and the app uses Stripe's hosted Checkout, so drop it.
- `zod` is imported as both `"zod"` and `"zod/v4"` across the codebase. Pick one.
- `DrizzleOrderRepository.update()` throws "not implemented" — fine, but it satisfies an interface method that therefore lies about the contract. Remove it from `OrderRepositoryInterface`.
- The contact form is a placeholder (`ContactFormPlaceholder.tsx`). The admin orders list's "coming soon" filter button is gone — the toolbar's buttons all do something now.
- `src/domain/customers/entities/customer.entity.ts` and the phone-keyed `customers` table are written by the signup hook and read by nothing; `GetOrCreateCustomerUseCase` has no callers. Decide whether the phone-identity model is still wanted before building on it.

---

### 39. The storefront runs on the light palette

**Where** `src/app/globals.css:55` (`:root`), `src/app/layout.tsx:29` (`<body class="bg-black text-white">`)

**What happens** `:root` holds the **light** token set — `--background` is white, `--foreground` near-black — and the storefront overrides only `<body>`'s own colours, never the tokens. So every shadcn primitive that styles itself with a token renders light-on-dark on the storefront. Worse, anything Radix renders through a **portal** attaches to `<body>`, escaping even the admin's `ThemeProvider`.

This has now been hit five separate times and fixed five separate times: `AlertDialogContent` had `bg-background` with no `text-foreground` and rendered white-on-white in the admin; `CheckoutLoading` was two near-white `bg-muted` bars on black; `CheckoutOrderSummary`'s no-image tile was a white square; the notifications "Mark all read" button was a white pill (the `outline` variant is `bg-background`); and the applied-coupon chip used `dark:` variants that never apply, because the storefront sets no `.dark` class.

**Sixth and worst:** `ProductReviews.tsx`, on the customer-facing product page. Near-white `bg-muted` skeletons and panels, a light-grey bare `border` — and both of its Buttons on the default variant, which is `bg-primary text-primary-foreground`: near-black on near-white, so "Write a Review" and "Submit Review" were all but invisible. Fixed 2026-08-31 with explicit storefront colours; the root cause below is untouched.

**Fix** Stop patching call sites. Either give the storefront the dark token set (`globals.css` already defines `.dark`; the storefront wrapper would need the class, and portals would need it on an ancestor they actually inherit from), or define a storefront-specific token block. Until then, two rules — both now in `CLAUDE.md`: a surface must set **both halves of a pair** (`bg-background text-foreground`, `bg-popover text-popover-foreground`), and only style with tokens that exist.

### 40. Four admin displays still hardcoded a dollar sign ✅

#17 routed every price through `formatCurrency` and missed four: the revenue KPI (`AnalyticsKPICards.tsx:49`), both chart Y-axes (`RevenueTrendChart.tsx:73`, `SalesChart.tsx:139`) and the fixed-amount coupon value (`CouponsTable.tsx:129`). Both charts already formatted their _tooltips_ correctly — only the axis ticks were bare.

**Fixed** 2026-08-31. The axes needed a new `formatCurrencyCompact` (`src/lib/currency.ts`) — a full `EGP 1,234.00` per gridline is wider than the plot area, which is why those two survived the original sweep.

### 41. Order and payment rows written before #17 record the wrong currency

**Where** `src/db/schema.ts:336` (`orders.currency`), `:568` (`payments.currency`) — both `varchar(3) DEFAULT 'USD' NOT NULL`

**What happens** The repository now writes `STORE_CURRENCY` explicitly (`order.repository.ts:188,220`), but rows created before that fell through to the column default and say `USD`, while Stripe actually charged EGP. `site_settings.currency` has the same `USD` default.

**Impact today is nil** — nothing reads either column — but `docs/P1-TEST-PLAN.md` §9 asks you to verify them in Drizzle Studio, where old rows will read `USD` and look like a live bug.

**Fix** One backfill (`UPDATE orders SET currency = 'EGP' WHERE currency = 'USD'`, same for `payments`), and change the column defaults to match the store rather than leaving a default that is wrong for this deployment.

---

## Pass 2 — full-source audit, deferred

Found by reading the whole tree again on 2026-08-31 — every layer of `src/`, with
reference checks by grep for each "unused" claim and `diff` for each "identical"
one. **Nothing here is started, and none of it should be started before the
queue above is finished.** They carry their own `P2-n` numbering ("pass 2, item
n") so they never interleave with the 1-43 series; it is unrelated to the
"P2 — Performance" tier, which is a _kind_, not a pass.

Ten findings from that audit are **not** listed here because they were already
catalogued: the customer order detail page (#42), the confirmation email (#16),
footer dead links (#32), collection route filters (#33), category count scans
(#23), fetch-all-then-slice (#21, #25), the dashboard name N+1 (#24), unused
value objects and the unused `search()` (#26, #22), dead components and
duplicate address files (#27), unreferenced procedures (#28), and committed
build artifacts (#31). Three of those gained notes this pass — see #16, #33 and
#38.

The audit also confirmed eight areas as **sound**, which is the more useful half
of the result — the transactional core holds, and that is why every finding
below sits outside it. The two worth not re-reading the code for: order creation
locks variant rows with `FOR UPDATE` in a consistent sorted order on every path
that touches them, so concurrent checkouts cannot oversell or deadlock; and
`markAsPaid` is a conditional `UPDATE … WHERE status IN ('pending','processing')
RETURNING`, so the webhook and the success page can both call it and only the
one that actually transitions the row notifies. Also verified: the derived
refund model and its in-transaction bound check, the coupon lifecycle across
all four branches, the Stripe-before-cancel expiry sweep, ownership checks
everywhere outside P2-0, both rate limiters, and the single-source currency.

### P2-0. Notification read/delete never checks who owns the notification

**Where** `src/server/routers/public/notifications.ts:44,56`; `src/infrastructure/database/repositories/notifications/user-notifications.repository.ts:82,110`; the same shape on the admin side at `notifications.repository.ts:62,88`

**What happens** `markAsRead` and `delete` accept a notification id and pass it straight to a repository whose `WHERE` clause is `eq(userNotifications.id, id)` — the row's owner is never consulted. Any authenticated user holding another user's notification UUID can mark it read or delete it outright.

**Why** The sibling procedures on the same router scope correctly — `markAllAsRead` and `getUnreadCount` both filter on `ctx.user.id`. These two were written against the id alone and nothing forced the difference: `ctx.user.id` is in scope and simply unused.

**Impact** Bounded by needing to guess a UUID, so this is not an open door. It is still a missing authorisation check on a write path, and the admin variant lets one admin silently clear another's queue.

**Fix** Take `userId` as a second argument in both repositories and add it to an `and(...)`; pass `ctx.user.id` from all four procedures. A non-matching row then no-ops silently, which is the right behaviour — it leaks nothing about whether the id exists.

---

### P2-1. The previous account's cart survives sign-out in localStorage

**Where** `src/lib/stores/cart-store.ts:123-128`; `src/components/account/AccountSidebar.tsx:36`, `src/components/layout/MobileMenu.tsx:188`, `src/components/UserDialog.tsx:32`; `src/components/providers/cart-provider.tsx:35-50`

**What happens** The cart store persists to `localStorage` under `valkyrie-cart-v2`, with `partialize` keeping `items` — product names, images, unit prices, quantities. No sign-out path clears it. All three handlers finish with a `window.location.href` redirect, and the full page load rehydrates the store from disk before any session check has run.

So on a shared browser the next person sees the previous account's cart lines once hydration completes. The navbar badge starts at 0 — the `useSyncExternalStore` guard added for the SSR mismatch — and then fills in with someone else's items, which makes it look like their own cart rather than a leftover.

**Why** `CartProvider` calls `setItems` only when a server cart _arrives_; there is no branch for `!isAuthenticated`, so for a logged-out visitor the stale cart is never displaced. The store's guest branch is unreachable (#35), which is why nothing else covers this.

**Fix** Call `clearCart()` before each of the three redirects, and clear in `CartProvider` when `isAuthenticated` goes false. Both, not either — the redirect path is the common case and the provider is the backstop.

**While you are there** `UserDialog.tsx:35` calls `localStorage.removeItem("user")`. Nothing in the codebase writes a `"user"` key; the only other `localStorage` writer is the announcement bar's dismiss flag. That line reads exactly like the cleanup that was meant to be this one.

---

### P2-2. Dashboard revenue counts orders that were never paid, and orders that were refunded

**Where** `src/infrastructure/database/repositories/dashboard/dashboard.repository.ts:36` (`getMetrics`), `:79` (`getSalesTrend`), `:152` and `:164` (`getAnalytics`)

**What happens** All four revenue queries are `SUM(orders.total_amount)` over a date window with **no status filter at all**. A `pending` card order the customer abandoned counts. An order an admin cancelled counts. A fully refunded order counts at its original value.

Refunds never enter the figure anywhere. `order_items.refundedQuantity` is the single stored fact the whole return system derives from, and no dashboard query joins `order_items` to reach it — so the number an admin reads can include money that was taken and given back, alongside money that was never taken.

**Why** These queries predate both the refund model and the payment-window work, and nothing in the schema forces a status filter — `totalAmount` is on every order row regardless of whether it was ever collected.

**Fix** Decide once what counts as recognised revenue: which statuses, and gross or net of returns. Then apply that one definition to all four queries. `OrderEntity.refundedAmount()` already produces the net figure per order, correctly scaled for coupons, if the answer is net. Resolve together with P2-3 and P2-10, which are the same question asked in two other places.

---

### P2-3. A second, contradictory revenue definition exists and is dead

**Where** `src/infrastructure/database/repositories/orders/order.repository.ts:879`; declared at `src/domain/orders/interfaces/repositories/order.repository.interface.ts:140`

**What happens** `getTotalRevenue()` filters to `status IN ('processing', 'shipped', 'delivered')`. Measured against this codebase's own state machine that set is wrong in both directions: it **excludes `paid`**, which is precisely the status `markAsPaid` writes when Stripe confirms, so a freshly paid order contributes nothing; and it **includes `processing`**, which `ORDER_STATUS_TRANSITIONS` defines as a pre-payment state (`pending → processing → paid`).

It also has no caller anywhere outside the interface that declares it.

**Fix** Delete it, or promote it to the single definition from P2-2 and point the dashboard at it. What it must not stay is a third answer sitting in the repository looking authoritative.

---

### P2-4. Dashboard cards print invented deltas, and count all orders under a "new" label

**Where** `src/components/admin/dashboard/MetricsCards.tsx:36,42`; `src/infrastructure/database/repositories/dashboard/dashboard.repository.ts:43-47`

**What happens** Two of the four metric cards carry hardcoded sub-labels: every load renders `"+20.1% from last month"` beneath revenue and `"+180 from yesterday"` beneath orders. Nothing computes either. Sitting directly under a live figure, in the same card, in the position a real delta would occupy, they read as measurements.

The figure above the second one is mislabelled as well. The card is titled **"New Orders"**, but `getMetrics` returns `COUNT(*)` over the whole `orders` table with no date bound — while the revenue card beside it _is_ windowed to 30 days. Two cards, two different time ranges, neither stated.

**Fix** Compute the deltas or delete the strings; a card with no sub-label is honest and a card with a fabricated one is not. Then either bound the order count to the same 30 days as revenue, or retitle it "Total Orders" and label both cards with their window.

---

### P2-5. The app has no error, not-found, or loading boundaries

**Where** absent throughout `src/app`; `src/components/ui/ErrorBoundary.tsx` (59 lines, zero importers)

**What happens** There is no `error.tsx`, `global-error.tsx`, `not-found.tsx` or `loading.tsx` anywhere in the route tree. An uncaught throw in any server component drops the visitor onto Next's default error screen; a bad URL gets Next's default 404 with none of the store's chrome; and with no `loading.tsx` the server-rendered homepage sections have no streaming boundary to suspend into.

An `ErrorBoundary` component exists and is mounted nowhere.

**Why** The homepage sections and the footer each wrap their own fetch in `try`/`catch` and fall back to hardcoded defaults — a deliberate and good pattern that should be preserved. But it only covers the failures those authors anticipated, and it created the impression that failure was handled generally.

**Fix** A root `error.tsx` and `not-found.tsx` in `(main)`, styled to the storefront's dark palette rather than the token defaults (see #39 and P2-6 — this is exactly the surface that trap catches). An `error.tsx` under `admin` too, since that tree has its own theme. Mount the existing `ErrorBoundary` around the client-heavy subtrees, or delete it as part of #27 if the route-level files cover the need.

---

### P2-6. The white-pill outline button is live again, in the cart and checkout funnel

**Where** `src/components/cart/CartPopulated.tsx:60`, `src/components/checkout/CheckoutAddressSelection.tsx:79`, `src/components/checkout/CheckoutOrderSummary.tsx:52`, `src/app/(main)/checkout/success/page.tsx:114`, `src/components/cart/CartUnauthenticated.tsx:18`

**What happens** The seventh through eleventh instances of #39. `variant="outline"` resolves to `bg-background`, which on the storefront is `oklch(1 0 0)` — pure white — with `text-accent-foreground`, near-black. Without a `bg-transparent` override each renders as a white pill on the black page. The last of the five is the instructive one: `CartUnauthenticated.tsx:18` _does_ set `border-white/10` and `text-gray-300`, so it looks patched, but never overrides the background — the rule in `CLAUDE.md` says `bg-transparent` for exactly this reason.

The default variant has the mirror problem in the same flow: `bg-primary` is `oklch(0.205)`, a near-black button on a black page, at `checkout/success/page.tsx:108` and `CheckoutNoAddress.tsx:22`.

**Why** #39's root cause, untouched. Every instance is one `<Button>` written without remembering that `:root` is the light palette.

**Fix** Patch these five as an interim — `bg-transparent` plus an explicit border for outline, `bg-val-accent text-black` for primary; `RelatedProducts.tsx:27` is the correct reference. But this is the argument for doing #39 properly rather than a twelfth patch: the whole purchase funnel is now affected, and no test can see it.

---

### P2-7. Three portalled primitives still set a background with no paired foreground

**Where** `src/components/ui/sheet.tsx:61`, `drawer.tsx:59`, `menubar.tsx:17`

**What happens** The rule that fixed `AlertDialogContent` — a portalled surface must set both halves of a pair, because Radix attaches it to `<body>` where it escapes the admin's `ThemeProvider` and inherits the storefront's white text — has three remaining violations. `SheetContent`, `DrawerContent` and the menubar root each set `bg-background` alone.

**All three are currently unused**, so this is latent rather than live. It becomes live the moment anyone reaches for a sheet or a drawer, which is precisely how the previous instances arrived.

**Verified correct while checking:** `dialog`, `alert-dialog`, `popover`, `select`, `dropdown-menu`, `context-menu`, `command`, `hover-card` and `tooltip` all set both halves.

**Fix** Add `text-foreground` to all three now — three words, and it closes the class off before the next consumer arrives. Or delete them as part of P2-13, since nothing imports them.

---

### P2-8. Nested `<main>` on every storefront page

**Where** `src/app/(main)/layout.tsx:21`, `src/app/(main)/page.tsx:12`

**What happens** The layout wraps its children in `<main className="min-h-screen">`, and the homepage returns another `<main>` as its own root. Invalid HTML, and two `main` landmarks means assistive technology has no single "primary content" target on the site's front page.

**Fix** Make the inner one a fragment or a `<div>`. Worth grepping the other route files for the same shape while you are in there.

---

### P2-9. Half the cached product fetchers carry no tags, so no write can invalidate them ✅

**Where** `src/lib/cache.ts:256` (`getCachedProductsByCategory`), `:310` (`getCachedProductBySlug`), `:381` (`getCachedRelatedProducts`)

**What happens** All three pass a key array to `unstable_cache` but **no `tags`** — only `revalidate: 60`. The admin routers call `revalidateTag("all-products")` and `revalidateTag("featured-products")` after every product write, and these three never see it.

The visible symptom is an asymmetry: after an edit the product _lists_ update immediately while the product _detail page_ for the same item stays stale for up to a minute. That is the exact shape that makes an admin conclude the save failed and press it again — the failure mode `revalidateCatalogue()` was added to prevent.

**Fix** Give all three the `all-products` tag, and `getCachedProductBySlug` a per-product tag if you want precision. The comment above `revalidateCatalogue()` in `admin/products.ts` already explains why this matters; it just did not reach these three.

---

### P2-10. Customer search pages against the wrong total, and lifetime value counts cancelled orders

**Where** `src/server/routers/admin/customers.ts:60-62`, and `:39` / `:106-109`

**What happens** Two separate problems in one router.

`list` applies the search filter to the returned rows but computes `total` as an unconditional `COUNT(*)` over `user`. Search for one customer and the UI is still told there are hundreds of pages, so the pager is wrong for every search.

`totalSpent` — in the list aggregate and again in `getById` — sums `orders.totalAmount` across every order regardless of status. A customer who abandoned three checkouts and cancelled a fourth reads as a high-value account, and the admin has no way to see why.

**Fix** Move the search predicate into a shared `where` used by both the row query and the count. For `totalSpent`, apply whatever P2-2 settles on — this is the same question about the same column, and the two must not diverge.

---

### P2-11. Notification thumbnails pick the alphabetically-first image, not the primary one — still open

**Where** `src/infrastructure/database/repositories/notifications/user-notifications.repository.ts:48`

**What happens** The product-image subquery is `MIN(image_url)` grouped by product — the alphabetically first URL, not the row flagged `isPrimary`. Every other read path in the codebase does `images.find(img => img.isPrimary) ?? images[0]`.

It returns _an_ image, which is why it has never looked broken.

**Fix** Filter the subquery on `isPrimary` with a `displayOrder` fallback, matching `productImageRepository.findPrimaryByProducts()` — which already exists and does exactly this.

---

### P2-12. The marketing pages quote dollar shipping rates the checkout does not charge

**Where** `src/components/shipping/ShippingOptions.tsx:15,31,44`, `src/components/home/TrustIndicators.tsx:13`, `src/components/faq/FAQAccordion.tsx:42`; against `src/application/checkout/use-cases/create-order.use-case.ts:55-56`

**What happens** `CreateOrderUseCase` hardcodes `shippingCost = 0` and `tax = 0`, and the checkout summary correctly renders "Free". Meanwhile the shipping page advertises `$5.99` / `$14.99` / `$24.99` tiers, the homepage trust badge promises free shipping "On orders over $200", and the FAQ offers `$5` gift wrapping that checkout has no option for.

Two faults at once: the amounts contradict what the system charges, and they are denominated in dollars on a store whose entire currency layer resolves to EGP. Everything _computed_ goes through `formatCurrency` correctly after #17 and #40 — this is the hand-written copy that neither sweep looked at.

**Fix** Decide whether shipping is genuinely free. If it is, say so on all three pages and delete the tiers. If it is not, that is a real feature — `shippingCost` is already a first-class field on the order and the entity's `validateTotal()` will hold you to it — and the copy should follow the implementation rather than lead it.

---

### P2-13. Twenty-nine UI primitives and three dependencies have no consumer

**Where** `src/components/ui/`, `package.json`

**What happens** 29 of the 60 files in `src/components/ui/` are imported by nothing — roughly 3,700 lines, about 8% of the source tree. `sidebar.tsx` alone is 724 lines and `chart.tsx` is 357 (the admin charts use `recharts` directly rather than through it).

Unimported: `sidebar`, `chart`, `menubar`, `context-menu`, `field`, `carousel`, `item`, `command`, `input-group`, `navigation-menu`, `drawer`, `pagination`, `breadcrumb`, `empty`, `button-group`, `toggle-group`, `input-otp`, `alert`, `hover-card`, `tooltip`, `resizable`, `collapsible`, `checkbox`, `toggle`, `sonner`, `progress`, `aspect-ratio`, `kbd`, and `ErrorBoundary` (see P2-5).

Five dependencies exist solely to support unused primitives — `embla-carousel-react`, `cmdk`, `vaul`, `input-otp`, `react-resizable-panels` — and three more are imported by no file at all: `@stripe/react-stripe-js` and `@stripe/stripe-js` (the app uses Stripe's hosted Checkout, never the client SDK) and `bcryptjs` with its `@types` (Better Auth does its own hashing).

**Fix** Lowest-risk cleanup in the file, and it should still go last. Delete the three genuinely unimported dependencies first — they carry install weight and imply a client-side Stripe integration that does not exist. The primitives are a judgment call: they are `shadcn` scaffolding that costs nothing at runtime, and the argument for removing them is that unused surface is what a future reader mistakes for load-bearing code.

## Suggested order of work

Every P0 and all but one P1 are done — see [Resolved](#resolved). Nothing left destroys data.

**First — the two [follow-ups](#follow-ups--residue-from-the-p0p1-work).** #42 is the only place left where a customer is shown something untrue: an order number that matches nothing, and no sign a refund happened. Everything it needs is already on the entity and already returned by the sibling list endpoint, so it is one widened query and four components. #43 is smaller still.

**Then #16, the confirmation email.** The last dishonest thing in checkout. The real order number and the resolved shipping address are both on the entity already, so it is a small change waiting on a verified Resend domain.

**Then — #39, the storefront palette.** It is filed under cleanup but it behaves like a defect generator: six separate white-on-black bugs so far, each found by a person looking at a screen rather than by any test. All six are patched and the cause is not, so deciding the token story once is cheaper than the seventh fix. #41 is the last loose end of the currency work and takes minutes.

**~~Then — performance, #21-25.~~ Done 2026-08-31** — see [P2](#p2--performance-), which also swept up P2-9 and three problems found while measuring: every product card ran its own live-stock query, the footer queried the database on every page, and images bypassed the optimiser entirely.

**One action is outstanding:** `drizzle/0001_glossy_scourge.sql` adds two composite indexes and has **not been applied**. It is written to be idempotent, so `pnpm db:push` or `pnpm db:migrate` is safe on the existing pushed database. The measured gains below were achieved *without* it; the indexes are on top.

**Then the deferred decisions,** each of which is a choice before it is a fix: #29 (four CMS section types with no consumer — adopt or delete), #34 (the `worker` role), #35 (guest carts), #37 (billing addresses), and the phone-keyed `customers` table in #38.

**Cleanup last,** except #27's duplicate address components and #31's build artifacts, which take a minute each and are worth doing whenever you are next in those directories.

---

**Then, and not before — [Pass 2](#pass-2--full-source-audit-deferred).** It is held back on purpose: the queue above is nearly finished and interleaving a fresh batch is how a nearly-finished queue stops being one. Two exceptions worth pulling forward if they are cheap on the day, because both are correctness rather than polish:

- **P2-0** is a missing authorisation check on a write path — two lines per repository, no design decision, and the only thing in either list that lets one user act on another's data.
- **P2-1** shows one customer's cart contents to the next person on a shared browser, and is a `clearCart()` call in three places.

The rest genuinely can wait. Three of them do change how you would do work already queued, so read them before starting the relevant item rather than after: **P2-2/P2-3/P2-10** settle what revenue means, which the dashboard work needs; **P2-6** is five more instances of #39 and belongs in that decision rather than as its own patch; and **P2-5** wants its error and not-found pages styled for the storefront palette, which is the same decision again.
