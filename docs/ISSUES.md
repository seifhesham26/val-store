# Known Issues

A catalogue of defects and gaps found by reading the codebase in full. Unlike the other files in `docs/`, this one describes **current state**, not plans.

Each entry gives the location, what actually happens, why, and a concrete fix.

Verified baseline, re-checked 2026-08-31 on `fix-p1`: `pnpm type-check` clean, `pnpm lint` 0 errors / 5 warnings, 80/80 tests pass. Every open issue below is a runtime or design problem, not a compile error — which is exactly why they survived.

**Contents**

- [Resolved](#resolved) (19)
- [Follow-ups — residue from the P0/P1 work](#follow-ups--residue-from-the-p0p1-work) (2)
- [P1 — Features that are broken or missing](#p1--features-that-are-broken-or-missing) (1)
- [P2 — Performance](#p2--performance) (5)
- [P3 — Cleanup](#p3--cleanup) (15)
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

---

## P2 — Performance

### 21. Product and order lists fetch every row, then slice

**Where** `src/application/products/use-cases/list-products.use-case.ts:63`, `src/application/orders/use-cases/list-orders.use-case.ts:59`, `src/server/routers/public/products.ts:60,231`

**What happens** Every page of every list loads the entire filtered table into memory and discards all but 10–12 rows. Cost grows linearly with catalogue size on every request; the comments (`"slice for now"`) acknowledge it.

**Fix** `ProductFilters` already supports `limit` (`product.repository.ts:69`). Add `offset`, push both into the query, and use the existing `count()` methods for the total instead of `array.length`.

### 22. Search re-implements in JavaScript what the repository already does in SQL

**Where** `src/server/routers/public/products.ts:216-222`, versus the unused `DrizzleProductRepository.search()` at `product.repository.ts:102-116`

**What happens** `public.products.search` loads all active products and filters them with `String.includes`. A correct `ILIKE` implementation exists in the repository and is never called. The gender and on-sale filters at lines 44-51 are also applied in JS after the fetch.

**Fix** Call `repo.search(query)` with DB-level pagination, and move `gender` / `isOnSale` into `buildFiltersConditions` (`product.repository.ts:270`).

### 23. Category product counts issue one full table scan per category

**Where** `src/components/home/ServerFeaturedCategories.tsx:85`, `src/server/routers/public/categories.ts:18-38`

**Half fixed.** The homepage half is done: `ServerFeaturedCategories` now reads `getCachedFeaturedCategories`, and the category repository gained `countProductsByCategory({ activeOnly })` — one grouped query for the whole list, used by the admin Categories page.

**Still true** `public/categories.ts:18-25` still calls `productRepo.findAll()` **inside** a per-category `map`, loading every product with its variants and images just to count matches. `public.products.getFeatured` (`:100-105`) does the same inside its own loop.

**Fix** Point both at the existing `countProductsByCategory`, or add a `countByCategory()` to the product repository. Note `public.categories.list` has no caller at all (#28), so deleting it is also a valid answer.

### 24. The dashboard fetches customer names one query at a time

**Where** `src/infrastructure/database/repositories/dashboard/dashboard.repository.ts:116-133`

**What happens** `getRecentOrders` runs a separate `SELECT name FROM user` per order.

**Fix** `leftJoin(user, eq(orders.userId, user.id))` in the original query. Worth adding the missing `orders → user` relation in `src/db/relations.ts` while you are there — its absence is why several places hand-roll this join.

### 25. "My orders" loads 1000 orders per page request

**Where** `src/server/routers/public/orders.ts:37`

**What happens** `getMyOrders` calls `findRecentByUserId(userId, 1000)` and slices to 10, on every infinite-scroll page.

**Fix** Same as #21 — push limit/offset into the query and count separately.

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

- `NEXT_PUBLIC_APP_NAME` is read by `ResendEmailService` but appears in neither `.env` nor `.env.example`; it silently falls back to "Valkyrie". Add it to `.env.example`.
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

## Suggested order of work

Every P0 and all but one P1 are done — see [Resolved](#resolved). Nothing left destroys data.

**First — the two [follow-ups](#follow-ups--residue-from-the-p0p1-work).** #42 is the only place left where a customer is shown something untrue: an order number that matches nothing, and no sign a refund happened. Everything it needs is already on the entity and already returned by the sibling list endpoint, so it is one widened query and four components. #43 is smaller still.

**Then #16, the confirmation email.** The last dishonest thing in checkout. The real order number and the resolved shipping address are both on the entity already, so it is a small change waiting on a verified Resend domain.

**Then — #39, the storefront palette.** It is filed under cleanup but it behaves like a defect generator: six separate white-on-black bugs so far, each found by a person looking at a screen rather than by any test. All six are patched and the cause is not, so deciding the token story once is cheaper than the seventh fix. #41 is the last loose end of the currency work and takes minutes.

**Then — performance,** #21-25, mostly mechanical once the repositories accept limit and offset. Do #21 first: the admin orders list still loads every order and slices in the use case, and the customer join layered on top of it inherits that shape. #25 is the same shape on the customer side — `getMyOrders` still fetches 1000 rows per infinite-scroll page, and now runs the expired-checkout sweep before it.

**Then the deferred decisions,** each of which is a choice before it is a fix: #29 (four CMS section types with no consumer — adopt or delete), #34 (the `worker` role), #35 (guest carts), #37 (billing addresses), and the phone-keyed `customers` table in #38.

**Cleanup last,** except #27's duplicate address components and #31's build artifacts, which take a minute each and are worth doing whenever you are next in those directories.
