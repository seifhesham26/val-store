# Domain 6: 👤 Account & Addresses

> **Priority:** 🟢 LOW  
> **Estimated effort:** 1 chat session  
> **Dependencies:** Domain 1 (Auth)

---

## Scope

User profile, address management, account dashboard, account sidebar

---

## Files Involved

### Components — Organization Problem

```
src/components/account/
├── AccountSidebar.tsx          ← Ok (shared layout component)
├── AccountRecentOrders.tsx     ← Move to dashboard/ (covered in Domain 5)
├── AddressList.tsx             ← ❌ Should be in addresses/
├── AddressFormDialog.tsx       ← ❌ Should be in addresses/
├── AddressesHeader.tsx         ← ❌ Should be in addresses/
├── OrdersList.tsx              ← ❌ Covered in Domain 5
├── OrderDetailHeader.tsx       ← ❌ Covered in Domain 5
├── OrderItems.tsx              ← ❌ Covered in Domain 5
├── addresses/                  ← ✅ Subdirectory exists but root duplicates!
├── dashboard/                  ← ✅ Account dashboard components
├── order-detail/               ← ✅
├── orders/                     ← ✅
├── profile/                    ← ✅
└── wishlist/                   ← ✅
```

### Root-level misplaced components

| File                                       | Size  | Should be                                                   |
| ------------------------------------------ | ----- | ----------------------------------------------------------- |
| `src/components/UserDialog.tsx`            | 5.3KB | `components/account/UserDialog.tsx` or `components/layout/` |
| `src/components/UserNotificationsBell.tsx` | 6.7KB | `components/layout/` or `components/notifications/`         |

### Backend

| File                                           | Role                           |
| ---------------------------------------------- | ------------------------------ |
| `src/server/routers/public/address.ts` (2.9KB) | Address CRUD                   |
| `src/server/routers/public/profile.ts` (819B)  | Profile queries                |
| `src/domain/address/`                          | Address entities + interfaces  |
| `src/domain/customers/`                        | Customer entities + interfaces |
| `src/application/address/`                     | Address use cases              |
| `src/application/customers/`                   | Customer use cases             |

---

## Issues & Tasks

### Issue 1: 📁 Address components duplicated at root and in subdirectory

**Task:** Move root-level address files into `account/addresses/`:

- `AddressList.tsx` → `addresses/AddressList.tsx`
- `AddressFormDialog.tsx` → `addresses/AddressFormDialog.tsx`
- `AddressesHeader.tsx` → `addresses/AddressesHeader.tsx`

Check if `addresses/` subdir already has duplicates first!

---

### Issue 2: 📁 UserDialog and UserNotificationsBell misplaced

**Task:**

- `UserDialog.tsx` → `components/layout/UserDialog.tsx` (it's a navbar dropdown)
- `UserNotificationsBell.tsx` → `components/layout/UserNotificationsBell.tsx` (it's in the navbar)

---

### Issue 3: 🟡 Account folder lacks SRP

8 files at root level + 6 subdirectories. After moving files from Issues 1 & 2 (and Domain 5's moves), the root should only have `AccountSidebar.tsx`.

---

## Checklist

- [ ] Move address components into `account/addresses/`
- [ ] Move `UserDialog.tsx` to `components/layout/`
- [ ] Move `UserNotificationsBell.tsx` to `components/layout/`
- [ ] Verify account root only has shared components after cleanup

---

# Domain 7: 🏠 Homepage & CMS

> **Priority:** 🟢 LOW  
> **Estimated effort:** 1 chat session  
> **Dependencies:** None

---

## Scope

Hero section, featured categories/products, promo banner, newsletter, trust indicators, brand story, Instagram feed, announcement bar, CMS content sections

---

## Files Involved (`src/components/home/` — 16 files!)

| File                            | Size  | Role                 | Notes                               |
| ------------------------------- | ----- | -------------------- | ----------------------------------- |
| `ServerHeroSection.tsx`         | 3.8KB | Server component     | ✅ Used in homepage                 |
| `DynamicHeroSection.tsx`        | 4.3KB | Dynamic wrapper      | ⚠️ May be unused                    |
| `HeroSection.tsx`               | 2.6KB | Client component     | ⚠️ May be unused                    |
| `HeroScrollIndicator.tsx`       | 805B  | Scroll arrow         | Used by hero                        |
| `ServerFeaturedCategories.tsx`  | 3.9KB | Server component     | ✅ Used in homepage                 |
| `DynamicFeaturedCategories.tsx` | 3.5KB | Dynamic wrapper      | ⚠️ May be unused                    |
| `FeaturedCategories.tsx`        | 2.6KB | Client component     | ⚠️ May be unused                    |
| `ServerFeaturedProducts.tsx`    | 3KB   | Server component     | ✅ Used in homepage                 |
| `DynamicFeaturedProducts.tsx`   | 3.2KB | Dynamic wrapper      | ⚠️ May be unused                    |
| `FeaturedProducts.tsx`          | 2.8KB | Client component     | Has `TODO: Replace with tRPC query` |
| `NewArrivals.tsx`               | 4.1KB | New arrivals section | ✅ Used                             |
| `PromoBanner.tsx`               | 1.8KB | Promotional banner   | ✅ Used                             |
| `BrandStory.tsx`                | 2.4KB | Brand story section  | ✅ Used                             |
| `NewsletterSection.tsx`         | 2.3KB | Newsletter form      | 🔴 TODO: Not functional             |
| `InstagramFeed.tsx`             | 2.4KB | Instagram grid       | 🟡 Uses placeholder images          |
| `TrustIndicators.tsx`           | 1.2KB | Trust badges         | ✅ Used                             |

---

## Issues & Tasks

### Issue 1: 🟢 Consolidate triple-file pattern

9 files for 3 sections (Hero, FeaturedCategories, FeaturedProducts). The homepage only uses `Server*` versions.

**Task:** Grep for imports of `DynamicHeroSection`, `HeroSection`, `DynamicFeaturedCategories`, etc. Remove any that have zero imports.

---

### Issue 2: 🔴 Newsletter is fake

**File:** `src/components/home/NewsletterSection.tsx` lines 26-29:

```typescript
// TODO: Implement actual newsletter subscription
await new Promise((resolve) => setTimeout(resolve, 1000));
setStatus("success");
```

**Task:** Either:

- Wire up to Resend (create a mailing list)
- Or remove the section until ready

---

### Issue 3: 🟡 Instagram feed uses placeholder images

**File:** `src/components/home/InstagramFeed.tsx` — uses `picsum.photos` for all 6 images.

**Task:** Either connect to real Instagram API, use actual brand images, or remove section.

---

### Issue 4: 🟡 Announcement bar has 3 variants

```
src/components/layout/
├── AnnouncementBar.tsx          ← Base component
├── AnnouncementBarClient.tsx    ← Client wrapper
└── ServerAnnouncementBar.tsx    ← Server wrapper
```

**Task:** Audit if all 3 are needed or can be simplified to Server + Client only.

---

### Issue 5: 🟢 CMS content sections are well-structured

The admin settings router (`8.8KB`) handles hero, announcement, featured items, and site settings via `contentSections` DB table with JSON content + Zod validation.

**Status:** ✅ Good architecture.

---

## Checklist

- [ ] Audit and remove unused home component variants
- [ ] Fix or remove newsletter section
- [ ] Replace placeholder Instagram images or remove section
- [ ] Simplify announcement bar to fewer files
- [ ] Verify all homepage sections render correctly
