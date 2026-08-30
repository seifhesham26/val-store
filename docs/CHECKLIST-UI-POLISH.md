# Check list — loading, footer, legal pages, colour swatches

Branch: `fix-p0` · All changes are UI/presentation only. No schema, router, or use-case changes.

Verified before handover: `pnpm type-check` clean · `pnpm lint` 0 errors (same 7 pre-existing warnings) · `pnpm test` 40/40 · `pnpm build` succeeds.

---

## 1. Valkyrie loading system

Replaced the generic `Loader2` spinner with a branded mark: a hexagonal shield track with a travelling steel-accent segment orbiting a pulsing "V" chevron, plus a steel shimmer for skeletons.

**Files**

| File                                              | Change                                                                                                                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/globals.css`                             | New "Valkyrie loading system" block: `val-orbit`, `val-core`, `val-breathe`, `val-shimmer`, `val-hint` keyframes; `.val-loader__*`, `.val-hint`, `.val-skeleton` classes; `prefers-reduced-motion` guard. |
| `src/components/ui/valkyrie-loader.tsx`           | **New.** `<ValkyrieLoader size="sm\|md\|lg" label="…" />`.                                                                                                                                                |
| `src/components/products/ProductCardSkeleton.tsx` | **New.** Shimmer placeholder matching the `ProductCard` 3:4 footprint, plus `ProductCardSkeletonGrid`.                                                                                                    |
| `src/components/products/InfiniteProductGrid.tsx` | Branded initial skeleton, placeholder cards appended while the next page loads, `ValkyrieLoader` at the sentinel, new "End of collection" rule.                                                           |
| `src/components/products/InfiniteSearchGrid.tsx`  | Same treatment, for consistency on `/search`.                                                                                                                                                             |

### Check at `/collections/all`

- [ ] **First load** — header + 8 product cards show a steel shimmer sweeping left-to-right (not a flat grey pulse).
- [ ] **Idle sentinel** — scroll near the bottom without triggering a fetch: a small chevron gently bobs above `SCROLL FOR MORE` in wide letter-spacing. (Old text was `Scroll for more...`.)
- [ ] **Loading next page** — 4 shimmer placeholder cards appear _inside_ the grid so the page grows, and the hexagon loader with a pulsing `LOADING` caption sits below.
- [ ] **Loader animation** — the accent segment travels around the hexagon while the V chevron breathes. Should read as one motion, not two competing spinners.
- [ ] **End of list** — scroll to the very bottom: a hairline rule fades in from both sides toward a small hexagon and `END OF COLLECTION`.
- [ ] **Reduced motion** — turn on Windows _Settings → Accessibility → Visual effects → Animation effects: Off_, reload. Everything renders static and legible; no stuck-invisible chevron.
- [ ] **Mobile (2-col)** — placeholders keep the grid aligned; no layout jump when real cards replace them.

### Check at `/search?q=…`

- [ ] Initial load shows the skeleton grid instead of a lone centred spinner.
- [ ] Next-page loading and the `END OF RESULTS` marker match the collections page.

---

## 2. Footer bottom section

`src/components/layout/Footer.tsx` — the four link columns above are unchanged; everything below the divider was rebuilt.

**Before:** one cramped row — small logo, copyright, two low-contrast `text-gray-500` legal links.

**After:** three tiers — trust strip → identity + legal → payment methods.

### Check on any page (scroll to the bottom)

- [ ] **Trust strip** — a bordered 3-cell box: _Nationwide delivery / Shipping across Egypt_, _Cash on delivery / Pay when it arrives_, _Secure payments / Encrypted card checkout_. Icons are steel-accent; hairline dividers separate the cells.
- [ ] **Logo** is larger (h-9, was h-8) with a vertical hairline separating it from the copyright on desktop.
- [ ] **Legal links** now read `Privacy Policy · Terms of Service · Shipping Policy · Returns Policy`, at `text-gray-400` hovering to white — noticeably more legible than the old `text-gray-500 → gray-400`.
- [ ] **Payment row** — `SECURE CHECKOUT` on the left, pill badges `VISA · MASTERCARD · MEEZA · CASH ON DELIVERY` on the right.
- [ ] **Mobile** — all three tiers stack and centre cleanly; the trust strip becomes one column; nothing overflows horizontally.
- [ ] **Links work** — all four legal links land on real pages.

> ⚠️ Not changed, still broken (pre-existing, flagged in `docs/ISSUES.md`): the **Company** column links to `/careers`, `/sustainability`, `/press`, `/blog` and Customer Care links to `/size-guide` — none of those routes exist. Say the word and I'll either build them or drop the links.

> ⚠️ `Meeza` is listed as an accepted method because it's the standard Egyptian card scheme. Stripe must actually be configured to accept it — remove the badge if not.

---

## 3. Privacy Policy & Terms of Service

**Root cause of how bad they looked:** both pages used `className="prose dark:prose-invert"`, but **`@tailwindcss/typography` is not installed** in this project. Those classes did nothing — the pages were rendering raw unstyled `<h2>`/`<p>`/`<ul>` on a black background. Rather than add the plugin, both pages now use explicit styling that matches the storefront.

**Files**

| File                                                              | Change                                                                                                                                         |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/legal/LegalDocument.tsx`                          | **New.** Shared primitives: `LegalHero`, `LegalBody` (sticky TOC + numbered sections), `LegalList`, `LegalNote`, `LegalTable`, `LegalContact`. |
| `src/components/privacy/PrivacyHeader.tsx` · `PrivacyContent.tsx` | Rewritten — 12 sections, Egypt/Valkyrie-specific.                                                                                              |
| `src/components/terms/TermsHeader.tsx` · `TermsContent.tsx`       | Rewritten — 15 sections.                                                                                                                       |
| `src/app/(main)/privacy/page.tsx` · `terms/page.tsx`              | Wider container (`max-w-6xl`), storefront padding rhythm, better meta descriptions.                                                            |

