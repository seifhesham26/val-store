# 🔗 Cross-Domain Connections Map

> **Purpose:** When working on any single domain, you may discover that it touches another domain. This file documents every known cross-domain boundary — the exact files, the data types flowing across, and what each side expects.
>
> **How to use:** If during a domain chat you find a connection listed here, do NOT fix the other domain's side. Instead, note it and handle it in a dedicated "Connection X" chat session after both individual domains are clean. If you discover a NEW connection not listed here, add it to this file.

---

## Connection 1: Auth → Everything (Session Context)

**What crosses:** Every protected tRPC route receives the authenticated user via `ctx.user`.

### Source (Auth provides)

| File                                                 | What it provides                              |
| ---------------------------------------------------- | --------------------------------------------- |
| `src/server/trpc.ts` → `createContext()`             | Builds `TRPCContext` from Better Auth session |
| `src/server/utils/auth-helpers.ts` → `AuthUser` type | The user shape available in context           |

### Data Type

```typescript
// src/server/utils/auth-helpers.ts
interface AuthUser {
  id: string; // Better Auth user ID (text, not UUID)
  email: string;
  name: string | null;
  role: "customer" | "worker" | "admin" | "super_admin";
}

// src/server/trpc.ts
interface TRPCContext {
  user: AuthUser | null;
}
```

### Consumers (every protectedProcedure/adminProcedure)

| File                              | How it uses `ctx.user`                                        |
| --------------------------------- | ------------------------------------------------------------- |
| `routers/public/cart.ts`          | `ctx.user.id` — identifies cart owner                         |
| `routers/public/checkout.ts`      | `ctx.user.id` + `ctx.user.email` — creates Stripe session     |
| `routers/public/orders.ts`        | `ctx.user.id` — filters orders to owner                       |
| `routers/public/wishlist.ts`      | `ctx.user.id` — identifies wishlist owner                     |
| `routers/public/address.ts`       | `ctx.user.id` — identifies address owner                      |
| `routers/public/reviews.ts`       | `ctx.user.id` — identifies review author                      |
| `routers/public/notifications.ts` | `ctx.user.id` — identifies notification recipient             |
| `routers/admin/*` (all 12 files)  | `ctx.user` — verified as admin by `adminProcedure` middleware |

### Frontend consumers

| File                                     | How it uses auth                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `components/layout/Navbar.tsx`           | `trpc.public.user.getSession.useQuery()` → shows user icon, admin link, wishlist count |
| `components/providers/cart-provider.tsx` | `useSession()` from `auth-client` → decides if cart syncs to server                    |
| `components/products/WishlistButton.tsx` | Checks auth before wishlist operations                                                 |

### ⚠️ Watch out for

- `user.id` is `text` type (Better Auth default), NOT `uuid`. All FK references to `user.id` use `text()` in schema.
- The `role` field comes from `user_profiles` table, NOT the Better Auth `user` table. It's fetched separately in `createContext()`.

---

## Connection 2: Products → Cart (Add to Cart Flow)

**What crosses:** Product data flows into cart items when a user adds to cart.

### Source (Products provide)

| File                                         | What it provides                                          |
| -------------------------------------------- | --------------------------------------------------------- |
| `routers/public/products.ts` → `getBySlug`   | Full product detail with variants                         |
| `lib/cache.ts` → `getCachedFeaturedProducts` | Product cards for homepage                                |
| `components/products/ProductCard.tsx`        | Renders products, passes `productId` to QuickAddSliderBar |

### Data type flowing across

```typescript
// What ProductCard passes to QuickAddSliderBar (cart entry point)
interface QuickAddVariant {
  id: string; // variant UUID
  size: string | null;
  color: string | null;
  inStock: boolean;
}
// QuickAddSliderBar calls: trpc.public.cart.add.mutate({ productId, quantity })

// What cart.add expects (input)
z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
});
```

### Consumer (Cart receives)

| File                                                 | What it receives                                           |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| `routers/public/cart.ts` → `add`                     | `{ productId: string, quantity: number }`                  |
| `application/cart/use-cases/add-to-cart.use-case.ts` | Looks up product + variant in DB to get name, price, image |

### ⚠️ Watch out for

- Cart `add` mutation takes `productId` only (no `variantId`). The use case must determine which variant to use.
- Product prices are `decimal(10,2)` in DB but `number` in frontend. Conversion happens in the use case.

---

## Connection 3: Cart → Checkout → Orders (Purchase Flow)

**What crosses:** Cart items become a Stripe session, then become an order with order items.

### Flow

```
CartItems (DB) → CreateCheckoutSessionUseCase → Stripe Session → Webhook → Order + OrderItems (DB)
                                               ↘ CreateOrderUseCase (also used for COD) ↗
```

