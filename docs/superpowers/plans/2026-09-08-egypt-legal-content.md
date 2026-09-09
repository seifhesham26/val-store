# Egypt Legal Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The store's five legal pages carry accurate Egyptian policy, are stored in the database so they can be corrected without a deploy, and keep their canonical text in the repo so a legal document is reviewed in a diff.

**Architecture:** A `legal_pages` + `legal_pages_history` pair mirroring the proven `content_sections` shape, fed by markdown files in `content/legal/` through an idempotent seed, read by server components through `unstable_cache`, and edited through a new `/admin/legal` screen.

**Tech Stack:** Drizzle + PostgreSQL (Neon), tRPC v11, Next.js 16 App Router server components, `react-markdown` + `remark-gfm`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-egypt-legal-content-design.md`

## Global Constraints

- **Do not commit.** Every task ends at "verification green". The repo owner reviews and commits.
- **Do not invent legal facts.** Task 5 is the only task that writes legal prose, and it may only use the verified facts table in that task. If something is needed that is not in that table, stop and ask — a guessed statutory number published to customers is the worst failure this plan can produce.
- Package manager is **pnpm**.
- Prettier: double quotes, semicolons, 80 columns, es5 trailing commas, LF.
- `pnpm lint` baseline **0 problems**; `pnpm test` baseline **469 passing / 37 files** (**477** if the product-image plan ran first).
- `rm -rf .next` before `pnpm type-check`, always.
- Schema changes go through `pnpm db:push`, not `db:migrate`. The journal lists only `0000` and `0001`; `db:migrate` will not run later files.
- **Never import infrastructure or Drizzle from `src/domain/`.**
- Routers are thin: Zod-validate → `container.getXUseCase()` → return.

---

### Task 1: Schema and the slug set

**Files:**

- Modify: `src/db/schema.ts` (append the two tables near `contentSections`, and the inferred types near the other `$inferSelect` exports)
- Create: `src/domain/legal/legal-slugs.ts`
- Test: `src/domain/legal/legal-slugs.test.ts`

**Interfaces:**

- Produces:
  - `const LEGAL_SLUGS = ["returns", "terms", "privacy", "shipping", "faq"] as const`
  - `type LegalSlug = (typeof LEGAL_SLUGS)[number]`
  - `function isLegalSlug(value: string): value is LegalSlug`
  - Drizzle tables `legalPages`, `legalPagesHistory`; types `LegalPage`, `NewLegalPage`, `LegalPageHistory`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/legal/legal-slugs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LEGAL_SLUGS, isLegalSlug } from "./legal-slugs";

describe("legal slugs", () => {
  it("covers exactly the five legal pages", () => {
    expect([...LEGAL_SLUGS].sort()).toEqual([
      "faq",
      "privacy",
      "returns",
      "shipping",
      "terms",
    ]);
  });

  it("accepts a known slug", () => {
    expect(isLegalSlug("returns")).toBe(true);
  });

  it("rejects an unknown slug", () => {
    expect(isLegalSlug("refunds")).toBe(false);
  });

  it("rejects a slug differing only by case", () => {
    expect(isLegalSlug("Returns")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/domain/legal/legal-slugs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the slug module**

Create `src/domain/legal/legal-slugs.ts`:

```ts
/**
 * The closed set of legal pages.
 *
 * One list, read by the route, the seed, the admin editor and the tRPC input
 * schemas, so a page cannot exist in one of those and not the others.
 * Lives in `domain/` because it has zero dependencies and both server and
 * client code needs it.
 */
export const LEGAL_SLUGS = [
  "returns",
  "terms",
  "privacy",
  "shipping",
  "faq",
] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run src/domain/legal/legal-slugs.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the tables**

In `src/db/schema.ts`, next to `contentSections`, append the two tables exactly as written in the spec's "Schema" section. Add `date` to the existing `drizzle-orm/pg-core` import if it is not already there.

Then, alongside the other type exports near the bottom:

```ts
export type LegalPage = typeof legalPages.$inferSelect;
export type NewLegalPage = typeof legalPages.$inferInsert;
export type LegalPageHistory = typeof legalPagesHistory.$inferSelect;
```

- [ ] **Step 6: Push the schema**

Run: `pnpm db:push`
Expected: two new tables created; **no prompt about dropping or renaming an existing table.** If Drizzle offers to rename something, answer no and stop — that means a name collided.

- [ ] **Step 7: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: clean, 0 problems, baseline + 4 tests.

---

### Task 2: Frontmatter parser

Independent of the database; written now because Task 5 depends on it.

**Files:**

- Create: `src/lib/legal-frontmatter.ts`
- Test: `src/lib/legal-frontmatter.test.ts`

**Interfaces:**

