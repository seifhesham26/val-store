# Domain 2: 🛍️ Products (Storefront)

> **Priority:** 🟡 MEDIUM  
> **Estimated effort:** 1-2 chat sessions  
> **Dependencies:** Domain 1 (Auth) should be done first

---

## Scope

Product listing, product detail page, product cards, infinite scroll, search, collections, quick-add slider, product data caching

---

## Files Involved

### Components (`src/components/products/`)

| File                      | Size   | Role                                                             |
| ------------------------- | ------ | ---------------------------------------------------------------- |
| `ProductCard.tsx`         | 3.5KB  | Product grid card with image, price, badges, wishlist, quick-add |
| `ProductDetail.tsx`       | 12.6KB | Full product detail page (images, variants, add-to-cart)         |
| `ProductReviews.tsx`      | 8KB    | Reviews section (covered in Domain 9)                            |
| `InfiniteProductGrid.tsx` | 5KB    | Infinite scroll product grid                                     |
| `InfiniteSearchGrid.tsx`  | 3.8KB  | Search results with infinite scroll                              |
| `QuickAddSliderBar.tsx`   | 10KB   | Vertical odometer-style variant picker on hover                  |
| `RelatedProducts.tsx`     | 1.3KB  | Related products section                                         |
| `WishlistButton.tsx`      | 4.3KB  | Heart button (covered in Domain 3)                               |

### Components (`src/components/collections/`)

| File                       | Size  | Role                         |
| -------------------------- | ----- | ---------------------------- |
| `CollectionPageLayout.tsx` | 5.8KB | Collection page with filters |
| `CollectionSection.tsx`    | 2.7KB | Category section display     |
| `CollectionsHeader.tsx`    | 485B  | Page header                  |
| `BrowseAllBanner.tsx`      | 915B  | CTA banner                   |

### Components (`src/components/search/`)

| File                    | Size | Role                     |
| ----------------------- | ---- | ------------------------ |
| `SearchContent.tsx`     | 518B | Search results container |
| `SearchEmptyPrompt.tsx` | 501B | Empty search state       |

### Root-level (should move)

| File                              | Size  | Problem                              |
| --------------------------------- | ----- | ------------------------------------ |
| `src/components/SearchDialog.tsx` | 6.9KB | ❌ Should be in `components/search/` |

### Home Components (product-related)

| File                          | Size  | Role                                    |
| ----------------------------- | ----- | --------------------------------------- |
| `FeaturedProducts.tsx`        | 2.8KB | Client-side featured (has TODO comment) |
| `DynamicFeaturedProducts.tsx` | 3.2KB | Dynamic wrapper                         |
| `ServerFeaturedProducts.tsx`  | 3KB   | Server component version                |

### Backend

| File                                                   | Role                                            |
| ------------------------------------------------------ | ----------------------------------------------- |
| `src/server/routers/public/products.ts` (8.1KB)        | Public products tRPC router                     |
| `src/server/routers/public/categories.ts` (3.6KB)      | Public categories router                        |
| `src/server/routers/public/coupons.ts` (1.3KB)         | Public coupons router                           |
| `src/domain/products/`                                 | Entities, interfaces, value-objects, exceptions |
| `src/domain/categories/`                               | Entities, interfaces, value-objects, exceptions |
| `src/application/products/`                            | Use cases + container (3.9KB container)         |
| `src/application/categories/`                          | Use cases + container                           |
| `src/infrastructure/database/repositories/products/`   | Product repo                                    |
| `src/infrastructure/database/repositories/categories/` | Category repo                                   |
| `src/lib/cache.ts` (7.7KB)                             | Cached data fetchers                            |
| `src/lib/transformers/products.ts` (1.7KB)             | Product data transformers                       |
| `src/hooks/use-infinite-scroll.ts` (3.3KB)             | Infinite scroll hook                            |

### Pages

| File                              | Role                                                           |
| --------------------------------- | -------------------------------------------------------------- |
| `src/app/(main)/products/[slug]/` | Product detail page                                            |
| `src/app/(main)/collections/`     | 7 sub-routes (all, men, women, accessories, new, sale, [slug]) |
| `src/app/(main)/search/`          | Search results page                                            |

---

## Issues & Tasks

### Issue 1: 📁 SearchDialog is misplaced

**Current:** `src/components/SearchDialog.tsx` (root level)  
**Should be:** `src/components/search/SearchDialog.tsx`

