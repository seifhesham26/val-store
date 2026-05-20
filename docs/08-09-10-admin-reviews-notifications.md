# Domain 8: ⚙️ Admin Panel

> **Priority:** 🟡 MEDIUM  
> **Estimated effort:** 1-2 chat sessions  
> **Dependencies:** Domain 1 (Auth)

---

## Scope

Admin dashboard, product CRUD, order management, customer management, reviews moderation, inventory, coupons, settings, analytics

---

## Files Involved

### Admin Components (`src/components/admin/`)

```
admin/
├── AdminHeader.tsx             ← 1.3KB, header bar
├── AdminSidebar.tsx            ← 3KB, navigation sidebar
├── AdminNotifications.tsx      ← 5.6KB, notification panel
├── AdminThemeToggle.tsx        ← 799B, dark/light toggle
├── dashboard/                  ← 3 files (MetricsCards, RecentOrders, SalesChart)
├── settings/                   ← 5 files (Store, Appearance, Homepage, Featured, index)
├── products/                   ← 2 files + create/ subdir
├── products-list/              ← ❌ Should be in products/
├── create-product/             ← ❌ Should be in products/create/
├── orders/                     ← OrderDetail
├── orders-list/                ← ❌ Should be in orders/
├── customers/
├── reviews/
├── inventory/
├── coupons/
└── analytics/
```

### Admin tRPC Routers (`src/server/routers/admin/`)

13 router files: `products.ts`, `variants.ts`, `images.ts`, `orders.ts`, `dashboard.ts`, `settings.ts` (8.8KB!), `coupons.ts`, `reviews.ts`, `inventory.ts`, `customers.ts`, `notifications.ts`, `categories.ts`, `index.ts`

### Pages (`src/app/admin/`)

8 page routes: dashboard, products, orders, customers, reviews, inventory, coupons, settings, analytics

---

## Issues & Tasks

### Issue 1: 📁 Products split across 3 directories

**Current:**

- `admin/products/` — ProductEditForm, CreateProductForm
- `admin/products-list/` — Product list table
- `admin/create-product/` — Product creation wizard

**Task:** Consolidate:

```
admin/products/
├── ProductEditForm.tsx
├── CreateProductForm.tsx
├── list/           ← from products-list/
└── create/         ← from create-product/
```

---

### Issue 2: 📁 Orders split across 2 directories

**Current:**

- `admin/orders/` — OrderDetail
- `admin/orders-list/` — Orders table

**Task:** Consolidate under `admin/orders/`

---

### Issue 3: 🟡 Settings router is massive (8.8KB)

**File:** `src/server/routers/admin/settings.ts` — single file handling:

- Site settings CRUD
- Content sections (hero, announcement)
- Featured items management
- Content history/versioning

**Task:** Split into:

- `settings/site-settings.ts` — store name, contact, social links
- `settings/content-sections.ts` — hero, announcement, content
- `settings/featured-items.ts` — featured products/categories

---

### Issue 4: 🟢 Admin layout is well-structured

Admin layout has ThemeProvider, TRPCProvider, fixed sidebar + header. Clean architecture.

**Status:** ✅ No changes needed.

---

### Issue 5: 🟡 Admin page-level auth check

The middleware (`src/middleware.ts`) only checks for cookie existence on `/admin` routes. Full role validation happens at the tRPC layer via `adminProcedure`. But the **page components** should also verify admin role before rendering.

**Task:** Verify each admin page does a session check to show proper unauthorized UI instead of just failing on tRPC calls.

---

## Checklist

- [ ] Merge `products-list/` and `create-product/` into `products/`
- [ ] Merge `orders-list/` into `orders/`
- [ ] Split `settings.ts` router into 3 smaller files
- [ ] Verify admin pages handle unauthorized access gracefully
- [ ] Update all imports after file moves

---

# Domain 9: ⭐ Reviews & Ratings

> **Priority:** 🟢 LOW  
> **Estimated effort:** 1 chat session  
> **Dependencies:** Domain 2 (Products), Domain 5 (Orders)

---

## Files Involved

| File                                                | Size                    | Role                           |
| --------------------------------------------------- | ----------------------- | ------------------------------ |
| `src/components/products/ProductReviews.tsx`        | 8KB                     | Customer review display + form |
| `src/components/admin/reviews/`                     | Admin review moderation |
| `src/server/routers/public/reviews.ts`              | 2.1KB                   | Public reviews router          |
| `src/server/routers/admin/reviews.ts`               | 1.7KB                   | Admin reviews router           |
| `src/domain/reviews/interfaces/`                    | Review interfaces only  |
| `src/infrastructure/database/repositories/reviews/` | Review repo             |

---

## Issues & Tasks

### Issue 1: 🔴 Verified purchase is always false

**File:** `src/server/routers/public/reviews.ts` line 68:

```typescript
isVerifiedPurchase: false, // TODO: Check if user purchased
```

**Task:** Query `orderItems` table to check if user has a delivered order containing this product. Set `isVerifiedPurchase: true` if found.

---

### Issue 2: 🟡 ProductReviews.tsx is 8KB monolith

**Task:** Split into:

- `ReviewForm.tsx` — review submission form
- `ReviewList.tsx` — review display list
- `ReviewCard.tsx` — single review card
- `ReviewSummary.tsx` — star rating summary

---

### Issue 3: 🟢 Reviews domain is interface-only

Same as wishlist — `src/domain/reviews/` only has `interfaces/`, no entities.

**Task:** Either add entities or document the intentional thin-domain pattern.

---

## Checklist

- [ ] Implement verified purchase check using order history
- [ ] Split `ProductReviews.tsx` into sub-components
- [ ] Complete or document review domain layer

---

# Domain 10: 📬 Notifications

> **Priority:** 🟢 LOW  
> **Estimated effort:** 0.5 chat session  
> **Dependencies:** None

---

## Files

| File                                          | Size            | Role                               |
| --------------------------------------------- | --------------- | ---------------------------------- |
| `src/components/admin/AdminNotifications.tsx` | 5.6KB           | Admin notification panel           |
| `src/components/UserNotificationsBell.tsx`    | 6.7KB           | User notification bell (misplaced) |
| `src/server/routers/admin/notifications.ts`   | 1.9KB           | Admin notification router          |
| `src/server/routers/public/notifications.ts`  | 1.8KB           | User notification router           |
| `src/domain/notifications/interfaces/`        | Interfaces only |

---

## Issues

### Issue 1: 📁 UserNotificationsBell misplaced

**Current:** `src/components/UserNotificationsBell.tsx` (root level)  
**Move to:** `src/components/layout/UserNotificationsBell.tsx`  
(Already covered in Domain 6, just update imports)

### Issue 2: 🟡 Domain is interface-only

Same pattern as wishlist and reviews.

---

## Checklist

- [ ] Move `UserNotificationsBell.tsx` (handled in Domain 6)
- [ ] Complete or document notification domain layer