- Produces:
  - `interface LegalDocument { title: string; effectiveDate: string; body: string }`
  - `function parseLegalDocument(raw: string): LegalDocument` — throws on malformed input.

- [ ] **Step 1: Write the failing test**

Create `src/lib/legal-frontmatter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseLegalDocument } from "./legal-frontmatter";

const good = `---
title: Returns & Exchanges
effectiveDate: 2026-09-08
---

## Your right to return

You may return within 14 days.
`;

describe("parseLegalDocument", () => {
  it("reads the title and effective date and returns the body", () => {
    const doc = parseLegalDocument(good);
    expect(doc.title).toBe("Returns & Exchanges");
    expect(doc.effectiveDate).toBe("2026-09-08");
    expect(doc.body).toContain("## Your right to return");
    expect(doc.body.startsWith("---")).toBe(false);
  });

  it("keeps a horizontal rule that appears inside the body", () => {
    const doc = parseLegalDocument(
      `---\ntitle: T\neffectiveDate: 2026-01-01\n---\n\nfirst\n\n---\n\nsecond\n`
    );
    expect(doc.body).toContain("first");
    expect(doc.body).toContain("---");
    expect(doc.body).toContain("second");
  });

  it("tolerates CRLF line endings", () => {
    const doc = parseLegalDocument(good.replace(/\n/g, "\r\n"));
    expect(doc.title).toBe("Returns & Exchanges");
    expect(doc.effectiveDate).toBe("2026-09-08");
  });

  it("rejects a document with no frontmatter rather than treating it as body", () => {
    expect(() => parseLegalDocument("## Just a heading\n")).toThrow(
      /frontmatter/i
    );
  });

  it("rejects an unterminated frontmatter fence", () => {
    expect(() => parseLegalDocument("---\ntitle: T\n")).toThrow(/frontmatter/i);
  });

  it("rejects an unknown key so a typo cannot silently vanish", () => {
    expect(() =>
      parseLegalDocument("---\ntitle: T\neffectivedate: 2026-01-01\n---\n\nx\n")
    ).toThrow(/effectivedate/i);
  });

  it("rejects a missing required key", () => {
    expect(() => parseLegalDocument("---\ntitle: T\n---\n\nx\n")).toThrow(
      /effectiveDate/
    );
  });

  it("rejects an effectiveDate that is not YYYY-MM-DD", () => {
    expect(() =>
      parseLegalDocument("---\ntitle: T\neffectiveDate: 8 Sep 2026\n---\n\nx\n")
    ).toThrow(/effectiveDate/);
  });

  it("rejects an empty body", () => {
    expect(() =>
      parseLegalDocument("---\ntitle: T\neffectiveDate: 2026-01-01\n---\n\n\n")
    ).toThrow(/body/i);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/legal-frontmatter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

Create `src/lib/legal-frontmatter.ts`. Requirements the tests pin down:

- Normalise CRLF to LF first. The repo is developed on Windows and Prettier enforces LF only on tracked source, so a content file can arrive either way.
- Require the document to open with `---` on its own line; find the **next** `---` line and treat only that span as frontmatter, so a horizontal rule later in the body survives.
- Parse `key: value` lines, splitting on the **first** colon only (a title may contain one).
- Reject any key that is not `title` or `effectiveDate`, naming the offending key in the message — a typo'd `effectivedate` must fail loudly, not produce a page with no date.
- Require both keys; require `effectiveDate` to match `/^\d{4}-\d{2}-\d{2}$/`.
- Require a non-empty trimmed body.
- Throw `Error` with a message containing the word the tests match on.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run src/lib/legal-frontmatter.test.ts`
Expected: PASS, 9 tests.

---

### Task 3: Domain, repository and container wiring

**Files:**

- Create: `src/domain/legal/entities/legal-page.entity.ts`
- Create: `src/domain/legal/interfaces/repositories/legal-page.repository.interface.ts`
- Create: `src/infrastructure/database/repositories/legal/legal-page.repository.ts`
- Create: `src/application/legal/use-cases/update-legal-page.use-case.ts`
- Create: `src/application/legal/index.ts` (exports `createLegalModule`)
- Modify: `src/application/container.ts`

**Interfaces:**

- Consumes: `LegalSlug` from Task 1.
- Produces:
  - `class LegalPageEntity` — constructor-parameter properties, matching `ProductImageEntity`'s style.
  - `interface LegalPageRepositoryInterface { findBySlug(slug: LegalSlug): Promise<LegalPageEntity | null>; findAll(): Promise<LegalPageEntity[]>; update(input: UpdateLegalPageInput): Promise<LegalPageEntity>; history(slug: LegalSlug): Promise<LegalPageHistoryEntry[]>; revert(slug: LegalSlug, version: number, userId: string): Promise<LegalPageEntity>; }`
  - `createLegalModule(): { getLegalPageRepository(): LegalPageRepositoryInterface; getUpdateLegalPageUseCase(): UpdateLegalPageUseCase }`
  - On the container: `container.getLegalPageRepository()` and `container.getUpdateLegalPageUseCase()`.

