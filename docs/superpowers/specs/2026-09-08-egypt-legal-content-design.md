# Egypt legal content — design

Date: 2026-09-08
Status: approved, not yet implemented

> **This spec covers the machinery, and the machinery only.** The legal text it
> carries is a researched draft, not legal advice. Every factual claim in
> `content/legal/*.md` must carry its source, and the set must be reviewed by
> an Egyptian lawyer before it is presented to customers as their rights.

## Problem

The store targets Egypt — phone parsing defaults to `EG`, Stripe charges in
`egp` — but its legal pages are US/EU boilerplate. The clearest instance:
`ReturnsContent.tsx` promises a **30-day** return window in two places, and
Egyptian consumer protection law grants a materially different (shorter,
statutory) window. A store that publishes a policy at odds with the law is
either over-promising or, worse, under-stating a right the customer actually
has.

The same file promises a "prepaid shipping label" and "refunds processed within
5-7 business days", neither of which describes how this store or Egyptian law
works. `TrustIndicators` repeats the 30-day claim on the homepage.

Nine hundred and seventy lines of prose across five page trees
(`returns`, `terms`, `privacy`, `shipping`, `faq`) are hardcoded JSX. Changing
a policy currently requires a deploy.

## Approach

Content moves into the database so it can be edited without a deploy, and the
canonical copy stays in the repo as markdown so a legal document is reviewed in
a diff and has an audit trail. `pnpm seed` upserts the repo markdown into the
database; the pages render from the database.

The storage shape copies `content_sections` + `content_sections_history`

- `ContentHistoryDialog`, which already work here, rather than inventing a new
  one. It is deliberately _not_ built on `content_sections` itself: that table
  stores Zod-validated JSON blocks for structured homepage sections, and the
  project's own guidance is that adding a section type means touching five
  places. Long-form prose is a different shape and gets its own table.

## Schema

```ts
export const legalPages = pgTable(
  "legal_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    bodyMarkdown: text("body_markdown").notNull(),
    effectiveDate: date("effective_date").notNull(),
    version: integer("version").default(1).notNull(),
    isPublished: boolean("is_published").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    slugIdx: uniqueIndex("idx_legal_pages_slug").on(table.slug),
  })
);

export const legalPagesHistory = pgTable(
  "legal_pages_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => legalPages.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 64 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    bodyMarkdown: text("body_markdown").notNull(),
    effectiveDate: date("effective_date").notNull(),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    pageIdIdx: index("idx_legal_history_page_id").on(table.pageId),
  })
);
```

Slugs are a closed set: `returns`, `terms`, `privacy`, `shipping`, `faq`. The
set lives in one exported const so the route, the seed, the admin editor and
the Zod input all read from it and cannot drift.

`updatedBy` / `createdBy` are `ON DELETE SET NULL`, matching how the codebase
already handles user references that must survive account deletion.

Schema work goes through `pnpm db:push`, per the project's day-to-day workflow.

## Layers

Standard onion, matching the existing domain modules:

```
src/domain/legal/entities/legal-page.entity.ts
src/domain/legal/interfaces/repositories/legal-page.repository.interface.ts
src/infrastructure/database/repositories/legal/legal-page.repository.ts
src/application/legal/legal.container.ts        → createLegalModule()
src/application/legal/use-cases/update-legal-page.use-case.ts
src/server/routers/admin/legal.ts
src/server/routers/public/legal.ts
```

`createLegalModule()` is spread into `src/application/container.ts` alongside
the existing twelve, with the same lazy-memoised getter shape.

`UpdateLegalPageUseCase` writes the history row and bumps `version` in the same
transaction as the update — a history that can be missing its predecessor is
not a history.

### Procedure tiers

`src/server/admin-write-gating.test.ts` scans the routers and fails the build
if a mutation sits on the read tier. Get this right the first time:

| Procedure                | Tier                  |
| ------------------------ | --------------------- |
| `admin.legal.list`       | `adminProcedure`      |
| `admin.legal.get`        | `adminProcedure`      |
| `admin.legal.history`    | `adminProcedure`      |
| `admin.legal.update`     | `adminWriteProcedure` |
| `admin.legal.revert`     | `adminWriteProcedure` |
| `public.legal.getBySlug` | `publicProcedure`     |

`public.legal.getBySlug` must be a genuine `publicProcedure` that never calls
`getUser()`. It is reached through `createAnonymousCaller()` from server
components, and a procedure that touches auth marks the whole HTTP response
uncacheable via `ctx.touchedAuth()`. A policy page is the most cacheable thing
on the site.

## Repo markdown is the source of truth

```
content/legal/returns.md
content/legal/terms.md
content/legal/privacy.md
content/legal/shipping.md
content/legal/faq.md
```

Each with minimal frontmatter:

```markdown
---
title: Returns & Exchanges
effectiveDate: 2026-09-08
---

## Your right to return

...
```

