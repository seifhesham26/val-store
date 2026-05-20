# Domain 4: 💳 Checkout & Payments

> **Priority:** 🟡 MEDIUM  
> **Estimated effort:** 1 chat session  
> **Dependencies:** Domain 3 (Cart)

---

## Scope

Checkout flow, address selection, payment method, Stripe integration, webhooks, order creation

---

## Files Involved

### Components (`src/components/checkout/`)

| File                           | Size  | Role                       |
| ------------------------------ | ----- | -------------------------- |
| `CheckoutForm.tsx`             | 6KB   | Main checkout orchestrator |
| `CheckoutOrderSummary.tsx`     | 6.4KB | Order summary sidebar      |
| `CheckoutAddressSelection.tsx` | 2.7KB | Address picker             |
| `CheckoutPaymentMethod.tsx`    | 2.9KB | Payment method selector    |
| `CheckoutNoAddress.tsx`        | 757B  | No-address empty state     |
| `CheckoutLoading.tsx`          | 258B  | Loading skeleton           |

### Backend

| File                                                                     | Size                               | Role                   |
| ------------------------------------------------------------------------ | ---------------------------------- | ---------------------- |
| `src/server/routers/public/checkout.ts`                                  | 1.2KB                              | Checkout tRPC router   |
| `src/application/checkout/`                                              | Use cases (creates Stripe session) |
| `src/application/checkout/use-cases/create-checkout-session.use-case.ts` | Stripe checkout session creation   |
| `src/infrastructure/services/stripe.service.ts`                          | 3.8KB                              | Stripe service wrapper |
| `src/app/api/webhook/stripe/route.ts`                                    | Stripe webhook handler             |

---

## Issues & Tasks

### Issue 1: 🔴 Stripe webhook secret is placeholder

**File:** `.env` line 43:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Task:**

1. Run `stripe listen --forward-to localhost:3000/api/webhook/stripe` for local testing
2. Copy the webhook signing secret it provides
3. For production: set up webhook endpoint in Stripe Dashboard → get real `whsec_` secret

---

### Issue 2: 🟡 Checkout session URLs use localhost fallback

**File:** `src/application/checkout/use-cases/create-checkout-session.use-case.ts` line 52:

```typescript
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
```

**Task:** This is tied to Domain 1's env variable cleanup. Ensure `NEXT_PUBLIC_APP_URL` is set correctly for production.

---

### Issue 3: 🟡 console.log in webhook handler

**File:** `src/app/api/webhook/stripe/route.ts`

**Task:** Remove console.log statements or replace with structured logging.

---

### Issue 4: 🟢 Clean DI pattern

The checkout container properly injects Order + Cart repos:

```typescript
const checkout = createCheckoutModule({
  getOrderRepository: orders.getOrderRepository,
  getCartRepository: cart.getCartRepository,
});
```

**Status:** ✅ Well-structured, no changes needed.

---

## Checklist

- [ ] Set up real Stripe webhook secret (local + production)
- [ ] Ensure `NEXT_PUBLIC_APP_URL` is set for production
- [ ] Remove console.log from webhook handler
- [ ] Test full checkout flow end-to-end

---

# Domain 5: 📦 Orders

> **Priority:** 🟡 MEDIUM  
> **Estimated effort:** 1 chat session  
> **Dependencies:** Domain 4 (Checkout)

---

## Scope

Customer order history, order detail, order status tracking

---

## Files Involved

### Components — File Organization Problem

```
src/components/account/
├── OrdersList.tsx              ← ❌ Root level (should be in orders/)
├── OrderDetailHeader.tsx       ← ❌ Root level (should be in order-detail/)
├── OrderItems.tsx              ← ❌ Root level (should be in order-detail/)
├── AccountRecentOrders.tsx     ← Dashboard widget (ok here or in dashboard/)
├── orders/                     ← ✅ Subdirectory exists
│   └── ...
└── order-detail/               ← ✅ Subdirectory exists
    └── ...
```

### Backend

| File                                               | Role                                            |
| -------------------------------------------------- | ----------------------------------------------- |
| `src/server/routers/public/orders.ts` (4.4KB)      | Customer orders tRPC router                     |
| `src/server/routers/admin/orders.ts` (1.8KB)       | Admin orders router                             |
| `src/domain/orders/`                               | Entities, interfaces, value-objects, exceptions |
| `src/application/orders/`                          | Order use cases + container                     |
| `src/infrastructure/database/repositories/orders/` | Order repo                                      |

---

## Issues & Tasks

### Issue 1: 📁 Order components scattered at account root

**Task:** Move misplaced files:

- `account/OrdersList.tsx` → `account/orders/OrdersList.tsx`
- `account/OrderDetailHeader.tsx` → `account/order-detail/OrderDetailHeader.tsx`
- `account/OrderItems.tsx` → `account/order-detail/OrderItems.tsx`

Update all imports after moving.

---

### Issue 2: 📁 AccountRecentOrders placement

**File:** `src/components/account/AccountRecentOrders.tsx`

**Task:** Move to `account/dashboard/AccountRecentOrders.tsx` since it's a dashboard widget.

---

### Issue 3: 🟢 Admin vs Customer order views

Admin orders router (`1.8KB`) and customer orders router (`4.4KB`) are properly separated. The customer router is larger because it includes more query options and filtering.

**Status:** ✅ Well-structured.

---

## Checklist

- [ ] Move `OrdersList.tsx` into `account/orders/`
- [ ] Move `OrderDetailHeader.tsx` and `OrderItems.tsx` into `account/order-detail/`
- [ ] Move `AccountRecentOrders.tsx` into `account/dashboard/`
- [ ] Update all imports after moves