- [ ] **Step 1: Write the entity and the interface**

Follow the existing shapes: entity with `public readonly` constructor parameters and `withX()` copy methods rather than mutation; the repository interface in `domain/`, referencing only domain types.

- [ ] **Step 2: Write the Drizzle repository**

In `update`, write the history row and bump `version` **inside one `db.transaction`**. A history that can lose its predecessor is not a history. `revert` reads the requested history row, then routes through the same `update` path so reverting is itself recorded.

Money/date handling note: `effective_date` is a Postgres `date` and comes back as a string; keep it a string end-to-end rather than round-tripping through `Date`, which would introduce a timezone bug on a date with no time.

- [ ] **Step 3: Wire the module into the container**

Create `createLegalModule()` with the lazily-memoised getter shape used by every other module, then in `src/application/container.ts` add `const legal = createLegalModule();` and spread `...legal` into the returned object alongside the others. It takes no `deps` — it crosses no domain.

- [ ] **Step 4: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: clean, 0 problems, no test count change.

---

### Task 4: tRPC routers

**Files:**

- Create: `src/server/routers/admin/legal.ts`
- Create: `src/server/routers/public/legal.ts`
- Modify: `src/server/routers/admin/index.ts` (register `legal`)
- Modify: `src/server/routers/public/index.ts` (register `legal`)

**Interfaces:**

- Consumes: container getters from Task 3, `LEGAL_SLUGS`/`isLegalSlug` from Task 1.
- Produces: `admin.legal.{list,get,history}` (queries), `admin.legal.{update,revert}` (mutations), `public.legal.getBySlug` (query).

- [ ] **Step 1: Write the routers**

Tier assignment is not a style choice — `src/server/admin-write-gating.test.ts` scans the routers and fails the build on a mutation sitting on the read tier:

| Procedure                | Tier                  |
| ------------------------ | --------------------- |
| `admin.legal.list`       | `adminProcedure`      |
| `admin.legal.get`        | `adminProcedure`      |
| `admin.legal.history`    | `adminProcedure`      |
| `admin.legal.update`     | `adminWriteProcedure` |
| `admin.legal.revert`     | `adminWriteProcedure` |
| `public.legal.getBySlug` | `publicProcedure`     |

Input validation uses `z.enum(LEGAL_SLUGS)` for the slug, so an unknown page is a validation error rather than a null result.

`admin.legal.update` and `admin.legal.revert` must call `revalidateTag(\`legal-${slug}\`)`after the write, in the same spirit as`revalidateCatalogue()` on the product routers.

- [ ] **Step 2: Keep the public read genuinely public**

`public.legal.getBySlug` must never call `ctx.getUser()`. `responseMeta` in `src/app/api/trpc/[trpc]/route.ts` uses `ctx.touchedAuth()` to decide whether the HTTP response may be cached publicly, and a batched request containing one user-scoped call poisons the whole response. A policy page is the most cacheable thing on the site — do not put it behind an auth read.

- [ ] **Step 3: Verify the gating test agrees**

Run: `pnpm vitest run src/server/admin-write-gating.test.ts`
Expected: PASS. If it fails naming a legal procedure, fix the tier — do not edit the test.

- [ ] **Step 4: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: clean, 0 problems.

---

### Task 5: The legal content itself

**This is the only task that writes legal prose. Read the constraint at the top of this plan before starting.**

**Files:**

- Create: `content/legal/returns.md`
- Create: `content/legal/terms.md`
- Create: `content/legal/privacy.md`
- Create: `content/legal/shipping.md`
- Create: `content/legal/faq.md`
- Create: `scripts/seed-legal.ts`
- Modify: `package.json` (add `"seed:legal": "tsx scripts/seed-legal.ts"`)
- Modify: `scripts/seed.ts` (call the same upsert helper so a full seed includes legal pages)

**Interfaces:**

- Consumes: `parseLegalDocument` (Task 2), `legalPages` (Task 1).
- Produces: `async function upsertLegalPages(): Promise<number>` exported from `scripts/seed-legal.ts`, returning the number of pages written.

#### Verified facts — the only legal facts this task may state

Every one of these was checked against a primary or official source. Anything not on this list must not appear as a factual claim.

