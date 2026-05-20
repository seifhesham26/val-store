# Domain 11: 📄 Static/Info Pages

> **Priority:** 🟢 LOW  
> **Estimated effort:** 0.5 chat session  
> **Dependencies:** None

---

## Files Involved

| Domain   | Components                                                           | Page Route         |
| -------- | -------------------------------------------------------------------- | ------------------ |
| About    | `AboutHero.tsx`, `AboutContent.tsx`, `AboutValues.tsx`               | `(main)/about/`    |
| Contact  | `ContactHeader.tsx`, `ContactInfo.tsx`, `ContactFormPlaceholder.tsx` | `(main)/contact/`  |
| FAQ      | `FAQHeader.tsx`, `FAQAccordion.tsx`, `FAQSupport.tsx`                | `(main)/faq/`      |
| Privacy  | `PrivacyHeader.tsx`, `PrivacyContent.tsx`                            | `(main)/privacy/`  |
| Terms    | `TermsHeader.tsx`, `TermsContent.tsx`                                | `(main)/terms/`    |
| Returns  | `ReturnsHeader.tsx`, `ReturnsContent.tsx`, `ReturnsOptions.tsx`      | `(main)/returns/`  |
| Shipping | `ShippingHeader.tsx`, `ShippingOptions.tsx`, `ShippingPolicy.tsx`    | `(main)/shipping/` |

---

## Issues & Tasks

### Issue 1: 🟡 Contact form is placeholder

**File:** `ContactFormPlaceholder.tsx` — shows "Contact form coming soon. Email us at support@valstore.com"  
**Task:** Build a real contact form with Resend email integration.

### Issue 2: 🟡 All content is hardcoded

Every static page has content baked into components. Could be moved to CMS `contentSections` table.  
**Task:** Decide if CMS-driven content is worth it, or keep static for simplicity.

### Issue 3: 🟡 No per-page SEO metadata

Static pages likely don't export `metadata` objects with specific titles/descriptions.  
**Task:** Add `export const metadata: Metadata = { title: "...", description: "..." }` to each page.

### Issue 4: 🔴 Footer links to non-existent pages

**File:** `src/components/layout/Footer.tsx` lines 31-35 — links to:

- `/careers` — page doesn't exist
- `/sustainability` — page doesn't exist
- `/press` — page doesn't exist
- `/blog` — page doesn't exist
- `/size-guide` — page doesn't exist

**Task:** Either create these pages or remove the dead links.

---

## Checklist

- [ ] Build real contact form
- [ ] Decide on CMS vs hardcoded content
- [ ] Add SEO metadata to all static pages
- [ ] Fix or remove dead footer links (`/careers`, `/sustainability`, `/press`, `/blog`, `/size-guide`)

---

# Domain 12: 🎨 Layout & Shared UI

> **Priority:** 🟡 MEDIUM  
> **Estimated effort:** 1 chat session  
> **Dependencies:** None

---

## Files Involved

### Layout Components (`src/components/layout/`)

| File                        | Size  | Issues                                                                          |
| --------------------------- | ----- | ------------------------------------------------------------------------------- |
| `Navbar.tsx`                | 7.8KB | 🟡 Large — handles nav links, auth state, search, wishlist, cart, admin, mobile |
| `MobileMenu.tsx`            | 7.4KB | 🟡 Large — could share nav link config with Navbar                              |
| `Footer.tsx`                | 6.4KB | Server component — fetches site settings                                        |
| `AnnouncementBar.tsx`       | 1.8KB | Base component                                                                  |
| `AnnouncementBarClient.tsx` | 3.7KB | Client wrapper                                                                  |
| `ServerAnnouncementBar.tsx` | 1.7KB | Server wrapper                                                                  |

### Layouts

| File                        | Role            | Issues                                            |
| --------------------------- | --------------- | ------------------------------------------------- |
| `src/app/layout.tsx`        | Root layout     | 🔴 In "debug mode" — missing Toaster              |
| `src/app/(main)/layout.tsx` | Main storefront | ✅ Has TRPCProvider, CartProvider, Navbar, Footer |
| `src/app/(auth)/layout.tsx` | Auth pages      | Simple wrapper                                    |
| `src/app/admin/layout.tsx`  | Admin panel     | ✅ Has ThemeProvider, TRPCProvider, Sidebar       |

### UI Components (`src/components/ui/` — 56 files)

shadcn/ui components. Standard flat directory structure (this is the convention).

### Providers (`src/components/providers/`)

| File                | Role                                 |
| ------------------- | ------------------------------------ |
| `trpc-provider.tsx` | TanStack Query + tRPC client         |
| `cart-provider.tsx` | Cart context bridging Zustand + tRPC |

---

## Issues & Tasks

### Issue 1: 🔴 Root layout missing Toaster

**File:** `src/app/layout.tsx` lines 20-23:

```typescript
/**
 * TEMPORARY: Simplified root layout for debugging
 * Removed: TRPCProvider, AnnouncementBar, Navbar, Toaster
 */
```

**Task:** Add `<Toaster />` from sonner back to root layout. It should be global so toast notifications work on ALL pages including auth pages.

```typescript
import { Toaster } from "sonner";
// In the body:
{children}
<Toaster />
```

---

### Issue 2: 🟡 Navbar.tsx is 7.8KB with too many responsibilities

**Current Navbar handles:** nav links, logo, search dialog, auth state, user icon, wishlist count, notification bell, cart button with count, admin link, mobile menu toggle.

**Task:** Extract:

- `NavLinks.tsx` — desktop navigation links
- `NavActions.tsx` — right-side icons (search, user, wishlist, cart, admin)
- `NavCartBadge.tsx` — cart icon with count badge
- Keep `Navbar.tsx` as the orchestrator

---

### Issue 3: 🟡 MobileMenu duplicates nav link config

**File:** `Navbar.tsx` line 31-36 defines `navLinks` array. `MobileMenu.tsx` likely has its own copy.

**Task:** Extract shared `navLinks` config to a constants file.

---

### Issue 4: 🟡 Val brand colors same in light and dark mode

**File:** `src/app/globals.css` lines 89-93 and 129-133:

```css
/* :root */
--val-accent: #94a3b8;
--val-accent-light: #cbd5e1;
--val-silver: #e2e8f0;
--val-steel: #1e293b;

/* .dark — exact same values */
--val-accent: #94a3b8;
--val-accent-light: #cbd5e1;
--val-silver: #e2e8f0;
--val-steel: #1e293b;
```

**Task:** Either differentiate dark mode brand colors or remove the duplicate.

---

### Issue 5: 🟡 Body hardcoded to dark mode

**File:** `src/app/layout.tsx` line 32:

```typescript
className={`... antialiased bg-black text-white`}
```

The storefront is dark-mode only. Admin panel has ThemeProvider. Consider if storefront should also support light mode.

---

### Issue 6: 🟢 UI components follow shadcn convention

56 components in flat `ui/` directory. This is standard and expected.  
**Status:** ✅ No changes needed.

---

## Checklist

- [ ] Add `<Toaster />` back to root layout
- [ ] Remove "TEMPORARY" debug comment from root layout
- [ ] Split `Navbar.tsx` into sub-components
- [ ] Extract shared nav links config
- [ ] Fix duplicate brand CSS variables
- [ ] Decide on storefront light/dark mode support

---

# Domain 13: 🗄️ Database & Infrastructure

> **Priority:** 🟢 LOW  
> **Estimated effort:** 1 chat session  
> **Dependencies:** Do after all feature domains are stable

---

## Files

| File                                        | Size                              | Issues                          |
| ------------------------------------------- | --------------------------------- | ------------------------------- |
| `src/db/schema.ts`                          | 30KB (863 lines)                  | 🟡 Massive single file          |
| `src/db/relations.ts`                       | 7.2KB                             | Relations definitions           |
| `src/db/index.ts`                           | 1.3KB                             | DB connection (has console.log) |
| `auth-schema.ts` (project root!)            | 3.1KB                             | ❌ Should be in `src/db/`       |
| `src/application/container.ts`              | 1.9KB                             | ✅ Clean DI container           |
| `src/infrastructure/database/repositories/` | 13 repo directories               |
| `src/infrastructure/services/`              | 2 services (Resend, Stripe)       |
| `src/application/interfaces/`               | 2 interfaces (email, file-upload) |

---

## Issues

### Issue 1: 📁 auth-schema.ts at project root

**Move to:** `src/db/auth-schema.ts` and update import in `src/db/schema.ts` line 111.

### Issue 2: 🟡 schema.ts is 863 lines

**Task:** Consider splitting by domain:

- `schema/auth.ts`, `schema/products.ts`, `schema/orders.ts`, etc.
- Re-export from `schema/index.ts`

### Issue 3: 🟡 Incomplete Onion layers

Wishlist, reviews, notifications domains have interfaces only — no entities/value-objects/exceptions.  
**Task:** Document this as intentional for thin CRUD domains.

### Issue 4: 🟡 console.log in DB connection

**File:** `src/db/index.ts` — logs connection.  
**Task:** Remove or use conditional logging.

### Issue 5: 🟢 DI container is clean ✅

---

## Checklist

- [ ] Move `auth-schema.ts` to `src/db/`
- [ ] Consider splitting `schema.ts` by domain
- [ ] Document thin-domain pattern for simple CRUD domains
- [ ] Remove console.log from DB connection

---

# Domain 14: 🚀 DevOps & Cleanup

> **Priority:** 🟢 LOW  
> **Estimated effort:** 0.5 chat session  
> **Dependencies:** Do last

---

## Issues

### Issue 1: 🟡 Stale log files at project root

```
build_output.log     — 3.6KB, delete
build_output3.log    — 12.6KB, delete
type_output.log      — 942B, delete
```

**Task:** Delete and add `*.log` to `.gitignore`.

### Issue 2: 🟡 Old planning docs at project root

```
clothing-brand-project/    — 10 markdown files, old planning docs
```

**Task:** Archive to `docs/archive/` or delete.

### Issue 3: 🟡 tmp/ directory

**Task:** Add `tmp/` to `.gitignore` if not already there.

### Issue 4: 🟡 No CI/CD pipeline

No `.github/workflows/` detected. No automated testing, linting, or deployment.  
**Task:** Create basic GitHub Actions workflow for:

- `npm run lint`
- `npm run type-check`
- `npm run test`
- `npm run build`

### Issue 5: 🟡 Missing NEXT_PUBLIC_BASE_URL in .env.example

**Task:** Add to `.env.example` so others know it's needed.

### Issue 6: 🟢 Security headers configured ✅

`next.config.ts` has proper security headers (X-Frame-Options, HSTS, etc.)

---

## Checklist

- [ ] Delete stale `.log` files and add `*.log` to `.gitignore`
- [ ] Archive or delete `clothing-brand-project/`
- [ ] Add `tmp/` to `.gitignore`
- [ ] Create GitHub Actions CI workflow
- [ ] Add `NEXT_PUBLIC_BASE_URL` to `.env.example`
- [ ] Final verification: run `npm run build` and fix any errors