**Task:** Move file and update all imports. Currently imported in:

- `src/components/layout/Navbar.tsx` (line 19)

---

### Issue 2: 🟡 FeaturedProducts.tsx has dead TODO

**File:** `src/components/home/FeaturedProducts.tsx` line 78:

```typescript
// TODO: Replace with tRPC query
```

**Task:** This file may be dead code since `ServerFeaturedProducts.tsx` exists and is used in the homepage. Verify and remove if unused.

---

### Issue 3: 🟢 Triple-file pattern for home sections

**Problem:** Each homepage section has 3 files:

- `HeroSection.tsx` (client) + `DynamicHeroSection.tsx` (dynamic) + `ServerHeroSection.tsx` (server)
- `FeaturedCategories.tsx` (client) + `DynamicFeaturedCategories.tsx` (dynamic) + `ServerFeaturedCategories.tsx` (server)
- `FeaturedProducts.tsx` (client) + `DynamicFeaturedProducts.tsx` (dynamic) + `ServerFeaturedProducts.tsx` (server)

The homepage (`src/app/(main)/page.tsx`) only uses the `Server*` versions.

**Task:** Audit which versions are actually imported anywhere. Remove unused variants.

---

### Issue 4: 🟡 Cache fetchers load all data then filter in JS

**File:** `src/lib/cache.ts`

```typescript
// getCachedRelatedProducts (line 239) — fetches ALL products then filters
const products = await repo.findAll({ isActive: true });
const filtered = products.filter((p) => p.id !== excludeId).slice(0, limit);

// getCachedAllProducts (line 210) — fetches all then slices
const products = await repo.findAll({ isActive: true });
return Promise.all(products.slice(0, limit).map(...));
```

**Task:** Add repository methods like `findAllExcluding(id, limit)` and use DB-level `LIMIT` + `WHERE` instead of fetching everything.

---

### Issue 5: 🟢 Collection routes are hardcoded

**Current structure:**

```
src/app/(main)/collections/
├── [slug]/        ← Dynamic route
├── accessories/   ← Hardcoded
├── all/           ← Hardcoded
├── men/           ← Hardcoded
├── new/           ← Hardcoded
├── sale/          ← Hardcoded
├── women/         ← Hardcoded
└── page.tsx       ← Collections index
```

**Task:** Consider if the hardcoded routes (`men`, `women`, `accessories`, `sale`, `new`, `all`) can be handled by the `[slug]` dynamic route with special logic, reducing duplication.

---

### Issue 6: 🟡 QuickAddSliderBar is 10KB

**File:** `src/components/products/QuickAddSliderBar.tsx` (10KB, single file)

**Task:** Break into sub-components:

- `QuickAddSliderBar.tsx` — orchestrator
- `VariantWheel.tsx` — the scroll wheel picker
- `QuickAddButton.tsx` — the add-to-cart action

---

### Issue 7: 🟡 ProductDetail is 12.6KB

**File:** `src/components/products/ProductDetail.tsx` (12.6KB)

**Task:** Break into:

- `ProductImageGallery.tsx` — image carousel/gallery
- `ProductInfo.tsx` — name, price, description
- `ProductVariantSelector.tsx` — size/color picker
- `ProductActions.tsx` — add to cart, wishlist buttons

---

### Issue 8: 🟡 N+1 query in cached featured products

**File:** `src/lib/cache.ts` lines 88-102:

```typescript
const productsWithImages = await Promise.all(
  products.map(async (p) => {
    const images = await imageRepo.findByProduct(p.id); // N+1!
    ...
  })
);
```

**Task:** Create a batch query `imageRepo.findByProducts(productIds)` that fetches all images in one query using `WHERE product_id IN (...)`.

---

## Checklist

- [ ] Move `SearchDialog.tsx` to `components/search/`
- [ ] Audit and remove unused home section variants (FeaturedProducts, HeroSection, FeaturedCategories)
- [ ] Add DB-level filtering to `getCachedRelatedProducts` and `getCachedAllProducts`
- [ ] Evaluate consolidating hardcoded collection routes into `[slug]`
- [ ] Split `QuickAddSliderBar.tsx` into sub-components
- [ ] Split `ProductDetail.tsx` into sub-components
- [ ] Fix N+1 image query with batch fetching
- [ ] Remove `TODO` comment from `FeaturedProducts.tsx`