| Fact                                       | Value                                                                                                | Source                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------- |
| Governing instrument                       | Consumer Protection Law **No. 181 of 2018**                                                          | WIPO Lex                      |
| Executive Regulations                      | **PM Decree No. 822 of 2019**, published 2 Apr 2019                                                  | WIPO Lex                      |
| No-reason return window (online/remote)    | **14 days**, running from **receipt of the goods**, no reason required                               | Law 181/2018 **Art. 40** ¶1–2 |
| Who pays return shipping, no-reason return | **The customer**                                                                                     | Law 181/2018 Art. 40          |
| Refund method                              | Must be refunded **by the same method of payment**                                                   | Law 181/2018 Art. 40          |
| Defective / faulty goods window            | **30 days** to return or exchange                                                                    | Executive Regulations         |
| Who pays return shipping, defective goods  | **The supplier**, after inspection confirms the defect                                               | Executive Regulations         |
| Order amendment, distance sales            | Within **7 working days** of acceptance                                                              | Executive Regulations         |
| Condition for return                       | Original condition, receipt available                                                                | Executive Regulations         |
| Standard VAT rate                          | **14%**                                                                                              | Egyptian VAT Law 67/2016      |
| Consumer Protection Agency hotline         | **19588**                                                                                            | cpa.gov.eg (official)         |
| Data protection law                        | **Law No. 151 of 2020** (PDPL)                                                                       | Official                      |
| PDPL Executive Regulations                 | **PM Decree No. 816**, 1 Nov 2025                                                                    | Official                      |
| PDPL full enforcement                      | ~**October/November 2026**, after a one-year grace period                                            | Official                      |
| Electronic contracting                     | **Electronic Signature Law No. 15 of 2004**, administered by ITIDA                                   | Official                      |
| Mandatory seller disclosures               | name, address, phone, email, **commercial registration number**, **tax card**                        | Egyptian e-commerce framework |
| Published address                          | must be the real registered/business address — not a courier, virtual office, or social-media handle | Egyptian e-commerce framework |
| Governing law to state                     | **Arab Republic of Egypt**                                                                           | —                             |

**Explicitly NOT verified — do not state as fact:** whether displayed prices must be VAT-inclusive; any statutory maximum delivery period (the "30 days from contract" figure is unverified and must not be published); a statutory apparel guarantee period (the "2 years" figure is unverified); specific article numbers beyond Article 40.

#### Drafting rules

- **Separate the two windows.** The current site merges them: it advertises 30 days for a no-reason return, which is the _defect_ window. `returns.md` must present the 14-day no-reason right and the 30-day defect right as distinct, with their different shipping-cost rules.
- **A voluntary policy never displaces a statutory right.** If the store offers anything beyond the statutory minimum, say so in those terms: the voluntary policy is additional and does not limit mandatory Egyptian rights.
- **Delete the three false promises**: the prepaid return label, "refunds in 5-7 business days" as a commitment, and any blanket "final sale — no returns".
- **Do not claim refunds are issued automatically.** `docs/REFUNDS.md` records that the system files a return but moves no money; refunds are issued by hand in the payment provider's dashboard. Nothing may imply otherwise.
- **Cash on Delivery needs its own refund paragraph** — "same method of payment" has a real meaning for cash that card orders do not raise.
- Leave the owner-supplied identifiers as visible placeholders in the exact form `[COMMERCIAL REGISTER NUMBER]`, `[TAX REGISTRATION NUMBER]`, `[REGISTERED ADDRESS]`. A grep for `[` in `content/legal/` must find every one of them, so nothing ships blank by accident.

#### Data inventory for `privacy.md` — derived from the schema, not from a template

A privacy policy assembled from someone else's is wrong by construction: it
describes their data, not ours. This one is enumerated from `src/db/schema.ts`
and `auth-schema.ts`. Every item below is data this application actually
stores, and `privacy.md` must account for all of it.

| Source                            | Personal data held                                                      |
| --------------------------------- | ----------------------------------------------------------------------- |
| `user`                            | name, email, email-verified flag, avatar image, **phone**, **birthday** |
| `session`                         | **IP address**, **user agent**, session token, expiry                   |
| `account`                         | password hash; **Google/Facebook OAuth access, refresh and id tokens**  |
| `user_profiles`                   | role                                                                    |
| `customers`                       | phone-keyed identity, loyalty points, total spend, **admin notes**      |
| `addresses`                       | shipping and billing addresses                                          |
| `orders`, `order_items`           | full purchase history, **address snapshots** written at checkout        |
| `payments`                        | Stripe transaction id, amount, currency, status                         |
| `carts`, `cart_items`, `wishlist` | browsing and intent behaviour                                           |
| `reviews`                         | user-generated content **displayed publicly with the reviewer's name**  |
| `newsletter_subscribers`          | marketing contact                                                       |
| `user_notifications`              | in-app message history                                                  |
| `inventory_logs`                  | `created_by` — staff attribution                                        |

Three of these need explicit handling and are easy to miss:

- **We take card payments, so we cannot copy the "no card details" line.** The
  honest statement is that card details are entered with **Stripe** and never
  reach or get stored by this store; what we retain is a Stripe transaction
  id. Claiming we never handle card payments at all would simply be false.
