# Known Issues

A catalogue of defects and gaps found by reading the codebase in full. Unlike the other files in `docs/`, this one describes **current state**, not plans.

Each entry gives the location, what actually happens, why, and a concrete fix.

Verified baseline, re-checked 2026-08-30 on `main`: `pnpm type-check` clean, `pnpm lint` 0 errors / 7 warnings, 67/67 tests pass. Every open issue below is a runtime or design problem, not a compile error — which is exactly why they survived.

**Contents**

- [Resolved](#resolved) (9)
- [P1 — Features that are broken or missing](#p1--features-that-are-broken-or-missing) (11)
- [P2 — Performance](#p2--performance) (5)
- [P3 — Cleanup](#p3--cleanup) (12)
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

### 10. A sale price could never be removed ✅

The edit form sent `salePrice ?? undefined`, and `undefined` correctly means "keep existing" in a partial update.

**Fixed** on both sides: the form sends `null` (`ProductEditForm.tsx:128`), and the router's update schema widened to `z.number().positive().nullable().optional()` (`products.ts:81`) so `null` survives validation and reaches the use case as "clear it".

---

Work done in the same period that this file never catalogued — partial returns with derived refund totals, the payment expiry window and stale-checkout sweep, coupon-scaled refunds, and order numbers and customer names in the admin — is documented in `docs/P0-TEST-PLAN.md` instead.

---

## P1 — Features that are broken or missing

### 9. The SKU an admin types is discarded

**Where** `src/infrastructure/database/repositories/products/product.repository.ts:125,136`

**What happens** The create-product form requires a SKU, validates it, and checks it for uniqueness — then the repository writes `sku: product.slug` instead. Renaming a product's slug later does not update the SKU, so the two silently diverge and the "SKU" column becomes an inaccurate stale copy of an old slug.

**Why** `ProductEntity` has no `sku` property at all, so the value has nowhere to travel between the use case and the repository. The uniqueness check also runs twice on different values — `CreateProductUseCase` checks the user's SKU, the repository re-checks the slug — meaning a slug collision reports a misleading `DuplicateSKUException` naming the slug.

**Fix** Add `sku` to `ProductEntity` and to `CreateProductUseCase`'s entity construction, write `sku: product.sku` in the repository, and delete the duplicate check at line 125. Also surface SKU as an editable field on the edit form (it currently cannot be changed at all).

---

### 11. No notification is ever created

**Where** `src/infrastructure/database/repositories/notifications/` (both repositories), `src/components/UserNotificationsBell.tsx`, `src/components/admin/AdminNotifications.tsx`

**What happens** Both bells always show zero. The tables, the type enums (`new_order`, `low_stock`, `order_shipped`, `price_drop`, …), the repositories, the routers and the dropdown UIs are all complete — but no code calls `create()` or `createMany()`, so there is nothing to read.

**Fix** Emit notifications from the events that already exist:

| Event                                    | Where to hook              | Notification                                                 |
| ---------------------------------------- | -------------------------- | ------------------------------------------------------------ |
| Order placed                             | `CreateOrderUseCase`       | admin `new_order`, user `order_confirmed`                    |
| Status → shipped / delivered / cancelled | `UpdateOrderStatusUseCase` | user `order_shipped` / `order_delivered` / `order_cancelled` |
| Stock crosses the low threshold          | `AdjustStockUseCase`       | admin `low_stock`                                            |
| Review submitted                         | `public.reviews.create`    | admin `new_review`                                           |
| Payment failed                           | Stripe webhook             | admin `failed_payment`                                       |

Admin notifications are per-admin-user rows, so fan out to everyone with role `admin`/`super_admin`.

---

### 12. The Featured settings tab controls nothing

**Where** `src/components/admin/settings/FeaturedSettings.tsx`, versus `src/components/home/ServerFeaturedProducts.tsx` and `ServerFeaturedCategories.tsx`

**What happens** The admin curates featured products and categories into the `featured_items` table, and the homepage ignores it entirely: `ServerFeaturedProducts` reads the `products.isFeatured` boolean via `getCachedFeaturedProducts`, and `ServerFeaturedCategories` just takes the first three active categories. The tab's "Add Product" button (`FeaturedSettings.tsx:93`) has no `onClick`, the search box filters nothing, and the "Drag items to reorder" tip describes behaviour that was never built — so the tab can only view and remove.

**Fix** Choose one source of truth.

- **Use `featured_items`:** point the homepage at `siteConfigRepo.getFeaturedItems("homepage_featured")` / `("homepage_categories")` — `public.categories.getFeatured` already shows the query shape — then implement the add and reorder handlers against the existing `addFeaturedItem` / `reorderFeaturedItems` procedures.
- **Use the boolean:** delete the Featured tab and the `featured_items` table, and manage featuring from the product edit page's existing `isFeatured` switch.

The second is less work and less machinery; the first is what the schema and admin UI were designed for.

---

### 13. There is no way to manage categories

**Where** `src/app/admin/` (no `categories/` route), `src/server/routers/admin/categories.ts`

**What happens** Categories can only be created by the seed script. The admin UI calls `admin.categories.list` solely to populate the product dropdown. `create` and `delete` have no UI, and `UpdateCategoryUseCase` is fully written, wired into the container, and reachable from nothing — categories cannot be renamed, reordered, given an image, or deactivated.

**Fix** Add `/admin/categories` with a table plus create/edit dialogs, and expose `update` on the router (the use case is ready). Two things to fix while doing it:

- `UpdateCategoryUseCase:60-64` generates slugs with `name.toLowerCase().replace(/\s+/g, "-")`, which leaves punctuation intact, unlike `CategorySlug.fromName()`. Use the value object in both places.
- Category delete is a **hard** delete (`category.repository.ts:115`) while products soft-delete. `categories.parentId` has no FK constraint, so deleting a parent orphans its children — they keep pointing at a missing id. Add the self-referencing FK, or block deletion of categories that have children or products.

---

### 14. `/forgot-password` does not exist

**Where** `src/app/(auth)/forgot-password/` is an empty directory; linked from `src/components/auth/login/LoginForm.tsx:127` and `src/components/account/profile/ProfilePasswordCard.tsx:12`

**What happens** Both the login page's "Forgot password?" link and the profile page's "Change Password" button lead to a 404. There is no password recovery in the product.

**Why** The backend half is done — `src/lib/auth.ts` configures `sendResetPassword` and `ResendEmailService.sendPasswordResetEmail` builds the email. Only the pages are missing.

**Fix** Add two pages: a request form calling `authClient.forgetPassword({ email, redirectTo: "/reset-password" })`, and `/reset-password` reading the `token` query param and calling `authClient.resetPassword`. Rate-limit the request endpoint with the existing `passwordResetRateLimiter` (`src/server/utils/rate-limiter.ts:49`), which is defined and currently unused.

---

### 15. One of the two stock-editing paths skips the audit log

**Where** `src/server/routers/admin/variants.ts:78-105` (`update`) versus `src/server/routers/admin/inventory.ts:60-88` (`adjustStock`)

**What happens** Editing a variant's stock from the product page writes the new quantity directly and records nothing. Editing it from the Inventory page writes an `inventory_logs` row. The history is therefore silently incomplete, and the two paths can't be reconciled.

**Fix** Route all stock writes through `AdjustStockUseCase`. Have `admin.variants.update` reject or split out `stockQuantity`, so variant metadata (SKU, size, colour, availability) and stock are changed by different, clearly-named operations. `admin.variants.updateStock` — which has no caller — should be deleted or re-pointed at the same use case.

---

### 16. The confirmation email quotes a made-up order number

**Where** `src/app/api/webhook/stripe/route.ts:93,104`

**What happens** The Stripe order-confirmation email shows an order number derived from the Stripe session id (`session.id.slice(-12).toUpperCase()`), which matches nothing the customer can look up, and prints the literal string "Address will be confirmed separately" in place of the shipping address. COD orders get no confirmation email at all.

**Why** The handler builds the email from the Stripe session rather than from the order it just updated — even though `metadata.orderId` is right there.

**Fix** Load the order by `metadata.orderId` and send the real `orderNumber`, real line items, and formatted address. Both halves are already on the entity — `orderNumber` is read back on every load and `shippingAddress` is a resolved `OrderAddress`, not an id — so this is now a matter of using them. Move the send into a small `SendOrderConfirmation` helper and call it from the COD path too, so both payment methods behave the same.

---

### 17. Currency is inconsistent in four places

**Where** `src/infrastructure/services/stripe.service.ts:99` (`"egp"`), `src/infrastructure/database/repositories/orders/order.repository.ts:91,122` (`"EGP"`), `site_settings.currency` (defaults `USD`), and every price in the UI (hardcoded `$`).

**What happens** Orders are stored and charged in Egyptian pounds while the entire storefront and admin render the amounts with a dollar sign. The admin's currency selector (`StoreSettings.tsx:32-39`, which offers EGP) has no effect on anything.

**Fix** Make `site_settings.currency` authoritative: read it where the Stripe session is built and where orders are inserted, and add a shared `formatCurrency(amount, currency, locale)` helper used by every price display. There are roughly 40 hardcoded `$` template strings to replace — grep for `` `$${ `` and `.toFixed(2)`.

---

### 18. Wishlist stock status is not stock

**Where** `src/infrastructure/database/repositories/wishlist/wishlist.repository.ts:63`

**What happens** `WishlistItemEntity.inStock` is populated from `products.isActive`, so a sold-out product shows as in stock and "Move to cart" is offered for items that cannot be bought.

**Fix** Join `product_variants` and aggregate: `SUM(stock_quantity) > 0`, matching how `ProductEntity.stock` is derived in `product.repository.ts:324-326`.

---

### 19. Reviews are never marked as verified purchases

**Where** `src/server/routers/public/reviews.ts:68`

**What happens** `isVerifiedPurchase` is hardcoded `false`, so the badge never appears, and `reviews.orderId` is always null.

**Fix** Before inserting, look for a delivered or paid order by this user containing this product; if found, set `isVerifiedPurchase: true` and store the `orderId`. Consider only accepting reviews from verified purchasers, which also removes most spam and would let you auto-approve them.

---

### 20. A failed image or variant save leaves a half-created product

**Where** `src/components/admin/products/CreateProductForm.tsx:56-84`

**What happens** After the product is created, images and variants are saved one at a time in a client-side loop, each in its own `try/catch` that only shows a toast. If one fails, the product still exists, the redirect still happens, and the admin gets a transient error for an item that is now missing — with no indication of which one.

**Fix** Accept `images` and `variants` as arrays on `admin.products.create` and persist all three in a single server-side transaction, so the product either fully exists or does not.

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

**What happens** Both call `productRepo.findAll()` **inside** a per-category loop — the homepage does it three times, `public.categories.list` once per category — each time loading every product with its variants and images, just to count matches.

**Fix** One grouped query: `SELECT category_id, COUNT(*) FROM products WHERE is_active GROUP BY category_id`. Add a `countByCategory()` to the product repository.

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

No caller anywhere: the entire `public.config` router, `public.categories.{list,getFeatured}`, `public.products.{getBySlug,getFeatured}`, `admin.categories.{create,delete}`, `admin.products.getBySlug`, `admin.variants.updateStock`, `admin.notifications.clearAll`, and `admin.settings.{getAllContentSections,getContentHistory,revertToVersion,addFeaturedItem,updateFeaturedItems,reorderFeaturedItems}`.

Most are collateral from the homepage moving to server components. Some are worth wiring rather than deleting — see #12 and #29.

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

### 36. Seven lint warnings

Unused imports in `src/app/admin/products/page.tsx` (`Plus`, `Button`), unused `_paymentIntent` bindings in the Stripe webhook, an unused `error` in `NewsletterSection` (which also swallows the real error), an unused `_width` in `product-image.entity.ts`, and an unused `protectedProcedure` import in `public/user.ts`.

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

## Suggested order of work

The whole P0 cluster is done — see [Resolved](#resolved). Everything left is P1 or below, and nothing left destroys data.

**First — finish the order pipeline.** #16 (confirmation email) is the last dishonest thing in checkout and it just got cheap: the real order number and the resolved shipping address are both on the entity already. #9 (SKU) and #15 (stock audit bypass) close the two remaining places where a write lands somewhere other than where the admin thinks it did.

**Then — the missing pages.** #14 (`/forgot-password`) is two pages over a backend that is already written, and it is linked from two live buttons, so every visitor who clicks either gets a 404. #13 (categories) is the largest admin gap.

**Then — the half-features.** #11 (notifications), #19 (verified reviews), #18 (wishlist stock), #20 (transactional product create). #12 is a decision before it is a fix: adopt `featured_items` or delete it in favour of the `isFeatured` boolean, but stop maintaining both.

**#17 (currency) when there is appetite.** It is the largest single change in this file — roughly 40 hardcoded `$` sites — and it stays cosmetic until the store charges in more than one currency.

**Then — performance,** #21-25, mostly mechanical once the repositories accept limit and offset. Do #21 first: the admin orders list still loads every order and slices in the use case, and the customer join layered on top of it inherits that shape.

**Cleanup last,** except #27's duplicate address components and #31's build artifacts, which take a minute each and are worth doing whenever you are next in those directories.