### Check at `/privacy` and `/terms`

- [ ] **Hero** — `LEGAL` eyebrow in steel accent, large title, one-line intro, a soft steel glow behind the heading, and a pill showing `Last updated 29 August 2026`.
- [ ] **Sticky TOC** (desktop ≥1024px) — left column lists every section as `01 Overview`, `02 Information we collect`… It stays pinned while you scroll, and the hovered item shows a steel left-border.
- [ ] **TOC links jump correctly** and land with clearance below the navbar (`scroll-mt-28`) — the heading should not hide under the header.
- [ ] **Sections** — each numbered `01`…, indented body text, hairline divider between sections. Body is `text-gray-400`, headings white.
- [ ] **Lists** use a small steel dash marker, not browser bullets.
- [ ] **Tables** — Privacy §06 (service providers) and §07 (retention) render as bordered label/value rows.
- [ ] **Callouts** — Privacy §03 ("we do not sell your personal information") and Terms §04 / §13 render in a bordered box.
- [ ] **Contact card** at the bottom of each page: white mail button (`privacy@valstore.com` / `legal@valstore.com`) plus an outlined "Contact us" button linking to `/contact`.
- [ ] **Mobile** — the TOC is hidden, sections read full width, buttons wrap instead of overflowing.
- [ ] **Cross-links** — Terms links out to `/privacy`, `/shipping`, `/returns` and all three resolve.

### Content review — needs your judgement

The copy was written against what the app actually does (Stripe hosted checkout, cash on delivery, phone-based login, Google/Facebook sign-in, Resend email, UploadThing media, Upstash rate limiting, EGP pricing, Egyptian jurisdiction). Please confirm:

- [ ] `privacy@valstore.com` and `legal@valstore.com` are real, monitored inboxes.
- [ ] The service-provider table matches who you actually use — remove any row you don't.
- [ ] Terms §09 states a **30-day** return window, taken from the existing `/returns` page. Confirm it's correct.
- [ ] Terms §04 states prices are in **EGP including applicable taxes**. Confirm the tax wording.
- [ ] Terms §14 sets **Egyptian law and courts** as governing.
- [ ] Minimum age is stated as **18** in both documents.

> ⚠️ This is drafted policy text, not legal advice. Have a lawyer review both documents before you go live — especially the liability, governing-law, and consumer-rights sections.

> ℹ️ Unrelated inconsistency spotted while cross-checking: `/shipping` quotes prices in **USD** (`$5.99`, `$14.99`) and offers international shipping, while the store charges in EGP. The Terms deliberately avoid quoting figures so they don't contradict it — but that page needs fixing separately.

---

## 4. Product colour swatches all rendering black

**Root cause:** `src/lib/transformers/products.ts` had a literal `hex: "#000000" // Default hex` for every colour. `product_variants` has a `color` name column (`"Navy"`, `"Olive"`) but **no hex column**, so nothing ever resolved a real colour.

**Files**

| File                                                                | Change                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/colors.ts`                                                 | **New.** `resolveColorHex(name)` — passes through hex literals, maps ~55 curated apparel colour names, and falls back to a deterministic hue derived from the name so unknown colours still differ from each other. Name matching ignores case, spaces, and punctuation (`"Light Grey"` = `"light-grey"`). |
| `src/lib/transformers/products.ts`                                  | Uses `resolveColorHex(v.color)` instead of the hardcoded black.                                                                                                                                                                                                                                            |
| `src/components/products/product-detail/ProductVariantSelector.tsx` | Swatches now use a ring instead of a border: unselected `ring-white/25` (so black and white swatches are both visible against the black page), hover `ring-white/60`, selected `ring-2 ring-white` with an offset. Added `title` and `aria-pressed`.                                                       |

### Check at `/products/a-line-maxi-skirt` (and a few others)

- [ ] Swatches show **distinct** colours — the seed catalogue uses Black, White, Navy, Gray, Beige, Olive, Burgundy, Brown.
- [ ] The **Black** swatch is still visible against the black page thanks to its outline ring.
- [ ] The **White** swatch reads as white, not a white blob merging into the ring.
- [ ] Clicking a swatch updates the `Color: …` label and shows a thick white selection ring with a dark offset gap.
- [ ] Hovering an unselected swatch brightens its ring.
- [ ] Hovering shows the colour name as a native tooltip.
- [ ] The selected colour still resolves to the right variant — add to cart and confirm the cart drawer shows the correct colour.
- [ ] Try a product whose colour name isn't in the curated list: it should get a stable mid-tone colour, never black, and the same colour on every reload.

> ℹ️ Longer-term fix, not done here: add a `color_hex` column to `product_variants` and let admins pick the exact swatch. `resolveColorHex` already passes hex literals straight through, so it will keep working when that column exists.

---

## Files touched

**New (4)**

```
src/components/ui/valkyrie-loader.tsx
src/components/products/ProductCardSkeleton.tsx
src/components/legal/LegalDocument.tsx
src/lib/colors.ts
```

**Modified (12)**

```
src/app/globals.css
src/app/(main)/privacy/page.tsx
src/app/(main)/terms/page.tsx
src/components/layout/Footer.tsx
src/components/products/InfiniteProductGrid.tsx
src/components/products/InfiniteSearchGrid.tsx
src/components/products/product-detail/ProductVariantSelector.tsx
src/components/privacy/PrivacyHeader.tsx
src/components/privacy/PrivacyContent.tsx
src/components/terms/TermsHeader.tsx
src/components/terms/TermsContent.tsx
src/lib/transformers/products.ts
```