- **`session.ipAddress` and `session.userAgent` are collected on every login.**
  A policy that omits them is incomplete.
- **`user.birthday` is collected at sign-up and, as far as this codebase
  shows, never read.** Under a data-minimisation regime, collecting a date of
  birth with no stated purpose is the wrong side of the line. Flag it to the
  owner: either give it a purpose and state it, or stop collecting it. Do not
  invent a purpose to paper over it.

Also state, because they are true and favourable: this store **does** support
account deletion (the `ON DELETE SET NULL` work in `drizzle/0004` is what makes
it possible), and order address snapshots mean a customer can delete a saved
address without damaging their order history.

**Cross-border transfer** must be disclosed by name, since every processor is
outside Egypt: Stripe, Resend, UploadThing, Neon (`eu-central-1`), Upstash,
Vercel, plus Google and Facebook for OAuth sign-in.

- [ ] **Step 1: Write the five markdown files**

Each opens with the frontmatter Task 2's parser requires:

```markdown
---
title: Returns & Exchanges
effectiveDate: 2026-09-08
---
```

`faq.md` uses one `##` heading per question, with the answer as the prose beneath it — Task 6's splitter depends on that shape.

- [ ] **Step 2: Write the upsert**

`scripts/seed-legal.ts` reads each file in `content/legal/`, parses it, and upserts by slug:

```ts
await db
  .insert(legalPages)
  .values({ slug, title, bodyMarkdown: body, effectiveDate })
  .onConflictDoUpdate({
    target: legalPages.slug,
    set: { title, bodyMarkdown: body, effectiveDate, updatedAt: new Date() },
  });
```

It writes **no history row**. Seeding asserts the canonical text; it is not an editorial change, and filling the history with identical seed entries would bury the real ones.

Register `"seed:legal"` in `package.json`, and call the same exported helper from `scripts/seed.ts` so a full seed includes the pages.

- [ ] **Step 3: Verify idempotence**

Run: `pnpm seed:legal` then `pnpm seed:legal` again.
Expected: both succeed; the second changes no row count; `select count(*) from legal_pages_history` is still 0.

- [ ] **Step 4: Verify the placeholders are all visible**

Run: `grep -rn "\[" content/legal/ | grep -E "\[[A-Z ]+\]"`
Expected: every owner-supplied identifier listed, none silently blank.

---

### Task 6: Render the pages from the database

**Files:**

- Create: `src/lib/faq-markdown.ts`
- Test: `src/lib/faq-markdown.test.ts`
- Create: `src/components/legal/LegalPageContent.tsx`
- Modify: `src/lib/cache.ts` (add `getCachedLegalPage`)
- Modify: `src/components/returns/ReturnsContent.tsx`, `src/components/terms/TermsContent.tsx`, `src/components/privacy/PrivacyContent.tsx`, `src/components/shipping/ShippingPolicy.tsx`, `src/components/faq/FAQAccordion.tsx`
- Modify: `package.json` (add `react-markdown`, `remark-gfm`)

**Interfaces:**

- Consumes: `public.legal.getBySlug` (Task 4), `LegalSlug` (Task 1).
- Produces:
  - `function splitFaqSections(markdown: string): { question: string; answer: string }[]`
  - `function LegalPageContent(props: { markdown: string })`
  - `getCachedLegalPage(slug: LegalSlug)`

- [ ] **Step 1: Write the failing FAQ splitter test**

Create `src/lib/faq-markdown.test.ts`:

````ts
import { describe, expect, it } from "vitest";
import { splitFaqSections } from "./faq-markdown";

describe("splitFaqSections", () => {
  it("splits on h2 headings", () => {
    const out = splitFaqSections(
      "## How long do I have?\n\n14 days.\n\n## Who pays?\n\nYou do.\n"
    );
    expect(out).toEqual([
      { question: "How long do I have?", answer: "14 days." },
      { question: "Who pays?", answer: "You do." },
    ]);
  });

  it("keeps multi-paragraph answers intact", () => {
    const out = splitFaqSections("## Q\n\nfirst\n\nsecond\n");
    expect(out[0].answer).toBe("first\n\nsecond");
  });

  it("ignores prose before the first heading", () => {
    const out = splitFaqSections("intro text\n\n## Q\n\na\n");
    expect(out).toHaveLength(1);
    expect(out[0].question).toBe("Q");
  });

  it("does not split on h3 or on a bold line that looks like a heading", () => {
    const out = splitFaqSections("## Q\n\n### sub\n\na\n\n**not a heading**\n");
    expect(out).toHaveLength(1);
    expect(out[0].answer).toContain("### sub");
  });

  it("does not treat a ## inside a fenced code block as a heading", () => {
    const out = splitFaqSections("## Q\n\n```\n## not a heading\n```\n");
    expect(out).toHaveLength(1);
  });

  it("returns an empty array for markdown with no headings", () => {
    expect(splitFaqSections("just prose\n")).toEqual([]);
  });
});
````

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/faq-markdown.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the splitter**

