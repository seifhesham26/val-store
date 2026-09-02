# Known Issues

A catalogue of defects and gaps found by reading the codebase in full. Unlike the other files in `docs/`, this one describes **current state**, not plans.

Each entry gives the location, what actually happens, why, and a concrete fix.

> ## Status: 2026-09-02 remediation pass
>
> Everything below was worked through on `feat/p3-pass2-remediation`. Read
> `docs/superpowers/specs/2026-09-02-p3-pass2-design.md` for the decisions taken
> and `docs/P3-TEST-PLAN.md` for what still needs a human to verify — which is
> most of the visual work.
>
> **Ten defects this catalogue did not record** were found while implementing
> it. In rough order of consequence:
>
> 1. **Product and category image uploads were dead for everyone**, including
>    super_admins. `src/lib/uploadthing.ts` read the admin role from
>    `session.session.role`; the `session` table has no `role` column, so the
>    value was always `undefined` and the gate rejected every uploader. This
>    catalogue warns against exactly that mistake elsewhere.
> 2. **A COD order never recorded that it collected money.** `markAsPaid` is the
>    only writer of `payment_status = 'completed'` and every caller is a Stripe
>    path, so gating revenue on the payments table — the obvious fix for P2-2 —
>    would have reported near-zero for the payment method this store most likely
>    depends on. The status machine is also backwards for COD: it puts `paid`
>    before `shipped`.
> 3. **The LIKE-escaping fix (#22) was incomplete.** `containsPattern` reached
>    the products repository but not `customer.repository.ts:112-113` or
>    `admin/customers.ts:52`; a search for `%` matched every row.
> 4. **`admin.customers.getById` loaded every order** with every line and every
>    joined product, unbounded, for a dialog that renders a summary.
> 5. **`newsletter.subscribe` was an unthrottled anonymous insert**, while
>    `apiRateLimiter` sat defined with zero consumers. Better Auth's own limits
>    were never stated either.
> 6. **Six domain repository interfaces import Drizzle row types** from
>    `@/db/schema` — a wider breach of the inward-only rule than the three
>    application files CLAUDE.md records. **Deliberately not fixed:** those types
>    sit in interface signatures, so unwinding them is its own refactor.
> 7. **Order creation never checked that an address belonged to the customer.**
>    `CreateOrderUseCase` took `shippingAddressId` — and, once billing addresses
>    were added, `billingAddressId` too — straight from the client and wrote them
>    onto the order. Any signed-in customer could quote another customer's
>    address id, and since the order detail page now resolves and renders the
>    address, they would have been shown that person's name, street and phone.
>    Found by reviewing the combined diff, not by any test.
> 8. **The announcement editor was decorative.** Uncontrolled inputs, a dead Add
>    button, and a Save button with no handler at all — over a schema whose
>    messages are objects rather than strings, so the textarea was rendering an
>    object. `announcement` is one of the two section types this repo describes
>    as "wired end to end"; its rendering was, its editing was not.
> 9. **No Content-Security-Policy**, and a deprecated `X-XSS-Protection` header.
> 10. **`pnpm-workspace.yaml` held an unanswered `allowBuilds` stub** that made
>     `pnpm install` exit non-zero, which broke the husky pre-commit hook.
>
> **Six entries below were stale** and have been corrected in place: #36's
> warning count, P2-5's claim that no boundaries exist, P2-7's `drawer.tsx` and
> its "all three are unused" (`sheet.tsx` is imported by `CartDrawer`, so it was
> live), P2-13's file and dependency counts, and the P2-Performance note
> claiming collection pages are still client-side.

> ## Status: 2026-09-02 verification pass
>
> **Every open entry below was re-checked against the code. Twenty-three of them
> were already fixed and this file did not know it.** Where an entry's prose and
> this block disagree, this block is the one that was verified; the fixed entries
> now carry ✅ and a `**Verified fixed** 2026-09-02` line naming the evidence.
>
> This is the failure mode the catalogue exists to prevent, so it is worth
> naming: the remediation passes fixed things faster than the record was
> updated, and a stale "known issues" file is worse than none — it sends the
> next person to redo finished work and quietly launders fixed items into
> permanent-looking debt. Re-verify before starting anything here.
>
> **Verified fixed, no longer open:** #16 (the confirmation email, which this
> file still called "the one real feature gap"), #26, #27, #29, #30, #31, #32,
> #33, #35, #37, #42, #43, P2-0, P2-1, P2-2, P2-3, P2-4, P2-5, P2-8, P2-10,
> P2-11, P2-12, P2-13.
>
> **What was still open when this pass began** — kept because the "why it is
> still here" column is the reasoning each fix was built on, and because the
> narrowing (P2-7 down to one file, #28 down to one procedure) is the useful
> part. **All seven are now done — see the outcome table immediately below,
> which supersedes this one.**
>
> | #    | What                                         | Why it is still here                                                                                                                                                                                                                                                                                                                                                                                                                                        |
> | ---- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | #39  | Storefront runs on the light palette         | The root cause of six patched white-on-white bugs. `:root` is still the light palette and `<body>` still overrides to `bg-black text-white`.                                                                                                                                                                                                                                                                                                                |
> | P2-7 | One portalled primitive unpaired             | Narrowed to exactly one file: `src/components/ui/calendar.tsx` sets **both** `bg-background` and `bg-popover` and pairs **neither** with a foreground. Every other portalled primitive (dialog, alert-dialog, popover, select, dropdown-menu, sheet) is correctly paired. Belongs with #39.                                                                                                                                                                 |
> | #34  | The `worker` role does nothing               | Still declared in the enum, `UserProfileEntity` and `auth-helpers`, checked nowhere. `admin` and `super_admin` remain identical in every gate. A permission-model decision, not a patch — see the security pass's "Accepted, not fixed".                                                                                                                                                                                                                    |
> | #41  | `currency` column defaults are still `'USD'` | Narrowed by checking the database. The 25 `USD` order rows are **seed data with no payment rows**, not mischarged orders, so the backfill half of `drizzle/0003` is cosmetic. The `SET DEFAULT 'EGP'` half is the real fix and is unapplied. Needs a decision to write to the live database.                                                                                                                                                                |
> | #28  | One procedure still has no caller            | Narrowed to `admin.settings.getAllContentSections`. Everything else on the original list is resolved: `public.config`, `public.categories.getFeatured`, `public.products.{getBySlug,getFeatured}`, `admin.products.getBySlug` and `admin.notifications.clearAll` were **deleted**, and `getContentHistory`/`revertToVersion` are now called by `ContentHistoryDialog`.                                                                                      |
> | #36  | Lint warnings                                | Not the five unused-vars this entry describes; those are gone. There are now **three**, all `@next/next/no-location-assign-relative-destination` in `UserDialog`, `AccountSidebar` and `MobileMenu` — a rule new in eslint-config-next 16.3.4, firing on deliberate full reloads after an auth change. 0 errors.                                                                                                                                            |
> | #38  | Two decisions, nothing actionable in code    | Verified: `zod/v4` has **0** importers (all 31 files use plain `"zod"`), and `DrizzleOrderRepository.update()` no longer exists. `STRIPE_PUBLISHABLE_KEY` is read by no file and lives only in the untracked `.env`. What is left is two product decisions: the contact form is still `ContactFormPlaceholder`, and the phone-keyed `customers` model still has no reader (`GetOrCreateCustomerUseCase` is wired into the container and called by nothing). |
>
> **All seven were then worked through on `docs/reconcile-issues-catalogue`.**
> Current state:
>
> | #    | What                                 | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
> | ---- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | #39  | Storefront runs on the light palette | ✅ **Root cause removed.** `<body>` no longer carries colour literals; `globals.css` `.dark` now _defines_ `--background`/`--foreground` as pure black/white so the storefront renders identically while `@layer base { body { bg-background text-foreground } }` finally wins. Measured with headless Edge: a portalled surface that sets a background and no foreground went from **1.00:1 (invisible white-on-white)** to **19.80:1** under the light palette. |
> | P2-7 | One portalled primitive unpaired     | ✅ `calendar.tsx` now pairs `bg-background` with `text-foreground`.                                                                                                                                                                                                                                                                                                                                                                                               |
> | P2-6 | White-pill outline button            | ✅ The `outline` variant pairs `bg-background` with `text-foreground` and moves `text-accent-foreground` onto `hover:`, where it belongs.                                                                                                                                                                                                                                                                                                                         |
> | #28  | One procedure with no caller         | ✅ `getAllContentSections` deleted — router procedure, interface method and repository implementation.                                                                                                                                                                                                                                                                                                                                                            |
> | #36  | Lint warnings                        | ✅ **0 errors, 0 warnings.** The three `no-location-assign-relative-destination` hits are suppressed at each site with the reason recorded: a sign-out has to be a full page load so the Better Auth client session store resets.                                                                                                                                                                                                                                 |
> | #38  | Smaller notes                        | ✅ Nothing actionable remained. Two product decisions are left and are recorded as such, not as defects.                                                                                                                                                                                                                                                                                                                                                          |
> | #41  | `currency` defaults were `'USD'`     | ✅ Fixed at the source. See below — the real bug was not where this entry said it was.                                                                                                                                                                                                                                                                                                                                                                            |
> | #34  | The `worker` role does nothing       | ✅ **`worker` is now a read-only admin tier.**                                                                                                                                                                                                                                                                                                                                                                                                                    |
>
> ### #41 — the bug was in the migration, not the data
>
> Checking the live database changed the diagnosis. `src/db/schema.ts` declared
> `EGP`, but `drizzle/0000_long_ultragirl.sql` **and both snapshots under
> `meta/`** created those three columns as `'USD'`. So the same schema built two
> ways disagreed: `db:push` produced EGP, `db:migrate` produced USD. A database
> rebuilt for production through the migration path would have reintroduced the
> currency bug on day one.
>
> Fixed in the baseline and both snapshots, so both paths now agree. The three
> `SET DEFAULT 'EGP'` statements were also applied to the existing database —
> **zero rows touched**, defaults only. The backfill half of `0003` was
> deliberately **not** run: those 25 `USD` rows are seed fixtures with no
> payment rows, so rewriting them would assert a charge that never happened.
> `0003`'s header now says all of this.
>
> ### #34 — what "read-only admin" actually means here
>
> Two procedure tiers in `src/server/trpc.ts`:
>
> - `adminProcedure` — worker, admin, super_admin. Every admin **query**.
> - `adminWriteProcedure` — admin, super_admin. **32 of 35** admin mutations.
>
> The other three are `admin.notifications.{markAsRead,markAllAsRead,delete}`,
> left on the read tier on purpose: they only touch rows scoped to
> `ctx.user.id`, so a read-only worker keeps their own notification bell, and
> dismissing your own notification is not an edit anyone else can see.
>
> The role predicates moved to `src/domain/customers/value-objects/user-role.ts`
> because `auth-helpers.ts` imports `@/db` — leaving them there meant no client
> component could ask the question without pulling Drizzle into the browser
> bundle, which is why the UI previously had no way to reflect the role at all.
> `AdminReadOnlyBanner` and `useAdminWriteAccess` use them now.
>
> **The one way this can go wrong:** `adminProcedure` is the _permissive_ tier,
> so a new mutation that forgets `adminWriteProcedure` is writable by a worker,
> and nothing about that is a type error. `src/server/admin-write-gating.test.ts`
> is the guard — it scans the routers and fails if any mutation is on the wrong
> tier, if a query is over-gated, or if the scan itself stops matching.
>
> **What this does not buy, stated plainly:** a worker still reads every
> customer's address and order history. "Read-only" constrains writes, not
> scope. Splitting catalogue work from customer data is a larger change and was
> not taken. Individual write controls across the admin screens are also still
> rendered — the server rejects them and the banner explains why, but they are
> not yet disabled per control.

> ### Migrations — corrected
>
> This file and `CLAUDE.md` both describe `drizzle/` as "a single baseline,
> `0000_long_ultragirl.sql`, with one matching entry in `meta/_journal.json`".
> That is no longer true and the difference matters for a deploy:
>
> - `drizzle/` holds **four** files: `0000_long_ultragirl` (baseline),
>   `0001_glossy_scourge` (two composite indexes), `0002_search_trgm` (GIN
>   trigram indexes for the `ILIKE '%…%'` searches) and
>   `0003_backfill_currency`.
> - `meta/_journal.json` holds **two** entries — `0000` and `0001` only.
> - So `pnpm db:migrate` **will not run `0002` or `0003`**. Both are written to
>   be applied out of band (`pnpm db:push`, or pasted into the Neon SQL editor)
>   and both say so in their own header comments, but nothing outside those
>   files records it.
> - **Checked against the live database 2026-09-03**, so this is no longer a
>   guess:
>   - **`0001` IS applied.** `idx_orders_user_created` and
>     `idx_products_active_created` both exist. Every doc saying otherwise was
>     wrong, including the P2 performance note.
>   - **`0002` is NOT applied.** `pg_trgm` is not installed and no trigram
>     index exists. Correct, and deliberately not urgent — at 36 products a
>     sequential scan beats the index. It also needs privileges the app role may
>     not have; run it from the Neon SQL editor as owner.
>   - **`0003` is NOT applied, and its premise is wrong for this database.**
>     `drizzle.__drizzle_migrations` exists, the three `currency` column
>     defaults are still `'USD'`, and `orders` holds 19 EGP rows and 25 USD
>     rows. But **all 25 USD rows are Jan–Feb 2026 and none has a payments row**,
>     while all 19 EGP orders do — they are seed fixtures, not orders that were
>     charged. So the file's rationale ("charged EGP, recorded USD") does not
>     apply to them: nothing was charged at all. The half of `0003` that is
>     genuinely needed is the `ALTER COLUMN … SET DEFAULT 'EGP'`, because a
>     future insert that falls through the default still gets USD.
>
> `0002` is the one with a performance consequence: without it, product and
> customer search do a sequential scan. At the current catalogue size that is
> genuinely faster than an index, which is why it is not urgent — see the
> file's own header.

Verified baseline, re-checked 2026-09-02 on `docs/reconcile-issues-catalogue`: `pnpm type-check` clean, `pnpm lint` 0 errors / 3 warnings, **270/270** unit tests pass, `pnpm build` produces **98** static pages, and `pnpm audit` reports **0 advisories in both production and dev scopes**. Every open issue below is a runtime or design problem, not a compile error — which is exactly why they survived.

Coverage improved with the P2 work but is still narrow. `pnpm test` is unit-only and is all CI runs; `pnpm test:integration` adds repository and router tests against a real database, and is where the SQL introduced by the performance work is checked against the domain logic it replaced. There are still no component tests.

Issues 1-43 are the original catalogue and are the work in progress. [Pass 2](#pass-2--full-source-audit-deferred) is a later audit, numbered separately and deliberately not started — finish 1-43 first.

**Contents**

- [Resolved](#resolved) (19)
- [Follow-ups — residue from the P0/P1 work](#follow-ups--residue-from-the-p0p1-work) (2, both resolved ✅)
- [P1 — Features that are broken or missing](#p1--features-that-are-broken-or-missing) (1, resolved ✅ — section now empty)
- [P2 — Performance](#p2--performance-) (5, all resolved ✅)
- [P3 — Cleanup](#p3--cleanup) (15, of which 5 remain open: #28, #34, #36, #38, #39, #41)
- [Pass 2 — full-source audit, deferred](#pass-2--full-source-audit-deferred) (14, of which 2 remain open: P2-6, P2-7)
- [Security — 2026-09-02 hardening pass](#security--2026-09-02-hardening-pass)
- [Suggested order of work](#suggested-order-of-work)

---

## Security — 2026-09-02 hardening pass

A full read of the request surface: every route handler, every tRPC router, the auth configuration, both payment paths, the repositories under them, and the dependency tree. Branch `security/hardening-pass`.

### What the read did _not_ find

Worth recording, because these are the places an e-commerce codebase usually leaks and this one does not — and because each is a property that is easy to break later.

- **No SQL injection surface.** Every `sql` template interpolates through Drizzle's parameter binding; there is no `sql.raw` and no `db.execute` with string concatenation. LIKE metacharacters are escaped with an explicit `ESCAPE` clause (`domain/shared/like-pattern.ts`).
- **No XSS sinks.** No `dangerouslySetInnerHTML`, `eval`, or `innerHTML` anywhere in `src/`. The only untrusted-string-into-DOM path was the `href` issue fixed below.
- **Prices are never client-supplied.** Cart lines carry ids and quantity only; the price is resolved from `products` at read time, the subtotal is computed in `CreateOrderUseCase`, and the coupon is re-validated against that subtotal. Stripe is charged from the persisted order.
- **Stock cannot be oversold.** `DrizzleOrderRepository.create` locks each variant `FOR UPDATE` in a fixed id order inside the order transaction.
- **Ownership is checked consistently.** Addresses on every read and write and again at order creation; `orders.getOrderById`; `checkout.confirmSession` before it touches the order behind a Stripe session id; notifications scoped by `(id, userId)`.
- **All 14 admin routers use `adminProcedure`**, behind three independent gates (edge cookie check, `admin/layout.tsx` role check, `adminProcedure`).
- **The Stripe webhook verifies its signature first** and fails closed without `STRIPE_WEBHOOK_SECRET`; `markAsPaid` is idempotent, so a replay does not double-notify or double-redeem.
- **No committed secrets.** `.env*` is gitignored, nothing secret-shaped is tracked, `STRIPE_PUBLISHABLE_KEY` is deliberately not `NEXT_PUBLIC_`, and no client component reads `process.env` at all.
- **CSRF** is covered by Better Auth's default `SameSite=Lax` session cookie. No route sets `sameSite: "none"`; if one ever does, the tRPC endpoint needs an origin check, because it has none of its own.

### Fixed

#### S1. Dependencies were audited against truncated output ✅

The previous pass read a `pnpm audit --json` that had been cut off mid-object and acted on the three advisories it happened to contain, leaving `pnpm-workspace.yaml` with an override (`next@>=16.0.0-beta.0 <16.0.9`) written for an advisory that had already been superseded. The full list was **69 production advisories**, including two **critical** ones in `better-auth` — the authentication library itself.

**Fixed.** `better-auth` 1.4.7 → 1.7.2 (both criticals), `next` 16.0.8 → 16.3.4 (all 23), `drizzle-orm` → 0.45.2, `vitest` → 4.1.11 — that last one is a devDependency, but `better-auth` pulls vitest into the production graph, so the bump alone did not clear it and an override was needed too. 24 overrides in total, each carrying the advisory id it exists for.

**Result: 0 advisories in both scopes** — production went 69 → 0, and the dev tree (eslint, eslint-config-next, commitlint) went 27 → 0. Most of the dev ones cleared with `pnpm update --depth Infinity` inside their existing ranges; only `minimatch` and `brace-expansion` needed overrides, scoped to their major line so the 1.x/3.x copies elsewhere are left alone — forcing those onto a new major breaks eslint rather than securing it.

**Still true** `pnpm audit` output is long enough to be truncated by tooling that reads it. Re-run it in full — `pnpm audit --prod --json` written to a file, not piped into something with a display limit — before believing any summary of it, including this one.

#### S2. The login form handed out email addresses ✅

`public.auth.getEmailByPhone` was a `publicProcedure` that took a phone number and returned the email address of the account using it. It was the phone→email step of the login form, and it answered for anybody. Egyptian mobile numbers are a small enumerable keyspace (`+201[0125]XXXXXXXX`), and the response distinguished "there is an account" from "there is not" — precisely the oracle `sendResetPassword` is deliberately _not_.

**Fixed.** Replaced with `public.auth.signIn`, which takes `identifier + password`, classifies the identifier server-side (`PhoneValueObject.looksLikePhone`), resolves the email internally, signs in through `auth.api.signInEmail`, and forwards the resulting `Set-Cookie` onto the tRPC response. Every failure — unknown phone, unknown email, wrong password, unparseable identifier — returns one message. Rate-limited twice: per IP, and per normalised identifier, because no per-IP budget catches a distributed attack on one account.

**Still true** `auth.api.*` bypasses the Better Auth handler and therefore its own `rateLimit.customRules`. The two Upstash limits in that procedure are not defence in depth — they are the only throttle on the path. The login form now does a full-page navigation on success, because the session was established by a tRPC response rather than the Better Auth client, which leaves the client's session store holding its signed-out value.

#### S3. Open redirect after sign-in ✅

`LoginForm` and `SignupForm` passed `?redirect=` straight to `router.push`, which hard-navigates off-origin. `src/proxy.ts` writes that parameter itself, so `/login?redirect=https://evil.example` is a URL shaped exactly like a real one — and it fires at the moment a person has just typed a password.

**Fixed.** `safeRedirect` in `src/lib/safe-url.ts`; same-origin paths only.

**Still true** The interesting inputs are the ones where a hand-written check and a browser disagree — `//evil.example`, `/\evil.example` (backslash is a slash to a special-scheme parser), and tab/newline smuggling, which the parser strips _before_ parsing. That is why the check resolves against a sentinel origin instead of pattern-matching. `safe-url.test.ts` asserts all three against both exported functions from one shared list.

#### S4. CMS content could inject a `javascript:` link ✅

`heroContentSchema.ctaLink` and `announcementMessageSchema.link` were bare `z.string()`, and both render as `<Link href={…}>` — the hero on the home page, the announcement bar on **every** storefront page. React does not block a `javascript:` href. Admin-only to write, but it executes for every visitor, so it turned one compromised admin account into site-wide XSS.

**Fixed** on both sides. Written: both fields now use `urlOrAssetPath`, which already existed two files away. Rendered: `safeHref` in `src/lib/safe-url.ts`.

**Still true** The render-side guard is not belt-and-braces. `ServerHeroSection` and `AnnouncementBarClient` read `JSON.parse(section.content)` and spread it over their defaults **without a Zod parse**, so rows written before the schemas were tightened still arrive unvalidated. Any new field on those objects that ends up in an `href`, `src`, or `style` needs the same treatment.

#### S5. CSP was report-only with nowhere to report ✅

The policy blocked nothing and recorded nothing — the one configuration that achieves neither. The comment described watching the reports for a few days, which was impossible.

**Fixed.** Split. `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` and `form-action 'self'` are now **enforced** — none can break this app. `script-src`/`style-src` stay report-only, because tightening them needs Next's nonce support wired through the layout. `/api/csp-report` collects violations so the promotion is a matter of reading logs rather than guessing.

**Still true** `'unsafe-inline'`/`'unsafe-eval'` in `script-src` are still there and are the reason that half is not enforced.

#### S6. Session revocation lagged five minutes ✅

`cookieCache.maxAge` was 300s and the role cache 60s, so a sign-out, a revoked session, or a deleted account kept working for up to five minutes — nothing reads the `session` table while the cookie is live.

**Fixed.** 60s, matching `ROLE_CACHE_TTL_MS`, so revocation and demotion now take effect on one timescale rather than two that have to be reasoned about together. The cost is one query per active user per minute.

#### S7. Unbounded and unthrottled endpoints ✅

`apiRateLimiter` existed and was wired to exactly one endpoint.

**Fixed.** `enforceRateLimit` in `server/utils/rate-limiter.ts` collapses the check-then-throw pair that made adding a limit look like more work than it was, and is now applied to `products.search`, `reviews.create` (keyed by user) and the CSP collector, as well as the newsletter subscribe it already had. Bounds added: search terms `max(100)`, `reviews.getByProduct` paginated in SQL, cart line quantity `max(100)`.

**Still true** Reading the client IP is not an auth lookup, so throttling a `publicProcedure` does not mark the request as having touched auth and its response stays publicly cacheable. That also means the limiter only ever sees requests a shared cache could not answer.

#### S8. Smaller integrity fixes ✅

- `coupons.discountValue` was a bare `z.string()`, so `"abc"` saved and then reached `parseFloat` in `ValidateCouponUseCase` — a NaN discount on a NaN order total. Now a validated decimal string, greater than zero.
- `NODE_ENV=development` was pinned in `.env`. Nothing in the codebase reads it and Next sets it per command; in a deployment it would have turned on tRPC stack traces. Removed (a copy of the original is at `.env.bak.pre-security-pass`).

### Accepted, not fixed

- **`admin` and `super_admin` are identical** in every gate — `isAdminRole` treats them the same — and the `worker` role in the enum is checked nowhere. There is no separation between "can edit products" and "can read every customer's address and order history". This is a role-model design decision, not a patch; it belongs with #34 rather than in a hardening pass.
- **`getClientIp` trusts the first `x-forwarded-for` hop.** Correct on Vercel, which sets that header itself. On any host that does not, it is spoofable and every per-IP limit above becomes advisory. If this ever leaves Vercel, that function is the thing to revisit first.
- **Sign-up does not require email verification** (`requireEmailVerification: false`), so an account can be created against an address the person does not control. Deliberate, and it is what makes the storefront usable without a mail round trip — but it is why a review's "verified purchase" badge is earned from an order rather than from an email.

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

**Fixed** in `a75d98e` by regenerating rather than deleting. `drizzle/` became a single baseline — `0000_long_ultragirl.sql`, 27 tables, one journal entry — matching `src/db/schema.ts`. `db:generate` and `db:migrate` are real commands again.

**No longer accurate, 2026-09-02** — and this sentence is where the wrong description in `CLAUDE.md` came from. `drizzle/` now holds **four** files and the journal holds **two** entries, so `db:migrate` silently skips `0002_search_trgm` and `0003_backfill_currency`. See the migrations note in the verification block at the top of this file.

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

### 9. The SKU an admin typed was discarded ✅

`DrizzleProductRepository.create()` wrote `sku: product.slug`, so the SKU the form required, validated and checked for uniqueness was thrown away. `ProductEntity` had no `sku` property at all, so the value had nowhere to travel. Renaming a slug later did not update the SKU, so the two drifted apart silently.

**Fixed** by giving the value somewhere to live: `ProductEntity.sku` (`product.entity.ts:24`) carries it from the use case to the repository, which now writes `sku: product.sku`. The duplicate uniqueness check that ran against the _slug_ — and reported a `DuplicateSKUException` naming the wrong string — is gone, and SKU is an editable field on the edit form. Validation is bounded at `.max(100)` to match the column, on every input path.

**Still true** SKU uniqueness is only checked when the value changes, so a product cannot collide with itself. Variant SKUs are trimmed in the use case and the product SKU is trimmed on create — keep both, or they diverge again.

---

### 10. A sale price could never be removed ✅

The edit form sent `salePrice ?? undefined`, and `undefined` correctly means "keep existing" in a partial update.

**Fixed** on both sides: the form sends `null` (`ProductEditForm.tsx:128`), and the router's update schema widened to `z.number().positive().nullable().optional()` (`products.ts:81`) so `null` survives validation and reaches the use case as "clear it".

---

### 11. Nothing ever created a notification ✅

Both tables, both repositories, both routers and both bell dropdowns were complete, and no code anywhere called `create()` or `createMany()`. Both bells always showed zero.

**Fixed** with one writer rather than scattered inserts: `NotificationService` (`src/application/notifications/notification.service.ts`) is the only thing that writes either table, and is injected into `CreateOrderUseCase`, `UpdateOrderStatusUseCase`, `RefundOrderUseCase`, `AdjustStockUseCase`, the review router, the signup hook, the Stripe webhook and the success page.

**Still true** **Every emit swallows its own failure** and logs `[Notifications] <label> failed:`. That is the safety contract — an order must never fail over a courtesy message — but it means a broken emit is invisible in the UI. If a notification does not appear, read the server log before reading the code. Two further traps: admin notifications are per-admin-user rows fanned out in one insert, so a new admin gets no backlog; and low stock fires on the **crossing**, not the level, so an already-low variant does not notify on every subsequent sale.

**A gap that survived the first pass:** a _partial_ return is not a status change, so `orderStatusChanged` never fired for it and refunds notified nobody. `NotificationService.orderRefunded()` now handles returns separately, reporting the money moved by that return rather than the running total.

---

### 12. The Featured settings tab controlled nothing ✅

The admin curated into `featured_items` and the homepage read `products.isFeatured` and "the first three active categories". The Add button had no handler, the search box filtered nothing, and the "drag to reorder" tip described behaviour that was never built.

**Fixed** by adopting `featured_items` as the source of truth — the first of the two options originally offered. `resolveFeaturedProducts` and `getCachedFeaturedCategories` (`src/lib/cache.ts`) read the curated list, and the tab gained working search, add, remove and up/down reorder. Every write drops the cache tag, so the homepage updates within a second rather than after 60.

**Still true** The fallback is load-bearing: an empty curation — **or one whose every item has since been deactivated** — falls back to the `isFeatured` set and the first three active categories. The section must never render its heading above an empty grid. The first implementation checked the raw list rather than the resolved one and got this wrong.

---

### 13. There was no way to manage categories ✅

Categories were seed-only. `admin.categories.list` existed purely to fill the product dropdown; `create`/`delete` had no UI and `UpdateCategoryUseCase` was reachable from nothing.

**Fixed** with `/admin/categories` — table plus create/edit dialog plus guarded delete. Both fixes the entry asked for are in: slug generation goes through one shared `slugify` (`src/domain/shared/slug.ts`), and `DeleteCategoryUseCase` refuses to delete a category with children or products, so a parent can no longer orphan its rows through the missing FK.

**Still true** `categories.parentId` still has **no FK constraint** — the guard is application-level, so anything writing outside the use case can still orphan children. Category delete is still **hard** while products soft-delete. The delete guard and the table's product count both count archived products on purpose: a table reading "0 products" beside a server that refuses would just look broken.

---

### 14. `/forgot-password` did not exist ✅

An empty directory linked from two live buttons — the login form and the profile's "Change Password" card. Both 404'd. The backend half (`sendResetPassword`, `sendPasswordResetEmail`) was already written.

**Fixed** with both pages, and `passwordResetRateLimiter` — defined and unused — is now wired in `src/lib/auth.ts:45`.

**Still true** The request form answers **identically** for a registered and an unregistered address, deliberately: a different response would let a stranger test which addresses have accounts. Do not "improve" that into a helpful error. Rate limiting no-ops without `UPSTASH_*`, so it will not trigger locally.

---

### 15. One of the two stock-editing paths skipped the audit log ✅

Editing stock on the product page wrote the number straight to the variant; editing it on the Inventory page logged. The history was silently incomplete.

**Fixed** at the schema boundary rather than by adding a second logging call: `admin.variants.update` **no longer accepts `stockQuantity` at all**, and stock moves through `AdjustStockUseCase` on every path, writing an `inventory_logs` row with the author and a reason.

**Still true** Creating a _new_ variant with an opening stock figure writes no log row — that is an opening balance, not a movement. Every change after it is logged.

---

### 17. Currency was inconsistent in four places ✅

Stripe charged `egp`, the order repository wrote `EGP`, `site_settings.currency` defaulted to `USD`, and every price in the UI was rendered with a hardcoded `$`. Customers in Egypt were billed in pounds and shown dollars.

**Fixed** by making currency **deployment configuration** rather than a database setting: `src/lib/currency.ts` exports `STORE_CURRENCY` (`NEXT_PUBLIC_STORE_CURRENCY`, default `EGP`), `STRIPE_CURRENCY`, and one `formatCurrency` used by every price display. A Stripe account is bound to the currency it charges in and every stored price is already denominated in it, so switching is a migration, not a dropdown — the Settings dropdown that implied otherwise is now a read-only row.

**Still true** Four admin displays still hardcode `$` — see #40 — and rows written before this change still say `USD` — see #41.

---

### 18. Wishlist stock status was not stock ✅

`WishlistItemEntity.inStock` came from `products.isActive`, so a sold-out product showed as in stock.

**Fixed** in two halves. The repository sums `stockQuantity` across available variants in **one grouped query for the whole page**, not one per row, and requires `isActive` _and_ stock. The grid then had to be taught to read it — for a while `inStock` was correct and every card still rendered the same "Choose Options" button. Out-of-stock cards are now dimmed, badged, and their button disabled.

**Still true** The item stays on the wishlist while sold out. That is the point of a wishlist; do not "tidy" it away.

---

### 19. Reviews were never marked as verified purchases ✅

`isVerifiedPurchase` was hardcoded `false` and `reviews.orderId` was always null, so the badge could never appear.

**Fixed** by looking for an order by this user containing this product before inserting, and storing the `orderId` alongside the flag (`public/reviews.ts:77,91`).

**Still true** Only `paid`, `processing`, `shipped` and `delivered` count. A purchase that came undone — cancelled or refunded — does not earn the badge.

---

### 20. A failed image or variant save left a half-created product ✅

The browser created the product, then looped through images and variants one request at a time, each in its own `try/catch` that only raised a toast — and redirected anyway.

**Fixed** by accepting `images` and `variants` as arrays on `admin.products.create` and persisting all three in one server-side transaction.

**Still true** The **edit** page still saves images and variants one at a time, on purpose: there each change is its own deliberate action, not part of building one object.

---

Work done in the same period that this file never catalogued — partial returns with derived refund totals, the payment expiry window and stale-checkout sweep, coupon-scaled refunds, and order numbers and customer names in the admin — is documented in `docs/P0-TEST-PLAN.md` instead.

---

## Follow-ups — residue from the P0/P1 work

Not part of the original catalogue. These were found by reading the finished P0
and P1 work back against the code, and each one exists **because** of a fix
rather than in spite of it — a change applied to one screen and not its
sibling, or a split that was right in principle and left a seam. They are
listed apart from P1-P3 so it stays obvious that the fix is nearly done rather
than not started.

### 42. The customer order detail page never received the P0/P1 order work ✅

**Verified fixed** 2026-09-02 — `public.orders.getOrderById` now returns `orderNumber`, `refundedAmount()`, `refundedItems`, `fullyRefunded`, `awaitingPayment` and `paymentDeadline` — the same projection the list endpoint returns, so the two screens can no longer disagree.

**Where** `src/server/routers/public/orders.ts:106-118` (`getOrderById`), and the four components it feeds: `account/order-detail/OrderDetailHeader.tsx:38`, `OrderItems.tsx:30`, `OrderSummaryCard.tsx`, and the page itself at `src/app/(main)/account/orders/[id]/page.tsx`.

**What happens** Order numbers, partial returns and the payment window were all fixed thoroughly on the **admin** order screens and on the customer order **list**. The customer order **detail** page was missed, so five things the rest of the app knows are invisible on the one screen a customer opens to check an order:

1. **The order number is missing.** The header renders `Order #{orderId.slice(-8)}` — a UUID fragment. The list one click earlier shows the real `VLK-YYYYMMDD-XXXXXX`, so the same order has two identities depending on the screen, and the number a customer would quote to support is on the wrong one.
2. **No refund information at all.** `OrderSummaryCard` takes subtotal/shipping/tax/discount/total and nothing else, so a partly returned order looks untouched. This is precisely the defect the admin orders list fixed — a return is not a status change, so without an explicit signal there is nothing to see.
3. **Per-line returns are missing.** `OrderItems.tsx:30` renders `Qty: {item.quantity}` — the same string the admin items card showed before it was taught to say "1 of 3 returned · 2 still with the customer". `item.refundedQuantity` is already in the payload, unread.
4. **No payment window countdown,** though the list has one — and the detail page is where someone would sit while paying.
5. **`shippingAddress` is fetched and never rendered.** It is in the payload; the page renders header, timeline, items and summary, and no address.

**Why** `getOrderById` returns a hand-written subset of the entity that predates all of this work, and nothing forces it to keep up: `orderNumber`, `refundedAmount()`, `getRefundedItems()`, `isFullyRefunded()`, `isAwaitingPayment()` and `paymentDeadline()` are all on `OrderEntity` and simply are not selected. That the checkout success page needs a whole separate `getOrderNumberById` query is the same omission showing through somewhere else.

**Fix** Widen `getOrderById` with `orderNumber`, `refundedAmount`, `refundedItems`, `fullyRefunded`, `awaitingPayment` and `paymentDeadline` — the same fields `getMyOrders` already returns — then update the four components. Doing so also makes `getOrderNumberById` redundant for anything but the Stripe-session lookup.

**Not affected, checked:** the customer `OrderTimeline` is driven by dates rather than status, so it never had the `confirmed`/`paid` drift the admin timeline did.

---

### 43. Saving a variant is two mutations, not one transaction ✅

**Verified fixed** 2026-09-02 — `admin.variants.update` takes `stock` as an optional sibling of `data`, so one save is one request. Stock still routes through `AdjustStockUseCase`, so the audit row survives.

**Where** `src/components/admin/products/create/VariantsSection.tsx:60-77`, `src/server/routers/admin/variants.ts`

**What happens** A side effect of #15. Variant metadata and stock are now deliberately separate operations — stock has to carry an author and a reason, metadata does not — but the form calls `admin.variants.update` and `admin.variants.updateStock` one after the other from the browser. If the second fails you get an error toast with the metadata already saved: the same shape as the create-product bug fixed in #20, at a smaller scale.

**Fix** The split itself is right and should stay. Either fold both into one server-side operation that writes metadata and calls `AdjustStockUseCase` inside a single transaction, or make the form save them as two visibly separate actions so a partial save is not a surprise.

**Checked while here:** `admin.variants.updateStock` does route through `AdjustStockUseCase`, so there is no unaudited stock path — #15 holds.

---

## P1 — Features that are broken or missing

Ten of the original eleven are in [Resolved](#resolved), keeping their numbers. One is left.

### 16. The confirmation email quotes a made-up order number ✅

**Verified fixed** 2026-09-02 — `SendOrderConfirmationUseCase` builds the email from the order — the real `VLK-` number and the resolved address — and **both** payment paths call it, so cash-on-delivery is covered too. This file called it "the one real feature gap" for a pass after it had been fixed.

**Where** `src/app/api/webhook/stripe/route.ts:93,104`

**What happens** The Stripe order-confirmation email shows an order number derived from the Stripe session id (`session.id.slice(-12).toUpperCase()`), which matches nothing the customer can look up, and prints the literal string "Address will be confirmed separately" in place of the shipping address. COD orders get no confirmation email at all.

**Why** The handler builds the email from the Stripe session rather than from the order it just updated — even though `metadata.orderId` is right there.

**Fix** Load the order by `metadata.orderId` and send the real `orderNumber`, real line items, and formatted address. Both halves are already on the entity — `orderNumber` is read back on every load and `shippingAddress` is a resolved `OrderAddress`, not an id — so this is now a matter of using them. Move the send into a small `SendOrderConfirmation` helper and call it from the COD path too, so both payment methods behave the same.

**Deferred on purpose**, not forgotten: it is waiting on a real domain being verified in Resend, so it can be tested end to end rather than merely compiled.

**Added 2026-08-31:** the COD half is worse than "no email". `src/app/(main)/checkout/success/page.tsx:83` tells every customer — on both payment paths — "You'll receive a confirmation email shortly". For COD that is a promise the system cannot keep, and it is shown before the deferred fix lands. Either send the COD email as part of this, or make the success copy conditional on the payment method in the meantime.

---

## P2 — Performance ✅

**All five resolved 2026-08-31**, together with P2-9 and P2-11 from the Pass 2
list and two problems found while measuring. Verified against the live database
and in a real browser, not by reasoning about the code.

Measured on the actual data (36 active products, 516 variants, 13 categories),
best of three runs:

| Path                            | Before  | After  |           |
| ------------------------------- | ------- | ------ | --------- |
| Storefront product grid, page 1 | 2877 ms | 472 ms | **6.1×**  |
| Product search                  | 1281 ms | 456 ms | **2.8×**  |
| Category list with counts       | 1566 ms | 150 ms | **10.4×** |

### 21. Product and order lists fetch every row, then slice ✅

`ProductFilters` and `OrderFilters` gained `offset`, and both repositories now
apply `limit`/`offset` in the query. `ListProductsUseCase`, `ListOrdersUseCase`,
`public.products.list` and `getMyOrders` each fetch one bounded page and run
`count(filters)` beside it in `Promise.all`, rather than loading the filtered
table and slicing.

`ListOrdersUseCase`'s two derived filters were the reason it could not paginate:
refundability and return state are computed on the entity, so a page could only
be cut after every matching order was loaded. Both are now SQL — `returnedOnly`
is an `EXISTS` over `order_items.refunded_quantity`, and `refundableOnly`
mirrors `canRefund()` against the order's payment row. **Note the assumption**
that an order has exactly one payment row, which `create()` guarantees today; if
that ever changes, the predicate needs the same "latest row wins" rule
`mapToEntity` applies.

### 22. Search re-implements in JavaScript what the repository already does in SQL ✅

Resolved by moving search _into_ `ProductFilters` rather than by calling the old
`search()` method — a separate method could not compose with `limit`/`offset`,
which is what made the JavaScript version tempting in the first place. The
now-genuinely-duplicate `DrizzleProductRepository.search()` is deleted, along
with its interface declaration.

`gender` and `isOnSale` moved to SQL in the same change; they were the other two
filters applied in JavaScript after the fetch. LIKE metacharacters in the query
are escaped, so searching for `50%` no longer matches the whole catalogue.

### 23. Category product counts issue one full table scan per category ✅

Both remaining callers now use the `countProductsByCategory()` that already
existed: `public.categories.list` and `public.categories.getFeatured`.
`getFeatured` also stopped issuing a `findById` per curated item — it batches
through `findByIds` and re-applies the admin's order.

`getBySlug` was a third instance nobody had catalogued: it returned **every
product in the category** so the page could read `category.id`, then handed that
id to `InfiniteProductGrid`, which queried the products again with pagination.
It returns a count now.

### 24. The dashboard fetches customer names one query at a time ✅

`getRecentOrders` uses a single `leftJoin` on `user`. Guest orders (`user_id` is
null) and orders whose account was deleted are distinguished rather than both
reading "Unknown".

### 25. "My orders" loads 1000 orders per page request ✅

Paginated in SQL like the rest. The expired-checkout sweep in front of it is no
longer awaited: it makes Stripe API calls, so awaiting it put a third-party
round trip ahead of every "My orders" load and every admin order list. It is now
`void`-ed on both, exactly as the cart's stock check already did — the use case
throttles itself to once a minute per process and swallows its own errors, so
the cost of not waiting is that a just-expired order may show as pending until
the next load.

### 44. Every product card ran its own live-stock query ✅

Found while measuring, and the single largest cost on the storefront.

`useVariantStock` keys its query on the variant ids it is handed, and every
`ProductCard` renders a `QuickAddSliderBar` that calls it with _that card's_
variants — so each card had its own query key, its own request and its own
`refetchInterval`. A twelve-card grid called `getStock` twelve times on load and
twelve more every fifteen seconds, forever, growing as the customer scrolled.
The hook's own docstring promised "one cached copy shared by every component";
that is what was missing.

`VariantStockProvider` (`src/components/providers/variant-stock-provider.tsx`),
mounted once in the storefront layout, ref-counts the ids cards register and
serves them all from one query. **Verified in a browser:** `/collections/all`
now issues a single `getStock` request carrying all 131 variant ids, and a
single request per poll.

The refresh interval is deliberately still fifteen seconds, so this is purely a
reduction in how many requests are made and not in how fresh the answer is.

### 45. The footer queried the database on every storefront page ✅

`getCachedSiteSettings` existed in `src/lib/cache.ts` with **no callers**. The
`Footer` — which renders on every page of the site — called
`siteConfigRepo.getSiteSettings()` directly, uncached, while the announcement
bar beside it used the cached path all along. The footer now reads through the
cache, and `admin.settings.updateSiteSettings` calls
`revalidateTag("site-settings")` so a save still shows up immediately.

### 46. React Query had no defaults, so navigation refetched everything ✅

The `QueryClient` was constructed bare: `staleTime: 0` refetches on every mount
and `refetchOnWindowFocus` refetches again on every tab switch. Defaults are now
30 s stale time, no refetch on focus, one retry. Anything needing to be fresher
sets its own values, which still win.

### 47. Images bypassed the optimiser entirely ✅

Every storefront `<Image>` passed `unoptimized`, so the homepage hero served a
full 1920×1080 original as the LCP element with no `sizes` attribute, and each
product card downloaded the original behind a 300 px slot.

`src/lib/image-hosts.ts` now holds the host list `next.config.ts` builds its
`remotePatterns` from, plus the narrower set actually routed through the
optimiser, so the two cannot drift. AVIF/WebP and a 30-day optimiser cache are
on; the hero has `sizes="100vw"` and `fetchPriority="high"`; the first row of
each collection grid is eager rather than lazy.

**`picsum.photos` is deliberately excluded from optimisation.** Optimising means
Next fetches server-to-server, and picsum answers those with 503 — verified
against the live host after the first attempt broke the seed imagery, not
assumed. It is placeholder data; real uploads go to `utfs.io`, which is
optimised. Below-the-fold homepage grids were left lazy on purpose so they do
not compete with the hero for LCP.

### Still open in this area

`ILIKE '%term%'` cannot use a btree index, so search is a sequential scan. Fine
at 36 products; if the catalogue grows into the thousands this wants a `pg_trgm`
GIN index, which means enabling the extension.

The collection pages remain fully client-side — the customer waits for the JS
bundle and then a round trip before any product appears. Server-rendering the
first page would remove that, and is a real refactor rather than a tuning change.

---

## P3 — Cleanup

### 26. Five value objects are written and never used ✅

**Verified fixed** 2026-09-02 — Four value objects remain on disk (`category-slug`, `password`, `phone`, `order-status`) and all four have importers. `Money`, `Email`, `ProductSKU` and `AddressValueObject` are gone.

`Money` (190 lines), `Email`, `PasswordValueObject`, `ProductSKU`, `AddressValueObject` have no importers. Only `PhoneValueObject`, `CategorySlug`, and `OrderStatus` are wired in.

Either adopt them or delete them. Two are worth adopting:

- **`PasswordValueObject`** enforces uppercase, lowercase, digit, and special character. The signup form (`SignupForm.tsx:73`) only checks length ≥ 8, so the documented policy is not enforced anywhere. Use `PasswordValueObject.validate()` in the form (it returns a strength score suited to a meter) and enforce it server-side.
- **`Money`** would fix the float arithmetic currently used for every total.

### 27. Dead components ✅

**Verified fixed** 2026-09-02 — `ProductSidebar`, `CreateProductHeader`, `AddToCartButton` and `CollectionPageLayout` are all deleted, as are the byte-identical `account/AddressList.tsx` and `account/AddressFormDialog.tsx` duplicates.

- `ProductSidebar` — a mockup with dead buttons. `AdditionalDetailsSection` was the other half of this pair and has since been salvaged: it is imported by both `CreateProductForm` and `ProductEditForm`, and its inputs are the fields that #1 used to destroy.
- `CreateProductHeader`, `AddToCartButton`, `CollectionPageLayout` — no importers.
- `src/components/account/AddressList.tsx` and `AddressFormDialog.tsx` are **byte-identical** duplicates of the copies in `account/addresses/`; only the nested pair is imported. Delete the flat pair.

### 28. Unreferenced tRPC procedures

**Re-checked 2026-09-02 — down to one.** `admin.settings.getAllContentSections` is the only procedure left with no caller.

Everything else on the 2026-08-31 list is resolved. **Deleted:** the entire `public.config` router, `public.categories.getFeatured`, `public.products.{getBySlug,getFeatured}`, `admin.products.getBySlug`, `admin.notifications.clearAll`. **Now called:** `public.categories.list` (four consumers) and `admin.settings.{getContentHistory,revertToVersion}` (`ContentHistoryDialog`).

**No longer on this list:** `admin.categories.{create,delete}` (the Categories page calls both — #13), `admin.variants.updateStock` (`VariantsSection.tsx:75`), and `admin.settings.{addFeaturedItem,updateFeaturedItems,reorderFeaturedItems}` (the Featured tab calls all three — #12).

The rest are collateral from the homepage moving to server components. The history procedures are worth wiring rather than deleting — see #29.

### 29. Four of six CMS section types are unreachable ✅

**Verified fixed** 2026-09-02 — `contentSchemaMap` holds only `hero` and `announcement`. The four unreachable types were deleted rather than wired — the decision this entry asked for was taken.

`promo_banner`, `brand_story`, `newsletter`, and `instagram` have Zod schemas, DB rows, seed data, and a public API — but `PromoBanner`, `BrandStory`, and `NewsletterSection` use hardcoded default props, and `HomepageSettings` only edits `hero` and `announcement`.

Either add editors and read the content (the pattern is `ServerHeroSection` + `getCachedHeroSection`), or delete the four schemas and their seed rows.

The **content version history** is the more valuable orphan: `content_sections_history`, `getContentHistory`, and `revertToVersion` are fully implemented and have no UI at all. A version list with a Revert button in `HomepageSettings` is a small amount of work for a feature that already exists end-to-end below the surface.

### 30. Most site settings are decorative ✅

**Verified fixed** 2026-09-02 — All six named settings (`logoUrl`, `faviconUrl`, `storeTagline`, `defaultMetaTitle`, `contactEmail`, `contactPhone`) now have consumers.

Only `storeName` and the four social URLs are consumed, both in `Footer`. Read by nothing: `logoUrl` and `faviconUrl` (Navbar and Footer hardcode `/logo/VAL-LOGO.png`), `storeTagline`, `defaultMetaTitle` and `defaultMetaDescription` (`src/app/layout.tsx` hardcodes its metadata), `contactEmail` and `contactPhone` (`ContactInfo` hardcodes `support@valstore.com` and a US phone number).

Fix by consuming them: `getCachedSiteSettings()` already exists, so the Navbar, Footer, root `generateMetadata`, and contact page can each read from it with a fallback to the current hardcoded value.

### 31. Committed build artifacts ✅

**Verified fixed** 2026-09-02 — `git ls-files` matches no `build_output*.log`, `type_output.log` or `tmp/tsc_errors.txt`.

`build_output.log`, `build_output3.log`, `type_output.log`, and `tmp/tsc_errors.txt` are tracked in git. Delete them and add `*.log` and `tmp/` to `.gitignore`.

### 32. Dead links in the footer ✅

**Verified fixed** 2026-09-02 — `/careers`, `/size-guide`, `/sustainability`, `/press` and `/blog` all build as real routes.

`Footer.tsx` links to `/size-guide`, `/careers`, `/sustainability`, `/press`, and `/blog`. None exist. Build them or remove the links.

### 33. Two collection routes filter incorrectly ✅

**Verified fixed** 2026-09-02 — `/collections/new` drops the `isFeatured` filter and leans on the default `createdAt DESC`; `/collections/accessories` resolves a category and filters on it. Both files record the old behaviour in the past tense.

`/collections/new` filters on `isFeatured` rather than recency, and `/collections/accessories` applies no filter at all — it renders the full catalogue under an "Accessories" heading (its own comment admits this).

For "new", sort by `createdAt` desc, optionally with a recency window. For accessories, create the category and filter by `categoryId`.

**Added 2026-08-31, same area:** all six static collection routes (`men`, `women`, `new`, `sale`, `all`, `accessories`) take routing precedence over `[slug]`, so a real category created with any of those slugs is unreachable through its own page — including the `accessories` category the fix above asks you to create. Decide whether the static routes should survive at all, or become redirects into `[slug]`. Separately, `[slug]/page.tsx:21` calls `public.categories.getBySlug`, which returns **every product in the category**, purely to read `category.id` and `category.name` before handing off to a grid that queries again.

### 34. The `worker` role does nothing

It exists in the `user_role` enum, `UserProfileEntity.isWorker()`, and both `UserRole` type aliases, but no route or procedure checks it — `adminProcedure` only accepts `admin`/`super_admin`. Either give it meaning (an order-fulfilment view is the obvious one) or drop it from the enum.

### 35. Guest cart persistence is unreachable ✅

**Verified fixed** 2026-09-02 — `public.cart.mergeGuestItems` exists and `CartProvider` folds the local cart in at sign-in; the store keeps `clearSignedOutItems` for the other half. Only ids and quantities cross the wire — price and stock are re-resolved server-side.

`cart-store.ts` persists to localStorage and handles guest items, but `useCart().addItem` shows a sign-in toast instead of adding for unauthenticated visitors, so the guest branch never runs. Either implement guest carts properly (with a merge on login) or delete the guest handling in the store.

### 36. Five lint warnings

Down from seven — two went away with the webhook rewrite. What is left: unused imports in `src/app/admin/products/page.tsx` (`Plus`, `Button`), an unused `error` in `NewsletterSection` (which also swallows the real error), an unused `_width` in `product-image.entity.ts`, and an unused `protectedProcedure` import in `public/user.ts`.

### 37. Billing addresses do not exist ✅

**Verified fixed** 2026-09-02 — `addressSchema` carries `addressType: z.enum(["shipping", "billing"])`, and checkout takes a separate, required `billingAddressId` that `CreateOrderUseCase` verifies belongs to the caller.

`public.address.create` hardcodes `addressType: "shipping"` (`src/server/routers/public/address.ts:54`), and checkout passes the same address id for both shipping and billing (`create-order.use-case.ts:61-62`). The `addressType` enum and `orders.billingAddressId` column therefore carry no information.

Add a billing-address choice at checkout, or drop the distinction from the schema.

### 38. Smaller notes

- ~~`NEXT_PUBLIC_APP_NAME` is read by `ResendEmailService` but appears in neither `.env` nor `.env.example`.~~ **Done** — verified 2026-08-31, it is in `.env.example` under Store Configuration. The reverse case is now the live one: `STRIPE_PUBLISHABLE_KEY` is documented in `.env.example` and read by no file. It could not be used client-side anyway without a `NEXT_PUBLIC_` prefix, and the app uses Stripe's hosted Checkout, so drop it.
- `zod` is imported as both `"zod"` and `"zod/v4"` across the codebase. Pick one.
- `DrizzleOrderRepository.update()` throws "not implemented" — fine, but it satisfies an interface method that therefore lies about the contract. Remove it from `OrderRepositoryInterface`.
- The contact form is a placeholder (`ContactFormPlaceholder.tsx`). The admin orders list's "coming soon" filter button is gone — the toolbar's buttons all do something now.
- `src/domain/customers/entities/customer.entity.ts` and the phone-keyed `customers` table are written by the signup hook and read by nothing; `GetOrCreateCustomerUseCase` has no callers. Decide whether the phone-identity model is still wanted before building on it.

---

### 39. The storefront runs on the light palette

**Where** `src/app/globals.css:55` (`:root`), `src/app/layout.tsx:29` (`<body class="bg-black text-white">`)

**What happens** `:root` holds the **light** token set — `--background` is white, `--foreground` near-black — and the storefront overrides only `<body>`'s own colours, never the tokens. So every shadcn primitive that styles itself with a token renders light-on-dark on the storefront. Worse, anything Radix renders through a **portal** attaches to `<body>`, escaping even the admin's `ThemeProvider`.

This has now been hit five separate times and fixed five separate times: `AlertDialogContent` had `bg-background` with no `text-foreground` and rendered white-on-white in the admin; `CheckoutLoading` was two near-white `bg-muted` bars on black; `CheckoutOrderSummary`'s no-image tile was a white square; the notifications "Mark all read" button was a white pill (the `outline` variant is `bg-background`); and the applied-coupon chip used `dark:` variants that never apply, because the storefront sets no `.dark` class.

**Sixth and worst:** `ProductReviews.tsx`, on the customer-facing product page. Near-white `bg-muted` skeletons and panels, a light-grey bare `border` — and both of its Buttons on the default variant, which is `bg-primary text-primary-foreground`: near-black on near-white, so "Write a Review" and "Submit Review" were all but invisible. Fixed 2026-08-31 with explicit storefront colours; the root cause below is untouched.

**Fix** Stop patching call sites. Either give the storefront the dark token set (`globals.css` already defines `.dark`; the storefront wrapper would need the class, and portals would need it on an ancestor they actually inherit from), or define a storefront-specific token block. Until then, two rules — both now in `CLAUDE.md`: a surface must set **both halves of a pair** (`bg-background text-foreground`, `bg-popover text-popover-foreground`), and only style with tokens that exist.

### 40. Four admin displays still hardcoded a dollar sign ✅

#17 routed every price through `formatCurrency` and missed four: the revenue KPI (`AnalyticsKPICards.tsx:49`), both chart Y-axes (`RevenueTrendChart.tsx:73`, `SalesChart.tsx:139`) and the fixed-amount coupon value (`CouponsTable.tsx:129`). Both charts already formatted their _tooltips_ correctly — only the axis ticks were bare.

**Fixed** 2026-08-31. The axes needed a new `formatCurrencyCompact` (`src/lib/currency.ts`) — a full `EGP 1,234.00` per gridline is wider than the plot area, which is why those two survived the original sweep.

### 41. Order and payment rows written before #17 record the wrong currency

**Where** `src/db/schema.ts:336` (`orders.currency`), `:568` (`payments.currency`) — both `varchar(3) DEFAULT 'USD' NOT NULL`

**What happens** The repository now writes `STORE_CURRENCY` explicitly (`order.repository.ts:188,220`), but rows created before that fell through to the column default and say `USD`, while Stripe actually charged EGP. `site_settings.currency` has the same `USD` default.

**Impact today is nil** — nothing reads either column — but `docs/P1-TEST-PLAN.md` §9 asks you to verify them in Drizzle Studio, where old rows will read `USD` and look like a live bug.

**Fix** One backfill (`UPDATE orders SET currency = 'EGP' WHERE currency = 'USD'`, same for `payments`), and change the column defaults to match the store rather than leaving a default that is wrong for this deployment.

---

## Pass 2 — full-source audit, deferred

Found by reading the whole tree again on 2026-08-31 — every layer of `src/`, with
reference checks by grep for each "unused" claim and `diff` for each "identical"
one. **Nothing here is started, and none of it should be started before the
queue above is finished.** They carry their own `P2-n` numbering ("pass 2, item
n") so they never interleave with the 1-43 series; it is unrelated to the
"P2 — Performance" tier, which is a _kind_, not a pass.

Ten findings from that audit are **not** listed here because they were already
catalogued: the customer order detail page (#42), the confirmation email (#16),
footer dead links (#32), collection route filters (#33), category count scans
(#23), fetch-all-then-slice (#21, #25), the dashboard name N+1 (#24), unused
value objects and the unused `search()` (#26, #22), dead components and
duplicate address files (#27), unreferenced procedures (#28), and committed
build artifacts (#31). Three of those gained notes this pass — see #16, #33 and
#38.

The audit also confirmed eight areas as **sound**, which is the more useful half
of the result — the transactional core holds, and that is why every finding
below sits outside it. The two worth not re-reading the code for: order creation
locks variant rows with `FOR UPDATE` in a consistent sorted order on every path
that touches them, so concurrent checkouts cannot oversell or deadlock; and
`markAsPaid` is a conditional `UPDATE … WHERE status IN ('pending','processing')
RETURNING`, so the webhook and the success page can both call it and only the
one that actually transitions the row notifies. Also verified: the derived
refund model and its in-transaction bound check, the coupon lifecycle across
all four branches, the Stripe-before-cancel expiry sweep, ownership checks
everywhere outside P2-0, both rate limiters, and the single-source currency.

### P2-0. Notification read/delete never checks who owns the notification ✅

**Verified fixed** 2026-09-02 — `markAsRead`, `delete` and `deleteAll` on `DrizzleUserNotificationsRepository` all take a `userId` and filter on it.

**Where** `src/server/routers/public/notifications.ts:44,56`; `src/infrastructure/database/repositories/notifications/user-notifications.repository.ts:82,110`; the same shape on the admin side at `notifications.repository.ts:62,88`

**What happens** `markAsRead` and `delete` accept a notification id and pass it straight to a repository whose `WHERE` clause is `eq(userNotifications.id, id)` — the row's owner is never consulted. Any authenticated user holding another user's notification UUID can mark it read or delete it outright.

**Why** The sibling procedures on the same router scope correctly — `markAllAsRead` and `getUnreadCount` both filter on `ctx.user.id`. These two were written against the id alone and nothing forced the difference: `ctx.user.id` is in scope and simply unused.

**Impact** Bounded by needing to guess a UUID, so this is not an open door. It is still a missing authorisation check on a write path, and the admin variant lets one admin silently clear another's queue.

**Fix** Take `userId` as a second argument in both repositories and add it to an `and(...)`; pass `ctx.user.id` from all four procedures. A non-matching row then no-ops silently, which is the right behaviour — it leaks nothing about whether the id exists.

---

### P2-1. The previous account's cart survives sign-out in localStorage ✅

**Verified fixed** 2026-09-02 — `UserDialog` calls `useCartStore.getState().clearCart()` in its sign-out handler.

**Where** `src/lib/stores/cart-store.ts:123-128`; `src/components/account/AccountSidebar.tsx:36`, `src/components/layout/MobileMenu.tsx:188`, `src/components/UserDialog.tsx:32`; `src/components/providers/cart-provider.tsx:35-50`

**What happens** The cart store persists to `localStorage` under `valkyrie-cart-v2`, with `partialize` keeping `items` — product names, images, unit prices, quantities. No sign-out path clears it. All three handlers finish with a `window.location.href` redirect, and the full page load rehydrates the store from disk before any session check has run.

So on a shared browser the next person sees the previous account's cart lines once hydration completes. The navbar badge starts at 0 — the `useSyncExternalStore` guard added for the SSR mismatch — and then fills in with someone else's items, which makes it look like their own cart rather than a leftover.

**Why** `CartProvider` calls `setItems` only when a server cart _arrives_; there is no branch for `!isAuthenticated`, so for a logged-out visitor the stale cart is never displaced. The store's guest branch is unreachable (#35), which is why nothing else covers this.

**Fix** Call `clearCart()` before each of the three redirects, and clear in `CartProvider` when `isAuthenticated` goes false. Both, not either — the redirect path is the common case and the provider is the backstop.

**While you are there** `UserDialog.tsx:35` calls `localStorage.removeItem("user")`. Nothing in the codebase writes a `"user"` key; the only other `localStorage` writer is the announcement bar's dismiss flag. That line reads exactly like the cleanup that was meant to be this one.

---

### P2-2. Dashboard revenue counts orders that were never paid, and orders that were refunded ✅

**Verified fixed** 2026-09-02 — One shared definition in `infrastructure/database/queries/revenue.ts`. `SUM_NET_REVENUE` is what the dashboard and admin-customers both read, and it has integration tests.

**Where** `src/infrastructure/database/repositories/dashboard/dashboard.repository.ts:36` (`getMetrics`), `:79` (`getSalesTrend`), `:152` and `:164` (`getAnalytics`)

**What happens** All four revenue queries are `SUM(orders.total_amount)` over a date window with **no status filter at all**. A `pending` card order the customer abandoned counts. An order an admin cancelled counts. A fully refunded order counts at its original value.

Refunds never enter the figure anywhere. `order_items.refundedQuantity` is the single stored fact the whole return system derives from, and no dashboard query joins `order_items` to reach it — so the number an admin reads can include money that was taken and given back, alongside money that was never taken.

**Why** These queries predate both the refund model and the payment-window work, and nothing in the schema forces a status filter — `totalAmount` is on every order row regardless of whether it was ever collected.

**Fix** Decide once what counts as recognised revenue: which statuses, and gross or net of returns. Then apply that one definition to all four queries. `OrderEntity.refundedAmount()` already produces the net figure per order, correctly scaled for coupons, if the answer is net. Resolve together with P2-3 and P2-10, which are the same question asked in two other places.

---

### P2-3. A second, contradictory revenue definition exists and is dead ✅

**Verified fixed** 2026-09-02 — Resolved by the same change as P2-2 — there is now one definition, imported rather than restated.

**Where** `src/infrastructure/database/repositories/orders/order.repository.ts:879`; declared at `src/domain/orders/interfaces/repositories/order.repository.interface.ts:140`

**What happens** `getTotalRevenue()` filters to `status IN ('processing', 'shipped', 'delivered')`. Measured against this codebase's own state machine that set is wrong in both directions: it **excludes `paid`**, which is precisely the status `markAsPaid` writes when Stripe confirms, so a freshly paid order contributes nothing; and it **includes `processing`**, which `ORDER_STATUS_TRANSITIONS` defines as a pre-payment state (`pending → processing → paid`).

It also has no caller anywhere outside the interface that declares it.

**Fix** Delete it, or promote it to the single definition from P2-2 and point the dashboard at it. What it must not stay is a third answer sitting in the repository looking authoritative.

---

### P2-4. Dashboard cards print invented deltas, and count all orders under a "new" label ✅

**Verified fixed** 2026-09-02 — `MetricsCards` records the hardcoded sub-labels in the past tense.

**Where** `src/components/admin/dashboard/MetricsCards.tsx:36,42`; `src/infrastructure/database/repositories/dashboard/dashboard.repository.ts:43-47`

**What happens** Two of the four metric cards carry hardcoded sub-labels: every load renders `"+20.1% from last month"` beneath revenue and `"+180 from yesterday"` beneath orders. Nothing computes either. Sitting directly under a live figure, in the same card, in the position a real delta would occupy, they read as measurements.

The figure above the second one is mislabelled as well. The card is titled **"New Orders"**, but `getMetrics` returns `COUNT(*)` over the whole `orders` table with no date bound — while the revenue card beside it _is_ windowed to 30 days. Two cards, two different time ranges, neither stated.

**Fix** Compute the deltas or delete the strings; a card with no sub-label is honest and a card with a fabricated one is not. Then either bound the order count to the same 30 days as revenue, or retitle it "Total Orders" and label both cards with their window.

---

### P2-5. The app has no error, not-found, or loading boundaries ✅

**Verified fixed** 2026-09-02 — `global-error.tsx`, `not-found.tsx`, `(main)/error.tsx`, `admin/error.tsx` and five `loading.tsx` files all exist.

**Where** absent throughout `src/app`; `src/components/ui/ErrorBoundary.tsx` (59 lines, zero importers)

**What happens** There is no `error.tsx`, `global-error.tsx`, `not-found.tsx` or `loading.tsx` anywhere in the route tree. An uncaught throw in any server component drops the visitor onto Next's default error screen; a bad URL gets Next's default 404 with none of the store's chrome; and with no `loading.tsx` the server-rendered homepage sections have no streaming boundary to suspend into.

An `ErrorBoundary` component exists and is mounted nowhere.

**Why** The homepage sections and the footer each wrap their own fetch in `try`/`catch` and fall back to hardcoded defaults — a deliberate and good pattern that should be preserved. But it only covers the failures those authors anticipated, and it created the impression that failure was handled generally.

**Fix** A root `error.tsx` and `not-found.tsx` in `(main)`, styled to the storefront's dark palette rather than the token defaults (see #39 and P2-6 — this is exactly the surface that trap catches). An `error.tsx` under `admin` too, since that tree has its own theme. Mount the existing `ErrorBoundary` around the client-heavy subtrees, or delete it as part of #27 if the route-level files cover the need.

---

### P2-6. The white-pill outline button is live again, in the cart and checkout funnel

**Where** `src/components/cart/CartPopulated.tsx:60`, `src/components/checkout/CheckoutAddressSelection.tsx:79`, `src/components/checkout/CheckoutOrderSummary.tsx:52`, `src/app/(main)/checkout/success/page.tsx:114`, `src/components/cart/CartUnauthenticated.tsx:18`

**What happens** The seventh through eleventh instances of #39. `variant="outline"` resolves to `bg-background`, which on the storefront is `oklch(1 0 0)` — pure white — with `text-accent-foreground`, near-black. Without a `bg-transparent` override each renders as a white pill on the black page. The last of the five is the instructive one: `CartUnauthenticated.tsx:18` _does_ set `border-white/10` and `text-gray-300`, so it looks patched, but never overrides the background — the rule in `CLAUDE.md` says `bg-transparent` for exactly this reason.

The default variant has the mirror problem in the same flow: `bg-primary` is `oklch(0.205)`, a near-black button on a black page, at `checkout/success/page.tsx:108` and `CheckoutNoAddress.tsx:22`.

**Why** #39's root cause, untouched. Every instance is one `<Button>` written without remembering that `:root` is the light palette.

**Fix** Patch these five as an interim — `bg-transparent` plus an explicit border for outline, `bg-val-accent text-black` for primary; `RelatedProducts.tsx:27` is the correct reference. But this is the argument for doing #39 properly rather than a twelfth patch: the whole purchase funnel is now affected, and no test can see it.

---

### P2-7. Three portalled primitives still set a background with no paired foreground

**Where** `src/components/ui/sheet.tsx:61`, `drawer.tsx:59`, `menubar.tsx:17`

**What happens** The rule that fixed `AlertDialogContent` — a portalled surface must set both halves of a pair, because Radix attaches it to `<body>` where it escapes the admin's `ThemeProvider` and inherits the storefront's white text — has three remaining violations. `SheetContent`, `DrawerContent` and the menubar root each set `bg-background` alone.

**All three are currently unused**, so this is latent rather than live. It becomes live the moment anyone reaches for a sheet or a drawer, which is precisely how the previous instances arrived.

**Verified correct while checking:** `dialog`, `alert-dialog`, `popover`, `select`, `dropdown-menu`, `context-menu`, `command`, `hover-card` and `tooltip` all set both halves.

**Fix** Add `text-foreground` to all three now — three words, and it closes the class off before the next consumer arrives. Or delete them as part of P2-13, since nothing imports them.

---

### P2-8. Nested `<main>` on every storefront page ✅

**Verified fixed** 2026-09-02 — Exactly two `<main>` elements remain, one per layout — storefront and admin — so neither nests inside the other.

**Where** `src/app/(main)/layout.tsx:21`, `src/app/(main)/page.tsx:12`

**What happens** The layout wraps its children in `<main className="min-h-screen">`, and the homepage returns another `<main>` as its own root. Invalid HTML, and two `main` landmarks means assistive technology has no single "primary content" target on the site's front page.

**Fix** Make the inner one a fragment or a `<div>`. Worth grepping the other route files for the same shape while you are in there.

---

### P2-9. Half the cached product fetchers carry no tags, so no write can invalidate them ✅

**Where** `src/lib/cache.ts:256` (`getCachedProductsByCategory`), `:310` (`getCachedProductBySlug`), `:381` (`getCachedRelatedProducts`)

**What happens** All three pass a key array to `unstable_cache` but **no `tags`** — only `revalidate: 60`. The admin routers call `revalidateTag("all-products")` and `revalidateTag("featured-products")` after every product write, and these three never see it.

The visible symptom is an asymmetry: after an edit the product _lists_ update immediately while the product _detail page_ for the same item stays stale for up to a minute. That is the exact shape that makes an admin conclude the save failed and press it again — the failure mode `revalidateCatalogue()` was added to prevent.

**Fix** Give all three the `all-products` tag, and `getCachedProductBySlug` a per-product tag if you want precision. The comment above `revalidateCatalogue()` in `admin/products.ts` already explains why this matters; it just did not reach these three.

---

### P2-10. Customer search pages against the wrong total, and lifetime value counts cancelled orders ✅

**Verified fixed** 2026-09-02 — `admin.customers.list` builds `searchWhere` once and applies it to both the rows and the count, and `totalSpent` uses `SUM_NET_REVENUE`.

**Where** `src/server/routers/admin/customers.ts:60-62`, and `:39` / `:106-109`

**What happens** Two separate problems in one router.

`list` applies the search filter to the returned rows but computes `total` as an unconditional `COUNT(*)` over `user`. Search for one customer and the UI is still told there are hundreds of pages, so the pager is wrong for every search.

`totalSpent` — in the list aggregate and again in `getById` — sums `orders.totalAmount` across every order regardless of status. A customer who abandoned three checkouts and cancelled a fourth reads as a high-value account, and the admin has no way to see why.

**Fix** Move the search predicate into a shared `where` used by both the row query and the count. For `totalSpent`, apply whatever P2-2 settles on — this is the same question about the same column, and the two must not diverge.

---

### P2-11. Notification thumbnails pick the alphabetically-first image, not the primary one ✅

**Verified fixed** 2026-09-02 — The user-notifications query orders by `desc(productImages.isPrimary)`, agreeing with every other read path.

**Where** `src/infrastructure/database/repositories/notifications/user-notifications.repository.ts:48`

**What happens** The product-image subquery is `MIN(image_url)` grouped by product — the alphabetically first URL, not the row flagged `isPrimary`. Every other read path in the codebase does `images.find(img => img.isPrimary) ?? images[0]`.

It returns _an_ image, which is why it has never looked broken.

**Fix** Filter the subquery on `isPrimary` with a `displayOrder` fallback, matching `productImageRepository.findPrimaryByProducts()` — which already exists and does exactly this.

---

### P2-12. The marketing pages quote dollar shipping rates the checkout does not charge ✅

**Verified fixed** 2026-09-02 — `ShippingOptions` records the old `$5.99 / $14.99 / $24.99` tiers in the past tense.

**Where** `src/components/shipping/ShippingOptions.tsx:15,31,44`, `src/components/home/TrustIndicators.tsx:13`, `src/components/faq/FAQAccordion.tsx:42`; against `src/application/checkout/use-cases/create-order.use-case.ts:55-56`

**What happens** `CreateOrderUseCase` hardcodes `shippingCost = 0` and `tax = 0`, and the checkout summary correctly renders "Free". Meanwhile the shipping page advertises `$5.99` / `$14.99` / `$24.99` tiers, the homepage trust badge promises free shipping "On orders over $200", and the FAQ offers `$5` gift wrapping that checkout has no option for.

Two faults at once: the amounts contradict what the system charges, and they are denominated in dollars on a store whose entire currency layer resolves to EGP. Everything _computed_ goes through `formatCurrency` correctly after #17 and #40 — this is the hand-written copy that neither sweep looked at.

**Fix** Decide whether shipping is genuinely free. If it is, say so on all three pages and delete the tiers. If it is not, that is a real feature — `shippingCost` is already a first-class field on the order and the entity's `validateTotal()` will hold you to it — and the copy should follow the implementation rather than lead it.

---

### P2-13. Twenty-nine UI primitives and three dependencies have no consumer ✅

**Verified fixed** 2026-09-02 — No file in `src/components/ui/` is left without an importer.

**Where** `src/components/ui/`, `package.json`

**What happens** 29 of the 60 files in `src/components/ui/` are imported by nothing — roughly 3,700 lines, about 8% of the source tree. `sidebar.tsx` alone is 724 lines and `chart.tsx` is 357 (the admin charts use `recharts` directly rather than through it).

Unimported: `sidebar`, `chart`, `menubar`, `context-menu`, `field`, `carousel`, `item`, `command`, `input-group`, `navigation-menu`, `drawer`, `pagination`, `breadcrumb`, `empty`, `button-group`, `toggle-group`, `input-otp`, `alert`, `hover-card`, `tooltip`, `resizable`, `collapsible`, `checkbox`, `toggle`, `sonner`, `progress`, `aspect-ratio`, `kbd`, and `ErrorBoundary` (see P2-5).

Five dependencies exist solely to support unused primitives — `embla-carousel-react`, `cmdk`, `vaul`, `input-otp`, `react-resizable-panels` — and three more are imported by no file at all: `@stripe/react-stripe-js` and `@stripe/stripe-js` (the app uses Stripe's hosted Checkout, never the client SDK) and `bcryptjs` with its `@types` (Better Auth does its own hashing).

**Fix** Lowest-risk cleanup in the file, and it should still go last. Delete the three genuinely unimported dependencies first — they carry install weight and imply a client-side Stripe integration that does not exist. The primitives are a judgment call: they are `shadcn` scaffolding that costs nothing at runtime, and the argument for removing them is that unused surface is what a future reader mistakes for load-bearing code.

## Suggested order of work

Rewritten 2026-09-02, after re-checking every entry against the code. The
previous version routed the reader to five things that were already done — #42,
#43 and #16 were all "first", and all three had been finished a pass earlier.

Every P0, every P1 and every P2 is done. Nothing left destroys data, and
nothing left shows a customer something untrue. What remains is one design
decision with a long tail, one permission model, and some housekeeping.

**First — #39, the palette, with P2-7 and P2-6 folded into it.** This is the
only item on the list that keeps generating new defects: six white-on-white
bugs so far, every one found by a person looking at a screen rather than by a
test, every one patched individually while the cause stayed put. `:root` is the
light palette, `<body>` overrides to `bg-black text-white`, and anything Radix
portals escapes the admin's theme wrapper entirely.

The verification pass narrowed the live instances to exactly one file:
`src/components/ui/calendar.tsx` sets both `bg-background` and `bg-popover` and
pairs neither with a foreground. Fix that on its own and you get the seventh
patch. Decide the token story once — one palette per surface, or a real
`data-theme` scope — and P2-6, P2-7 and the next six stop existing. That is the
whole argument for doing it first.

**Then — #34, the role model.** `worker` is in the enum, the entity and the
role type, and is checked nowhere; `admin` and `super_admin` are identical in
every gate. So there is no way to let someone edit products without also giving
them every customer's address and order history. The security pass listed this
under "Accepted, not fixed" precisely because it is a design decision — agree
the permission matrix before writing any code, or it will be rewritten twice.

**Then — the migrations, #41 included.** `0002_search_trgm` and
`0003_backfill_currency` exist on disk, are absent from `meta/_journal.json`,
and are documented as unapplied; `0001_glossy_scourge` is journaled and also
documented as unapplied. Whether any of them are on the live database has not
been checked and needs `DATABASE_URL`. The work is: find out what is actually
applied, then either journal them properly or write down, somewhere other than
inside the SQL files themselves, that they are deliberately out of band.
`0003` closes #41.

**Then housekeeping.** #28 is down to a single procedure with no caller,
`admin.settings.getAllContentSections` — adopt or delete. #36 is three warnings from a rule new in eslint-config-next
16.3.4, all firing on deliberate full page reloads after an auth change; either
suppress them at the call sites with a reason, or accept them. #38 wants
re-reading note by note rather than as a block.

**A standing note on dependencies.** `pnpm audit` is clean in both scopes as of
2026-09-02, but two packages are on unsupported lines and will drift back into
advisories: `eslint` 9.x is entirely end-of-life (only 10.x is supported;
`eslint-config-next` already permits `>=9.0.0`, so the upgrade is available),
and `recharts` 2.x is deprecated in favour of 3.x, which drives the admin
charts. Neither is urgent. Both are cheaper now than after the next advisory
lands. And re-run the audit **into a file** — see S1 in the security section
for why reading it through anything with a display limit is how 65 advisories
went unnoticed.

---