`pnpm seed` upserts by slug: insert if absent, update if the markdown differs,
leave alone if identical. It does **not** write a history row — seeding is
asserting the canonical text, not an editorial change.

### `src/lib/legal-frontmatter.ts`

Hand-rolled rather than a `gray-matter` dependency. The format is four lines of
`key: value` between `---` fences; a dependency for that is not worth the
supply-chain surface, and hand-rolling makes it unit-testable in the repo's
existing style.

`legal-frontmatter.test.ts` covers: a well-formed document; a document with no
frontmatter (rejected, not silently treated as body); an unterminated fence;
an unknown key (rejected — a typo'd `effectivedate` must not silently produce a
page with no date); a body containing `---` in its own text; CRLF line endings,
since the repo is on Windows and Prettier enforces LF only on tracked source.

## Rendering

`react-markdown` + `remark-gfm`, inside the existing `prose-val` wrapper.
Raw HTML stays disabled (react-markdown's default), so admin-authored content
cannot inject markup.

Reads go through `src/lib/cache.ts` in the established pattern:

```ts
export const getCachedLegalPage = (slug: LegalSlug) =>
  unstable_cache(fetcher, ["legal", slug], {
    revalidate: 300,
    tags: [`legal-${slug}`],
  });
```

and `admin.legal.update` / `revert` call `revalidateTag("legal-<slug>")`.

**Keep the try/catch fallback.** Every CMS-backed section in this codebase
wraps its fetch and falls back to hardcoded defaults so a database failure
degrades instead of crashing. A legal page is exactly where that matters: the
fallback is the current committed markdown compiled in as a constant, so the
page always renders something truthful.

The five page components (`ReturnsContent`, `TermsContent`, `PrivacyContent`,
`ShippingPolicy`, `FAQAccordion`) collapse into markdown renderers. The
`*Header` components keep their current role.

### FAQ keeps its accordion

One storage shape, two presentations, by convention: in `faq.md`, each `##`
heading is a question and the prose beneath it is the answer.
`FAQAccordion` splits the parsed markdown on `h2` boundaries and feeds the
existing accordion. No second table, no second editor.

That splitting logic is pure and goes in `src/lib/faq-markdown.ts` with tests —
same reasoning as `image-crop.ts`: no DOM testing library exists, so logic
worth testing lives outside React.

## Admin editor

A new `/admin/legal` screen: list the five pages, edit one at a time with a
textarea plus a live rendered preview, and a "History" button reusing the
shape of `ContentHistoryDialog`.

Both halves of every colour pair on any portalled surface — the history dialog
is a Radix portal and inherits the storefront's white text otherwise.

Write controls follow the read-only tier convention: a `worker` sees the screen
and the server rejects the mutation, with `AdminReadOnlyBanner` explaining why.

## Copy that lives outside these pages

Correcting the five documents is not sufficient; these contradict them today
and must be updated in the same pass:

- `src/components/home/TrustIndicators.tsx` — the "30-day returns" badge
- `src/components/returns/ReturnsOptions.tsx`
- `src/components/returns/ReturnsContent.tsx` — "prepaid shipping label",
  "refunds processed within 5-7 business days"
- `src/components/faq/FAQSupport.tsx` and `src/components/shipping/*` — check
  for the same claims

A grep for `30 day`, `30-day`, `prepaid`, `business days` and `$` across
`src/components` is the check that nothing was missed.

## Facts the business must supply

The research brief will confirm which of these Egyptian law requires a seller
to publish. They are not derivable from the codebase and block the _content_,
not the machinery:

- Registered legal name and whether it trades as a company or a sole trader
- Commercial Register (السجل التجاري) number
- Tax Registration number, and whether the store is VAT-registered
- Registered physical address
- Published complaint contact — email and phone
- Whether an Arabic version of the pages is required, and if so who writes it

The machinery can be built and seeded with the current English drafts before
these land; the pages carry the researched policy, and these identifiers are
filled into `terms.md` and `privacy.md` when known.

## Testing

- `pnpm vitest run src/lib/legal-frontmatter.test.ts src/lib/faq-markdown.test.ts`
- `pnpm test` — full unit suite green, including
  `src/server/admin-write-gating.test.ts` which will fail if a legal mutation
  lands on the read tier
- `rm -rf .next && pnpm type-check`
- `pnpm lint` — 0 problems
- `pnpm build`
- `pnpm seed` against a scratch database, then re-run it to confirm the upsert
  is idempotent and writes no history rows

## Out of scope

- Arabic translation of the pages (flagged above as an open question, not
  built here)
- Making the refund flow actually move money — `docs/REFUNDS.md` records that
  refunds are recorded but not issued, which is a separate, known, deliberate
  gap. Nothing in these pages may claim otherwise.
- Cookie consent UI, if the research says one is required. That is its own
  sub-project.