Line-based: track whether the cursor is inside a ```fence and skip heading detection while it is; a heading is a line matching`/^##\s+(.+)$/` when not fenced. Trim each answer.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run src/lib/faq-markdown.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the dependencies and the renderer**

Run: `pnpm add react-markdown remark-gfm`

`LegalPageContent` wraps `<ReactMarkdown remarkPlugins={[remarkGfm]}>` in the existing `prose-val` class. Do **not** enable `rehype-raw` or any raw-HTML pass — react-markdown ignores raw HTML by default, and that default is what stops admin-authored content becoming an injection vector.

- [ ] **Step 6: Add the cached fetcher**

In `src/lib/cache.ts`, follow the file's existing shape: add a `LEGAL` tag helper, a 300-second revalidate, and a fetcher that reaches the procedure through `createAnonymousCaller()` — **call the router, do not reimplement its query**, which is the rule that keeps a server-rendered page from drifting from the client's.

- [ ] **Step 7: Convert the five components**

Each becomes a thin server component: read through `getCachedLegalPage`, render `LegalPageContent` (or, for FAQ, feed `splitFaqSections` into the existing accordion).

**Keep the try/catch fallback.** Every CMS-backed section in this codebase wraps its fetch and degrades to a hardcoded default rather than crashing. Here the fallback is the committed markdown imported as a constant, so a database failure still renders a truthful policy page instead of a 500.

The `*Header` components keep their current role and are not touched.

- [ ] **Step 8: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test && pnpm build`
Expected: clean, 0 problems, baseline + 6 tests, **98 static pages**.

- [ ] **Step 9: Read the pages**

`pnpm dev`, then open `/returns`, `/terms`, `/privacy`, `/shipping`, `/faq`. Confirm the prose renders styled (not as raw markdown), the FAQ accordion still expands, and the storefront's dark palette reads correctly.

---

### Task 7: Admin editor

**Files:**

- Create: `src/app/admin/legal/page.tsx`
- Create: `src/components/admin/legal/LegalPageEditor.tsx`
- Create: `src/components/admin/legal/LegalHistoryDialog.tsx`
- Modify: the admin navigation component (find it with `grep -rn "admin/settings" src/components/admin --include=*.tsx`)

**Interfaces:**

- Consumes: `admin.legal.*` (Task 4), `LegalPageContent` (Task 6).

- [ ] **Step 1: Build the editor**

List the five pages; edit one at a time with a textarea beside a live `LegalPageContent` preview; save through `admin.legal.update`.

- [ ] **Step 2: Build the history dialog**

Model it on `src/components/admin/settings/ContentHistoryDialog.tsx` — read it first and follow its shape rather than inventing a second pattern.

**It is a Radix portal.** It attaches to `<body>` and escapes the admin's `ThemeProvider`, so its content must set **both** halves of a colour pair (`bg-background text-foreground`), never a background alone. That exact omission shipped as a white-on-white `AlertDialogContent`.

- [ ] **Step 3: Respect the read-only tier**

A `worker` must be able to open this screen and change nothing. Use `useAdminWriteAccess` and render `AdminReadOnlyBanner`, matching the other admin screens. The server already rejects the mutation; this is so the UI explains why.

- [ ] **Step 4: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: clean, 0 problems.

- [ ] **Step 5: Exercise it**

Edit a page, save, confirm the storefront page reflects it (tag revalidation), then open History and revert, and confirm the revert is itself recorded as a new version.

---

### Task 8: The copy that contradicts the new pages

Correcting the five documents is not enough while other components still make the old promises.

**Files:**

- Modify: `src/components/home/TrustIndicators.tsx`
- Modify: `src/components/returns/ReturnsOptions.tsx`
- Modify: `src/components/returns/ReturnsHeader.tsx`
- Audit: `src/components/faq/FAQSupport.tsx`, `src/components/shipping/ShippingOptions.tsx`, `src/components/shipping/ShippingHeader.tsx`

- [ ] **Step 1: Find every remaining claim**

Run:

```bash
grep -rniE "30[- ]day|prepaid|business days|free return|no.?questions" src/components src/app --include=*.tsx
```

Expected: a list. Every hit is either corrected to match `content/legal/`, or deleted.

- [ ] **Step 2: Correct them**

The homepage `TrustIndicators` badge is the most visible: it currently promises 30-day returns. It must state the same thing `returns.md` states.

- [ ] **Step 3: Verify nothing was missed**

Re-run the grep from Step 1.
Expected: no hit that states a return window, a shipping-cost promise, or a refund timescale inconsistent with `content/legal/returns.md`.

- [ ] **Step 4: Full verification**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test && pnpm build`
Expected: clean, 0 problems, all tests passing, 98 static pages.