### Key files and their interfaces

**Step 1: Cart → Checkout**
| File | Interface |
|------|-----------|
| `routers/public/checkout.ts` → `createSession` | Input: `{ shippingAddressId: string }` + `ctx.user` |
| `application/checkout/use-cases/create-checkout-session.use-case.ts` | Receives `{ userId, email, shippingAddressId }` |

```typescript
// CreateCheckoutSessionInput
interface CreateCheckoutSessionInput {
  userId: string;
  email: string;
  shippingAddressId: string;
}
// Output
interface CreateCheckoutSessionOutput {
  sessionId: string; // Stripe session ID
  url: string; // Stripe checkout URL to redirect to
}
```

**Step 2: Checkout → Order**
| File | Interface |
|------|-----------|
| `application/checkout/use-cases/create-order.use-case.ts` | Creates order from cart items |
| Depends on: `CartRepositoryInterface.findByUserId()` | Gets cart items with product data |
| Depends on: `OrderRepositoryInterface.create()` | Inserts order + order items |

**Step 3: Stripe Webhook → Payment confirmation**
| File | Interface |
|------|-----------|
| `app/api/webhook/stripe/route.ts` | Receives Stripe `checkout.session.completed` event |
| Updates: `orders` table → status to `"paid"` | |
| Updates: `payments` table → status to `"completed"` | |

### DI Container wiring

```typescript
// src/application/container.ts
const checkout = createCheckoutModule({
  getOrderRepository: orders.getOrderRepository, // from orders domain
  getCartRepository: cart.getCartRepository, // from cart domain
});
```

### ⚠️ Watch out for

- `CreateCheckoutSessionUseCase` directly queries `db` for `payments` table (line 74-83) — bypasses repository pattern
- Cart items are deleted after order creation (inside `CreateOrderUseCase`)
- The `orders.ts` public router also has `getOrderNumberByStripeSession` which joins `payments` and `orders` tables directly with `db` instead of repository

---

## Connection 4: Products ↔ Wishlist ↔ Navbar

**What crosses:** Wishlist status per product, and total wishlist count in navbar.

### Files

| File                                     | Role                                | Data                                                                          |
| ---------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| `components/products/WishlistButton.tsx` | Checks/toggles wishlist per product | `trpc.public.wishlist.checkStatus({ productId })` → `{ inWishlist: boolean }` |
| `components/products/ProductCard.tsx`    | Renders WishlistButton inside card  | Passes `productId: string`                                                    |
| `components/layout/Navbar.tsx`           | Shows wishlist count badge          | `trpc.public.wishlist.getCount` → `{ count: number }`                         |

### ⚠️ Watch out for

- `getCount` fetches ALL wishlist items then returns `.length` — should use `COUNT(*)` in DB
- WishlistButton lives in `components/products/` but is a wishlist concern

---

## Connection 5: Orders ↔ Reviews (Verified Purchase)

**What crosses:** To mark a review as "verified purchase", the review system needs to check if the user bought the product.

### Current state: ❌ NOT CONNECTED

```typescript
// src/server/routers/public/reviews.ts line 68
isVerifiedPurchase: false, // TODO: Check if user purchased
```

### What SHOULD happen

| Step | File                             | Query needed                                                                                                                                    |
| ---- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `reviews.ts` → `create` mutation | Before creating review, check `orderItems` table                                                                                                |
| 2    | Query                            | `SELECT 1 FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered' LIMIT 1` |
| 3    | Set                              | `isVerifiedPurchase: true` if row found                                                                                                         |

### Tables involved

- `orders` → `userId`, `status` (must be `"delivered"`)
- `orderItems` → `orderId`, `productId`
- `reviews` → `isVerifiedPurchase`

---

## Connection 6: CMS/Settings → Layout → Homepage

**What crosses:** Site settings and content sections drive the storefront appearance.

### Data flow

```
DB (site_settings, content_sections) → cache.ts → Server Components → Client Components
```

### Files

| File                                              | Reads from                                   | Provides to                       |
| ------------------------------------------------- | -------------------------------------------- | --------------------------------- |
| `lib/cache.ts` → `getCachedSiteSettings()`        | `site_settings` table                        | Footer (store name, social links) |
| `lib/cache.ts` → `getCachedHeroSection()`         | `content_sections` WHERE type='hero'         | ServerHeroSection                 |
| `lib/cache.ts` → `getCachedAnnouncementSection()` | `content_sections` WHERE type='announcement' | ServerAnnouncementBar             |
| `lib/cache.ts` → `getCachedFeaturedProducts()`    | `products` + `product_images` tables         | ServerFeaturedProducts            |
| `lib/cache.ts` → `getCachedCategories()`          | `categories` table                           | ServerFeaturedCategories          |

