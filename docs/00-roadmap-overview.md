# 🛡️ Valkyrie (val-store) — Master Improvement Roadmap

> **How to use:** Each domain has its own detailed file in this `docs/` folder. Start a new chat per domain, paste the domain file content, and work through it. This keeps token usage minimal.

## ⚠️ IMPORTANT: Analysis-First Approach

**The issues listed in each domain doc are a STARTING POINT, not the full picture.** Each domain chat must:

1. **Analyze first** — Read every file in the domain, understand the code deeply, and look for issues beyond what's listed
2. **Keep listed issues in mind** — The documented issues are confirmed problems, but there may be more hiding beneath the surface
3. **Look for deeper issues** — Race conditions, missing error handling, type safety gaps, performance problems, accessibility issues, edge cases, missing validation, etc.
4. **Check for connections** — If you discover the domain touches another domain, check `connections.md` for details. If the connection isn't documented there, document it before fixing
5. **Then fix** — Only after thorough analysis, proceed to fix issues in priority order

### Cross-Domain Rule

If while working on a domain you discover a connection to another domain:

- **DO NOT** fix the other domain's code
- **DO** document the connection (files, data types, what's expected)
- **DO** reference `connections.md` — it maps every known boundary with exact files, TypeScript interfaces, and data flows
- **HANDLE IT** in a separate dedicated connection chat after both domains are individually cleaned

---

## Tech Stack

| Layer         | Tech                                                 |
| ------------- | ---------------------------------------------------- |
| Framework     | Next.js 16 (App Router) + React 19                   |
| Backend       | tRPC v11 (Onion Architecture)                        |
| Database      | PostgreSQL (NeonDB) via Drizzle ORM                  |
| Auth          | Better Auth (email/password + Google/Facebook OAuth) |
| Payments      | Stripe                                               |
| Email         | Resend                                               |
| File Upload   | UploadThing                                          |
| State         | Zustand (cart) + TanStack Query (server)             |
| Styling       | Tailwind CSS v4 + Radix UI + shadcn/ui               |
| Rate Limiting | Upstash Redis                                        |

---

## 🚨 Critical Issues (Fix Before Anything Else)

### 1. OAuth URLs hardcoded to localhost

- `BETTER_AUTH_URL=http://localhost:3000` in `.env`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env`
- `NEXT_PUBLIC_BASE_URL` not defined at all — `auth-client.ts` falls back to localhost
- Google & Facebook OAuth consoles need production redirect URIs added
- **Impact:** OAuth login will completely fail in production

### 2. Root layout is in debug mode

- `src/app/layout.tsx` has comment: `TEMPORARY: Simplified root layout for debugging`
- Missing `Toaster` component globally — toast notifications won't work on auth pages
- TRPCProvider moved to `(main)/layout.tsx` which is correct, but Toaster should be global

### 3. Stripe webhook secret is placeholder

- `.env` has `STRIPE_WEBHOOK_SECRET=whsec_...` — not a real secret
- Payment webhooks won't process

### 4. Verify .env was never committed to git

- `.gitignore` has `.env*` ✅ but verify with: `git log --all --full-history -- .env`
- If it was ever committed, ALL keys must be rotated

### 5. console.log in production code

- `src/lib/auth.ts` — 4 console.log statements in email sending
- `src/db/index.ts` — logs DB connection
- `src/app/api/webhook/stripe/route.ts` — logs webhook events
- `src/lib/uploadthing.ts` — logs upload events

---

## Domain Index

| #     | Domain                          | File                                      | Priority      | Issues        |
| ----- | ------------------------------- | ----------------------------------------- | ------------- | ------------- |
| 1     | Auth & Security                 | `01-auth-security.md`                     | 🔴 HIGH       | 6 issues      |
| 2     | Products (Storefront)           | `02-products.md`                          | 🟡 MEDIUM     | 8 issues      |
| 3     | Cart & Wishlist                 | `03-cart-wishlist.md`                     | 🟡 MEDIUM     | 4 issues      |
| 4-5   | Checkout + Orders               | `04-05-checkout-orders.md`                | 🟡 MEDIUM     | 7 issues      |
| 6-7   | Account + Homepage              | `06-07-account-homepage.md`               | 🟢 LOW        | 8 issues      |
| 8-10  | Admin + Reviews + Notifications | `08-09-10-admin-reviews-notifications.md` | 🟡 MEDIUM     | 10 issues     |
| 11-14 | Static + Layout + DB + DevOps   | `11-12-13-14-static-layout-db-devops.md`  | 🟡 MEDIUM     | 21 issues     |
| 🔗    | Cross-Domain Connections        | `connections.md`                          | After domains | 8 connections |

---

## 🔗 Cross-Domain Connections

> When two domains overlap, create a **dedicated chat** to handle the connection after both individual domains are cleaned.

| Connection            | Domains Involved                    | Handle After           |
| --------------------- | ----------------------------------- | ---------------------- |
| Purchase Flow         | Products → Cart → Checkout → Orders | Domains 2, 3, 4, 5     |
| CMS Integration       | CMS/Settings → Homepage → Layout    | Domains 7, 12          |
| Notification Triggers | Orders → Reviews → Notifications    | Domains 5, 9, 10       |
| Environment Config    | Auth → Payments → Email → All       | Domain 14 (final pass) |

---

## 📋 Execution Order

| Phase | Domain                 | Why                                |
| ----- | ---------------------- | ---------------------------------- |
| 1     | 🔐 Auth & Security     | Fix critical security issues first |
| 2     | 🎨 Layout & Shared UI  | Fix root layout debug issue        |
| 3     | 🛍️ Products            | Core storefront                    |
| 4     | 🛒 Cart & Wishlist     | Depends on products                |
| 5     | 💳 Checkout & Payments | Depends on cart                    |
| 6     | 📦 Orders              | Depends on checkout                |
| 7     | ⚙️ Admin Panel         | Can parallel with storefront       |
| 8     | 🏠 Homepage & CMS      | Polish after core is solid         |
| 9     | 👤 Account & Addresses | Lower priority                     |
| 10    | ⭐ Reviews             | After products + orders            |
| 11    | 📬 Notifications       | After orders + reviews             |
| 12    | 📄 Static Pages        | Cosmetic                           |
| 13    | 🗄️ Database & Infra    | After features stable              |
| 14    | 🚀 DevOps & Cleanup    | Final pass                         |
| 15    | 🔗 Cross-Domain        | Verify integrations                |

---

## 📊 Stats

| Metric                   | Count |
| ------------------------ | ----- |
| Total domains            | 14    |
| Critical bugs            | 5     |
| Improvements needed      | ~25   |
| File organization issues | ~12   |
| TODO comments in code    | 3     |
| Files with console.log   | 4     |
| Estimated chat sessions  | ~19   |

---

## How to Start Each Domain Chat

Paste this template:

> _"I'm working on my val-store (Valkyrie) e-commerce site. I have a master roadmap in `docs/`. I'm now working on **Domain X: [Name]**. Here's the detailed plan: [paste domain file content]._
>
> _Before making any changes, I need you to **analyze every file listed in this domain deeply**. The issues in the doc are a starting point — look for deeper problems like race conditions, missing error handling, type safety gaps, edge cases, performance issues, etc._
>
> _If you discover any cross-domain connections, check `docs/connections.md` — it maps every known boundary. If you find a new connection, document it but don't fix the other domain's code._
>
> _After analysis, present your findings (old + new issues), then we'll fix them."_