---

---

### Task 9: Egypt-appropriate defaults outside the legal pages

Added after a two-pass audit of the repo for non-Egyptian hardcoding. These are
the findings that **no other task covers**. Everything in the five legal page
trees, and `TrustIndicators`, is already handled by Tasks 5-8 — do not touch
those here.

**Files:**

- Create: `src/lib/store-locale.ts`
- Test: `src/lib/store-locale.test.ts`
- Create: `src/domain/addresses/egypt-governorates.ts`
- Test: `src/domain/addresses/egypt-governorates.test.ts`
- Modify: `src/components/account/addresses/AddressFormDialog.tsx`
- Modify: `src/infrastructure/database/repositories/site/site-config.repository.ts`
- Modify: `src/components/account/orders/OrdersList.tsx`
- Modify: `src/components/account/order-detail/OrderDetailHeader.tsx`
- Modify: `src/components/admin/analytics/RevenueTrendChart.tsx`
- Modify: `src/components/admin/dashboard/SalesChart.tsx`
- Modify: `src/components/home/PromoBanner.tsx`

**Interfaces:**

- Produces: `STORE_LOCALE`, `STORE_TIMEZONE` from `@/lib/store-locale`;
  `EGYPT_GOVERNORATES`, `isEgyptGovernorate` from
  `@/domain/addresses/egypt-governorates`.

- [ ] **Step 1: Locale module, test first**

The repo already solved this exact problem for currency: `src/lib/currency.ts`
reads `NEXT_PUBLIC_STORE_CURRENCY` and defaults to `EGP`. Follow it rather than
swapping one hardcoded literal for another.

`src/lib/store-locale.ts`:

```ts
/**
 * Locale and timezone for user-facing date and number formatting.
 *
 * Deployment config, exactly like `STORE_CURRENCY` in `./currency.ts` — a
 * store that moves market changes an env var, not a dozen call sites.
 *
 * The default is `en-GB`, not `en-EG`. Both render day-month-year, which is
 * Egyptian convention, but `en-EG` is not present in every ICU build; when it
 * is missing `Intl` falls back to plain `en`, which renders MONTH-DAY and
 * silently reintroduces the American format this exists to remove. `en-GB` is
 * universally available and cannot fall back to the wrong order.
 *
 * The storefront is English-only by decision, so an Arabic locale is not the
 * default here. Revisit together with Arabic content, not before.
 */
export const STORE_LOCALE = process.env.NEXT_PUBLIC_STORE_LOCALE ?? "en-GB";

/** Egypt observes EET (UTC+2). */
export const STORE_TIMEZONE =
  process.env.NEXT_PUBLIC_STORE_TIMEZONE ?? "Africa/Cairo";
```

`store-locale.test.ts` asserts: the default is `en-GB` when the env var is
absent; the default timezone is `Africa/Cairo`; and — the point of the test —
that `new Date("2026-09-08").toLocaleDateString(STORE_LOCALE)` puts the **day
before the month**, so the constant is checked by behaviour rather than by
string equality with itself.

- [ ] **Step 2: Replace the five hardcoded `en-US` formatters**

In `OrdersList.tsx`, `OrderDetailHeader.tsx`, `RevenueTrendChart.tsx` and
`SalesChart.tsx`, replace the literal `"en-US"` passed to
`toLocaleDateString` with `STORE_LOCALE`. Keep every options object exactly as
it is. In `site-config.repository.ts`, replace `locale: "en-US"` with
`STORE_LOCALE` and `timezone: "UTC"` with `STORE_TIMEZONE`.

- [ ] **Step 3: Governorates, test first**

`src/domain/addresses/egypt-governorates.ts` — the 27 governorates as a
`readonly` array of `{ code, en, ar }`, plus
`isEgyptGovernorate(value: string): boolean`. Zero imports; it lives in
`domain/` for the same reason `legal-slugs.ts` does.

Tests: the list has exactly 27 entries; codes are unique; `Cairo` and `Giza`
are present; a `Sunday`-style non-governorate is rejected; lookup is
case-sensitive in the same way `isLegalSlug` is.

- [ ] **Step 4: Fix the address form**

`AddressFormDialog.tsx` currently reads:

```tsx
label = "State/Province";
label = "ZIP/Postal Code";
```

Egypt has governorates, not states, and "ZIP" is a USPS term. Change the first
to `Governorate` and render it as a `<select>` populated from
`EGYPT_GOVERNORATES` (English names). Change the second to `Postal Code`.