### Admin side (writes)

| File                                                 | Writes to                               |
| ---------------------------------------------------- | --------------------------------------- |
| `routers/admin/settings.ts` → `updateSiteSettings`   | `site_settings` table                   |
| `routers/admin/settings.ts` → `updateContentSection` | `content_sections` table (with history) |
| `routers/admin/settings.ts` → `updateFeaturedItems`  | `featured_items` table                  |

### ⚠️ Watch out for

- Cache uses `unstable_cache` with 60-second TTL. Admin changes won't show instantly.
- `revalidateTag()` calls should be added after admin updates to bust cache.
- Footer.tsx fetches site settings directly via `container.getSiteConfigRepository()` (no cache!), while other components use cached versions.

---

## Connection 7: Notifications → Orders + Reviews + Products

**What crosses:** Business events should trigger notifications.

### Current state: Notification tables exist but triggers are NOT wired up

### What SHOULD trigger notifications

| Event                 | Trigger location                 | Notification type | Recipient |
| --------------------- | -------------------------------- | ----------------- | --------- |
| New order placed      | `create-order.use-case.ts`       | `new_order`       | Admin     |
| Order shipped         | Admin order update               | `order_shipped`   | User      |
| Order delivered       | Admin order update               | `order_delivered` | User      |
| Low stock             | After order (stock decremented)  | `low_stock`       | Admin     |
| New review submitted  | `reviews.ts` → `create` mutation | `new_review`      | Admin     |
| Wishlist item on sale | Product price update             | `wishlist_sale`   | User      |
| Item back in stock    | Inventory restock                | `item_available`  | User      |

### Tables

- `admin_notifications` — `notificationTypeEnum`: `new_order`, `low_stock`, `new_review`, `failed_payment`, `new_customer`
- `user_notifications` — `userNotificationTypeEnum`: `wishlist_sale`, `item_available`, `order_update`, `price_drop`, `order_confirmed`, `order_shipped`, `order_delivered`, `order_cancelled`, `refund_processed`

---

## Connection 8: Environment Config → Auth + Payments + Email

**What crosses:** Multiple services depend on the same environment variables.

| Env Variable                   | Used by                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_URL`              | `lib/auth.ts` (implicit) — Better Auth uses this for callback URLs                           |
| `BETTER_AUTH_SECRET`           | `lib/auth.ts` (implicit) — session signing                                                   |
| `NEXT_PUBLIC_BASE_URL`         | `lib/auth-client.ts` — client-side auth API base                                             |
| `NEXT_PUBLIC_APP_URL`          | `resend-email.service.ts` + `create-checkout-session.use-case.ts` — email links, Stripe URLs |
| `GOOGLE_CLIENT_ID/SECRET`      | `lib/auth.ts` — Google OAuth                                                                 |
| `FACEBOOK_CLIENT_ID/SECRET`    | `lib/auth.ts` — Facebook OAuth                                                               |
| `STRIPE_SECRET_KEY`            | `infrastructure/services/stripe.service.ts`                                                  |
| `STRIPE_WEBHOOK_SECRET`        | `app/api/webhook/stripe/route.ts`                                                            |
| `RESEND_API_KEY`               | `infrastructure/services/resend-email.service.ts`                                            |
| `DATABASE_URL`                 | `db/index.ts`                                                                                |
| `UPLOADTHING_TOKEN`            | `lib/uploadthing.ts`                                                                         |
| `UPSTASH_REDIS_REST_URL/TOKEN` | Currently unused (in-memory rate limiter used instead)                                       |

### ⚠️ Critical for deployment

All `localhost:3000` references must be updated for production. Three separate env vars control URLs:

1. `BETTER_AUTH_URL` — server-side auth
2. `NEXT_PUBLIC_BASE_URL` — client-side auth
3. `NEXT_PUBLIC_APP_URL` — email links + Stripe redirects

---

## 📋 Connection Chat Sessions

| Session        | Domains                          | When to do             |
| -------------- | -------------------------------- | ---------------------- |
| Connection 1-2 | Auth + Products + Cart           | After Domains 1, 2, 3  |
| Connection 3   | Cart + Checkout + Orders         | After Domains 3, 4, 5  |
| Connection 4   | Products + Wishlist + Navbar     | After Domains 2, 3, 12 |
| Connection 5   | Orders + Reviews                 | After Domains 5, 9     |
| Connection 6   | CMS + Layout + Homepage          | After Domains 7, 8, 12 |
| Connection 7   | Notifications + Orders + Reviews | After Domains 5, 9, 10 |
| Connection 8   | Environment + All services       | Domain 14 (final pass) |
