# Domain 3: 🛒 Cart & Wishlist

> **Priority:** 🟡 MEDIUM  
> **Estimated effort:** 1 chat session  
> **Dependencies:** Domain 2 (Products)

---

## Scope

Cart drawer, cart items, add-to-cart, cart page, wishlist, cart provider/store, server sync

---

## Files Involved

### Components (`src/components/cart/`)

| File                      | Size  | Role                                           |
| ------------------------- | ----- | ---------------------------------------------- |
| `CartDrawer.tsx`          | 4.3KB | Slide-out sheet with cart items + checkout CTA |
| `CartItem.tsx`            | 3.5KB | Single cart item row                           |
| `CartSummary.tsx`         | 2.8KB | Subtotal and checkout button                   |
| `CartPopulated.tsx`       | 2.1KB | Cart with items state                          |
| `CartEmpty.tsx`           | 869B  | Empty cart state                               |
| `CartLoading.tsx`         | 616B  | Loading skeleton                               |
| `CartUnauthenticated.tsx` | 1KB   | Unauthenticated state                          |
| `AddToCartButton.tsx`     | 3KB   | Add to cart action button                      |

### Wishlist

| File                                         | Size  | Role                                           |
| -------------------------------------------- | ----- | ---------------------------------------------- |
| `src/components/products/WishlistButton.tsx` | 4.3KB | ❌ Lives in `products/` but is wishlist domain |

### State & Providers

| File                                         | Size  | Role                                   |
| -------------------------------------------- | ----- | -------------------------------------- |
| `src/components/providers/cart-provider.tsx` | 5.1KB | React context bridging Zustand + tRPC  |
| `src/lib/stores/cart-store.ts`               | 3.4KB | Zustand store (local state + UI state) |

### Backend

| File                                                 | Role                                    |
| ---------------------------------------------------- | --------------------------------------- |
| `src/server/routers/public/cart.ts` (1.9KB)          | Cart CRUD tRPC router                   |
| `src/server/routers/public/wishlist.ts` (1.8KB)      | Wishlist tRPC router                    |
| `src/domain/cart/entities/` + `interfaces/`          | Cart domain layer                       |
| `src/domain/wishlist/interfaces/`                    | Wishlist interfaces only (no entities!) |
| `src/application/cart/`                              | Cart use cases + container              |
| `src/application/wishlist/`                          | Wishlist use cases + container          |
| `src/infrastructure/database/repositories/cart/`     | Cart repo                               |
| `src/infrastructure/database/repositories/wishlist/` | Wishlist repo                           |

### Pages

| File                               | Role           |
| ---------------------------------- | -------------- |
| `src/app/(main)/cart/`             | Full cart page |
| `src/app/(main)/account/wishlist/` | Wishlist page  |

---

## Issues & Tasks

### Issue 1: 🟢 Cart uses dual-state pattern (Zustand + tRPC)

**How it works:**

- `cart-store.ts` (Zustand) holds UI state: `isOpen`, local items for optimistic updates
- `cart-provider.tsx` bridges Zustand with tRPC queries for server-side persistence
- When user is authenticated, cart syncs to DB via tRPC
- When not authenticated, cart is local-only (Zustand localStorage)

**Task:** Audit this pattern for race conditions. Specifically check:

- What happens when user adds item while sync is in-flight?
- Does offline-first → login merge items correctly?
- Is `CartUnauthenticated.tsx` component used but guest cart has no backend support?

---

### Issue 2: 🟡 CartUnauthenticated exists but no guest cart backend

**File:** `src/components/cart/CartUnauthenticated.tsx`

The DB schema requires `userId` for cart items (non-nullable). There's no anonymous/session-based cart.

**Task:** Either:

- Remove `CartUnauthenticated.tsx` if guest cart isn't planned
- Or implement session-based anonymous cart that merges on login

---

### Issue 3: 📁 WishlistButton lives in wrong domain folder

**Current:** `src/components/products/WishlistButton.tsx`  
**Should be:** `src/components/wishlist/WishlistButton.tsx` (new folder)

**Task:** Create `src/components/wishlist/` folder and move `WishlistButton.tsx` there. Update imports in:

- `src/components/products/ProductCard.tsx` (line 6)

---

### Issue 4: 🟢 Wishlist domain is incomplete

**Current state:**

- `src/domain/wishlist/` has only `interfaces/` — no entities or value objects
- Compare with `src/domain/products/` which has `entities/`, `exceptions/`, `interfaces/`, `value-objects/`

**Task:** Either:

- Add entities to match the Onion Architecture pattern
- Or document that simple CRUD domains intentionally skip entities

---

## Checklist

- [ ] Audit cart sync pattern for race conditions
- [ ] Decide on `CartUnauthenticated.tsx` — keep or remove
- [ ] Move `WishlistButton.tsx` to `components/wishlist/`
- [ ] Complete wishlist domain layer or document why it's intentionally thin