**Do not change the database column or its type.** `addresses.state` stays
free text, so every address already saved keeps working. If a stored value is
not in the list, the select must still show it rather than silently blanking
the field — an existing customer's saved address must not be corrupted by
opening the form.

- [ ] **Step 5: PromoBanner**

It hardcodes `"Winter Sale"`. Replace with season-neutral copy. Do **not**
try to make it CMS-driven: the `promo_banner` section type was deliberately
deleted from `contentSchemaMap`, and re-adding one means touching five places
per this project's own guidance. That is its own job, not this one.

- [ ] **Step 6: Verify**

```
rm -rf .next && pnpm type-check && pnpm lint && pnpm test
```

Type-check clean, lint 0 problems, and the suite up by the new tests.

**Explicitly out of scope, recorded so it is not mistaken for missed:**
the dead `"paypal"` value in the `schema.ts` payment enum stays. Removing a
value from a Postgres enum needs a migration against a live database, and this
plan touches no database. The FAQ text that advertised PayPal is corrected in
Task 5.

## Decisions — SETTLED. Do not re-open these.

### 1. Return window — **14 days**

The no-reason change-of-mind window is the statutory **14 days from receipt**,
with the **customer** bearing return shipping. Chosen because 14 days is both
the statutory floor and the market norm the owner is matching.

The **30-day defect window**, with the **supplier** bearing return shipping
after inspection, applies regardless and must appear as a separate right. The
whole point of this page is that these two are not the same thing.

### 2. `user.birthday` — **keep, with a stated purpose**

`privacy.md` states that date of birth is collected **to send customers a
birthday offer**. Do not remove the field from `SignupForm` or `lib/auth.ts`.

### 3. Arabic — **English only for now**

No `locale` column, no translated content in this plan. Revisit when Arabic
text actually exists; it is a five-row table and adding the dimension later is
cheap.

### 4. Cookie consent — **out of scope, and currently unnecessary**

Verified against the codebase: there are **no analytics scripts, no advertising
pixels and no non-essential cookies** anywhere in `src/`. Do not add a cookie
banner, and do not write a cookie policy describing trackers that do not exist.
`privacy.md` may describe only the essential session cookie the app actually
sets. If a pixel is ever added, cookie consent becomes its own sub-project.

### 5. Shipping table — bracketed placeholders

`shipping.md` cannot be written from research; it needs the store's real
operating figures. The shape to fill in (a competitor's published page is the
model for the structure, not the values):

- Order processing time before dispatch, in working days
- Delivery window for **Cairo & Giza**
- Delivery window for **Delta governorates**
- Delivery window for **all other governorates**
- Shipping fee for Cairo & Giza, in EGP
- Shipping fee for other areas, in EGP
- Free-shipping threshold, if any, in EGP
- How the customer receives tracking (SMS, email, WhatsApp)

Do **not** publish a statutory maximum delivery period. The "30 days from
contract" figure that appeared in research is unverified.

### 3. `user.birthday`

Collected at sign-up, and nothing in the codebase reads it. Either give it a
stated purpose in `privacy.md` or stop collecting it. Do not invent a purpose.

### 4. Arabic

Research is consistent that Arabic is the legally safer language for
consumer-facing terms in Egypt and that an English-only store carries avoidable
enforceability risk; bilingual presentation is acceptable. This plan builds
English pages only. Translation is a separate sub-project, and the `legal_pages`
table would need a language dimension to hold it — worth deciding **now**,
because adding `locale` to the table later is a migration on live legal content.

### 5. Cookie consent — out of scope here, but it is a real gap

The spec scoped cookie-banner UI out. Research indicates a cookie register
(provider, cookie name, purpose, duration, whether data leaves Egypt) is
expected, and PDPL enforcement lands around October/November 2026. If any
analytics or advertising pixel is added to this store, this stops being
optional. Track it as its own sub-project rather than smuggling it in here.

### 6. Not code — flagged so it is not mistaken for done

Publishing a compliant privacy policy is not the same as being compliant. Every
processor this store uses is outside Egypt (Stripe, Resend, UploadThing, Neon,
Upstash, Vercel, Google, Facebook), and the PDPL treats international transfer
as requiring a documented assessment, written controller-processor terms, and
potentially a permit or licence from the Personal Data Protection Centre — not
merely a disclosure paragraph. A Data Protection Officer may also be required;
being a small retailer is not an automatic exemption. These are legal and
operational tasks for the owner and cannot be closed by this plan.

## Definition of done

- `pnpm test` green, no drop from baseline
- `rm -rf .next && pnpm type-check` clean
- `pnpm lint` 0 problems
- `pnpm build` 98 static pages
- `pnpm seed:legal` idempotent, writes no history rows
- No page states an unverified statutory fact
- Every owner-supplied identifier is a visible `[BRACKETED]` placeholder
- All work left **uncommitted** for the repo owner to review
