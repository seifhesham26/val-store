# Known Issues

A catalogue of defects and gaps found by reading the codebase in full. Unlike the other files in `docs/`, this one describes **current state**, not plans.

Each entry gives the location, what actually happens, why, and a concrete fix.

Verified baseline when this was written: `pnpm type-check` clean, `pnpm lint` 0 errors / 7 warnings, 33/33 tests pass. Every issue below is a runtime or design problem, not a compile error — which is exactly why they survived.

**Contents**

- [P0 — Data loss and broken core flows](#p0--data-loss-and-broken-core-flows) (7)
- [P1 — Features that are broken or missing](#p1--features-that-are-broken-or-missing) (13)
- [P2 — Performance](#p2--performance) (5)
- [P3 — Cleanup](#p3--cleanup) (12)
- [Suggested order of work](#suggested-order-of-work)

---

## P0 — Data loss and broken core flows

### 1. Editing a product silently wipes its detail fields

**Where** `src/application/products/use-cases/update-product.use-case.ts:50-66`

**What happens** Every save from the admin product edit page sets `gender`, `material`, `careInstructions`, `metaTitle`, and `metaDescription` to `NULL`. The data is gone with no warning. On the storefront this empties the "Details" list on the product page (`transformProductForDetail` builds it from `careInstructions`/`material`) and removes the product from `/collections/men` and `/collections/women`, which filter on `gender`.

**Why** `ProductEntity`'s constructor takes 18 parameters; the last five (`product.entity.ts:27-31`) default to `null`. `UpdateProductUseCase` passes only 13, ending at `new Date()`. `DrizzleProductRepository.update()` (`product.repository.ts:157-180`) then writes all five columns from that entity. The fields are also absent from `createProductSchema` (used by the router as `.partial()`) and from `ProductEditForm`, so they can never be set back through the UI.

**Fix**

1. Preserve them in the use case:

   ```ts
   const updatedProduct = new ProductEntity(
     // ...existing 13 args...
     existingProduct.createdAt,
     new Date(),
     input.data.gender ?? existingProduct.gender,
     input.data.material ?? existingProduct.material,
     input.data.careInstructions ?? existingProduct.careInstructions,
     input.data.metaTitle ?? existingProduct.metaTitle,
     input.data.metaDescription ?? existingProduct.metaDescription
   );
   ```

2. Add the five fields to `createProductSchema` (`src/components/admin/products/create/schema.ts`) and to the router's update input (`src/server/routers/admin/products.ts`).
3. Wire them into `ProductEditForm`. `ProductSidebar` and `AdditionalDetailsSection` (both unused — see #30) already contain exactly these inputs as unwired mockups; salvage or delete them.

**Prevent the recurrence** A positional 18-arg constructor makes this class of bug invisible to the type checker. Either give `ProductEntity` an object-shaped constructor, or have the repository accept a partial patch (`Partial<NewProduct>`) instead of a whole entity, so unspecified columns are simply not written.

---

### 2. The admin order status dropdown offers an invalid status and omits a valid one

**Where** `src/components/admin/orders/detail/UpdateStatusCard.tsx:19-27` and `src/server/routers/admin/orders.ts:26-35`

**What happens** The dropdown lists `confirmed`, which is in neither the `order_status` Postgres enum nor `OrderStatus`. Selecting it throws `Invalid order status: confirmed` from `OrderStatus.create()`. Meanwhile `paid` — a real status the Stripe webhook sets — is missing from the list, so an admin can never move an order into it manually.

**Why** The dropdown and the router's Zod enum were written from a different status vocabulary than the domain. `OrdersTable` (`src/components/admin/orders/list/OrdersTable.tsx:18-25`) already has the correct seven, so the three lists have drifted apart.

**Fix** Export the canonical list once and consume it everywhere:

```ts
// src/domain/orders/value-objects/order-status.value-object.ts
export const ORDER_STATUSES = [
  "pending",
  "processing",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const satisfies readonly OrderStatusValue[];
```

Then use `z.enum(ORDER_STATUSES)` in the router and `ORDER_STATUSES` in `UpdateStatusCard` and `OrdersTable`.

**Worth doing at the same time** `OrderStatus.canTransitionTo()` already encodes the legal state machine. Expose it so the dropdown only renders reachable statuses, instead of letting an admin pick one that throws (e.g. `pending → delivered`).

---

### 3. The admin order detail shows a UUID where the shipping address should be

**Where** `src/infrastructure/database/repositories/orders/order.repository.ts:332-333`, rendered by `src/components/admin/orders/detail/AddressesCard.tsx:17,31`

**What happens** The Shipping Address and Billing Address cards on `/admin/orders/[id]` display a raw address UUID. There is no way to see where an order should actually ship, which blocks fulfilment.

**Why** `OrderEntity.shippingAddress` is typed `string` and used for two different things: on write, `create()` (`order.repository.ts:92-93`) stores it into the `shipping_address_id` column; on read, `mapToEntity` puts the id straight back into the same field. Nothing ever resolves the id to an address row.

**Fix** The `orders → addresses` relations already exist in `src/db/relations.ts:120-127`, so the join is one line:

```ts
const order = await db.query.orders.findFirst({
  where: eq(orders.id, orderId),
  with: { items: true, shippingAddress: true, billingAddress: true },
});
```

Then either format the joined row into a multi-line string (`AddressesCard` already uses `whitespace-pre-line`, so this works with no UI change), or — better — split the entity's single field into `shippingAddressId: string` plus `shippingAddress: Address | null` and update `GetOrderOutput` and the card to render the structured value. The second option removes the id/text overloading that caused the bug.

---

### 4. Store and Appearance settings refuse to save when any field is blank

**Where** `src/components/admin/settings/StoreSettings.tsx:91`, `src/components/admin/settings/AppearanceSettings.tsx:80`, schema at `src/server/routers/admin/settings/site-settings.ts:12-19`

**What happens** Both settings tabs fail with a Zod validation error unless every URL and email field is filled with a valid value. A fresh install cannot save the Store tab at all, because `contactEmail` starts empty.

**Why** Both components hold their form state as strings initialised to `""` and POST the whole object with `updateSettings.mutateAsync(form)`. The schema validates those fields with `.url()` / `.email()`, which reject `""`. The fields are `.nullable().optional()`, so `null` or omission would be accepted — but the form never sends either.

**Fix** Normalise empty strings to `null` at the schema boundary so it holds for every caller:

```ts
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? null : v), schema.nullable().optional());

export const updateSiteSettingsSchema = z.object({
  logoUrl: emptyToNull(z.string().url()),
  contactEmail: emptyToNull(z.string().email()),
  // ...same for faviconUrl and the four social URLs
});
```

---

### 5. `pnpm db:migrate` would build the wrong database

**Where** `drizzle/0000_*.sql`, `0001_*.sql`, `0002_*.sql`, `drizzle/meta/_journal.json`

**What happens** The migration chain does not describe this application. It creates a uuid-keyed `users` table and a `password_reset_tokens` table, neither of which exists in `src/db/schema.ts` any more, and contains **none** of the ~20 business tables (products, orders, cart, reviews, coupons, CMS, newsletter). `0002` also re-creates the auth tables `0000` already created, so the chain cannot run cleanly on an empty database regardless.

**Why** The migrations date from mid-December 2025, before the app schema was written. Development moved to `pnpm db:push` and the migration folder was never regenerated.

**Fix** Pick one and make it true:

- **Staying on push (simplest, matches the README):** delete `drizzle/` and drop `db:generate`/`db:migrate` from `package.json` so nobody runs them by accident.
- **Adopting migrations (needed before a real deploy):** delete `drizzle/`, run `pnpm db:generate` against the current schema to produce a single baseline migration, and — if a populated database already exists — mark that baseline as applied rather than running it.

---

### 6. Buying something never reduces stock

**Where** `src/application/checkout/use-cases/create-order.use-case.ts`, `src/app/api/webhook/stripe/route.ts`

**What happens** Stock is only ever changed by an admin editing it. A variant with 1 unit can be ordered any number of times, and `inventory_logs` never records a sale, so the movement history is incomplete.

**Why** No code path decrements `product_variants.stockQuantity` on order creation or payment. The `sale` value in `inventory_change_type` is defined and never written.

**Fix** Decrement inside the existing order-creation transaction in `DrizzleOrderRepository.create()`, so stock and order rows commit together:

```ts
await tx
  .update(productVariants)
  .set({
    stockQuantity: sql`GREATEST(0, ${productVariants.stockQuantity} - ${item.quantity})`,
  })
  .where(eq(productVariants.id, item.variantId));

await tx.insert(inventoryLogs).values({
  variantId: item.variantId,
  changeType: "sale",
  quantityChange: -item.quantity,
  previousQuantity: before,
  newQuantity: before - item.quantity,
  reason: `Order ${orderNumber}`,
});
```

Decide deliberately whether COD orders reserve stock at creation (recommended) or only on delivery, and restore stock when an order moves to `cancelled` or `refunded`.

> **Blocked by #8** — order items currently carry no `variantId`, so there is nothing to decrement. Fix that first.

---

### 7. Coupons are validated, displayed, and then thrown away

**Where** `src/components/checkout/CheckoutForm.tsx`, `src/application/checkout/use-cases/create-order.use-case.ts`, `src/infrastructure/database/repositories/orders/order.repository.ts:89`

**What happens** A customer applies a coupon, sees the discount in the summary, and is charged the full price. `orders.discountAmount` is always `"0"`, `coupon_usages` is never written, and `coupons.usageCount` never increments — so per-user and global usage limits never take effect either.

**Why** `validateCoupon` is a standalone mutation whose result lives only in React state. Neither checkout mutation accepts a coupon, and `CreateOrderUseCase` has no coupon parameter.

**Fix**

1. Add `couponCode?: string` to the inputs of `checkout.createSession` and `checkout.createCodOrder`.
2. In `CreateOrderUseCase`, **re-run `ValidateCouponUseCase` server-side** and compute the discount from the result. Never accept a discount amount from the client.
3. Persist `discountAmount`, insert a `coupon_usages` row, and increment `coupons.usageCount` inside the same transaction as the order.
4. Apply the discount to the Stripe session — either via a Stripe coupon on the session, or by reducing line-item amounts — otherwise the customer is still charged full price.

---

## P1 — Features that are broken or missing

### 8. The cart discards the selected size and colour

**Where** `src/infrastructure/database/repositories/cart/cart.repository.ts:137`

**What happens** `variantId` is hardcoded `null` on insert, so the size and colour the customer picked (on the product page or via the Quick Add wheels) never reach the database. Consequences cascade:

- `maxStock` resolves from the null variant to `0` (`cart.repository.ts:229`), so the stock ceiling in `UpdateCartItemUseCase` is meaningless and `canIncrease()` is always false.
- `order_items.variantId` is likewise `null` (`order.repository.ts:103`), so orders don't record which variant was bought — blocking #6 and leaving fulfilment guessing.
- `addItem` merges by `productId` alone, so adding size M and then size L produces one row of quantity 2.

**Fix** Thread `variantId` through the whole path: `cart.add` input → `AddToCartUseCase` → `CartItemEntity` → the insert; make `findByUserAndProduct` match on `(userId, productId, variantId)`; read `maxStock` from the joined variant; and carry `variantId` into `orderItems` in `DrizzleOrderRepository.create`. On the client, `useCart().addItem` and both call sites (`ProductDetail`, `QuickAddSliderBar`) need to pass the resolved variant.

---

### 9. The SKU an admin types is discarded

**Where** `src/infrastructure/database/repositories/products/product.repository.ts:125,136`

**What happens** The create-product form requires a SKU, validates it, and checks it for uniqueness — then the repository writes `sku: product.slug` instead. Renaming a product's slug later does not update the SKU, so the two silently diverge and the "SKU" column becomes an inaccurate stale copy of an old slug.

**Why** `ProductEntity` has no `sku` property at all, so the value has nowhere to travel between the use case and the repository. The uniqueness check also runs twice on different values — `CreateProductUseCase` checks the user's SKU, the repository re-checks the slug — meaning a slug collision reports a misleading `DuplicateSKUException` naming the slug.

**Fix** Add `sku` to `ProductEntity` and to `CreateProductUseCase`'s entity construction, write `sku: product.sku` in the repository, and delete the duplicate check at line 125. Also surface SKU as an editable field on the edit form (it currently cannot be changed at all).

---

### 10. A sale price can never be removed

**Where** `src/components/admin/products/ProductEditForm.tsx:111`

**What happens** Clearing the sale price field and saving leaves the old sale price in place, so a product stays discounted forever.

**Why** The form sends `salePrice: values.salePrice ?? undefined`, and `UpdateProductUseCase:56-58` treats `undefined` as "keep existing" — correctly, since that is how partial updates work. `null` is the value that means "clear", and the form converts it away.

**Fix** Send `null` rather than `undefined`, and widen the router's schema field to `z.number().positive().nullable().optional()`.

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

**Fix** Load the order by `metadata.orderId` (with items and shipping address) and send the real `orderNumber`, real line items, and formatted address. Move the send into a small `SendOrderConfirmation` helper and call it from the COD path too, so both payment methods behave the same.

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

- `ProductSidebar` and `AdditionalDetailsSection` — mockups with dead buttons and unwired inputs for exactly the fields lost in issue #1.
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
- The contact form is a placeholder (`ContactFormPlaceholder.tsx`) and the admin orders list has a filter button that only toasts "coming soon" (`OrdersListHeader.tsx:30`).
- `src/domain/customers/entities/customer.entity.ts` and the phone-keyed `customers` table are written by the signup hook and read by nothing; `GetOrCreateCustomerUseCase` has no callers. Decide whether the phone-identity model is still wanted before building on it.

---

## Suggested order of work

**First — stop the bleeding.** #1 (product update wipes fields) and #5 (migration folder) are the two that can destroy data. Both are small.

**Then — make the order pipeline honest.** #8 (cart variants) unblocks #6 (stock), and #7 (coupons), #3 (addresses), #16 (emails), and #2 (status dropdown) together turn checkout from a demo into something that could take a real order. This is the largest cluster and the one worth the most.

**Then — close the admin gaps.** #13 (categories), #4 (settings saving), #15 (stock audit), #12 (decide on featured), #11 (notifications).

**Then — performance,** #21-25, which is mostly mechanical once the repositories accept offsets.

**Cleanup last,** except #27's duplicate address components and #31's build artifacts, which take a minute each and are worth doing whenever you are next in those directories.
