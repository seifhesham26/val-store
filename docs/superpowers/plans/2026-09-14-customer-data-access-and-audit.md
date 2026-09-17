# Customer-data access and audit implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict launch customer data by staff role, make every sensitive reveal and order-detail view auditable, and add the approved support and oversight UI.

**Architecture:** Keep role predicates and access decisions pure in `domain/`; put audit orchestration behind an application use case and repository interface; implement persistence with Drizzle; keep tRPC handlers as validation/adaptation boundaries. Default DTOs are deliberately masked, and reveal operations record an append-only event before returning protected values.

**Tech Stack:** TypeScript, Next.js 16 App Router, tRPC v11, Drizzle/PostgreSQL, React 19, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-customer-data-access-and-audit-design.md`

**Completion:** Implemented and independently reviewed on 2026-09-15. Review
hardening moved audit visibility to stored per-event role snapshots, tied
customer-request confirmation to a validated grant, limited exact-email results
to historical orders, reset confirmation when the email changes, and moved
staff order masking to SQL projections with a separate audited shipping-only
read. Final verification: 768/768 unit tests, 54/54 integration tests, clean
type-check, clean lint, and successful production build.

## Global constraints

- Treat `docs/PRELAUNCH-HANDOFF.md` and the linked spec as newer than conflicting older documentation.
- Preserve the untracked handoff file.
- Do not run `pnpm db:migrate` on the current development database.
- Do not add `media_buyer`, OTP, payment-provider, birthday-reward, assignment, or generic policy-engine work.
- Audit insertion must succeed before protected data is returned.
- Never store revealed values in an audit row.
- Follow strict onion dependencies: domain imports no Drizzle or infrastructure code.

---

### Task 1: Pure launch access policy

**Files:**

- Create: `src/domain/customer-access/customer-access-policy.ts`
- Test: `src/domain/customer-access/customer-access-policy.test.ts`
- Modify: `src/domain/customers/value-objects/user-role.ts`

**Interfaces:**

- Produces: `isActiveFulfillmentStatus(status): boolean`, `canBrowseCustomerDirectory(role): boolean`, `canExportOrders(role): boolean`, and `canReviewAccessFor(viewer, actor): boolean`.
- Produces: literal `ACCESS_REASONS`, `AccessReason`, `AccessAction`, and `AccessFieldGroup` types shared by application and server layers.

- [ ] **Step 1: Write policy tests first** covering active versus historical statuses, worker/admin directory and export access, and the exact audit-view matrix. Use literal expected booleans so changing the wrong role branch fails.
- [ ] **Step 2: Run `pnpm vitest run src/domain/customer-access/customer-access-policy.test.ts`** and confirm the module-not-found failure is caused by the missing production policy.
- [ ] **Step 3: Implement the minimal pure predicates and string unions**. Keep `media_buyer` out of `UserRole`.
- [ ] **Step 4: Re-run the focused test** and confirm it passes.

### Task 2: Append-only audit persistence and fail-closed orchestration

**Files:**

- Modify: `src/db/schema.ts`
- Create: `drizzle/0008_customer_data_access_audit.sql`
- Create: `src/domain/customer-access/customer-access-audit.repository.ts`
- Create: `src/application/customer-access/record-customer-access.use-case.ts`
- Create: `src/application/customer-access/customer-access.container.ts`
- Create: `src/application/customer-access/index.ts`
- Create: `src/infrastructure/database/repositories/customer-access/customer-access-audit.repository.ts`
- Modify: `src/application/container.ts`
- Test: `src/application/customer-access/record-customer-access.use-case.test.ts`

**Interfaces:**

- `RecordCustomerAccessInput` contains actor snapshot, optional subject/order ids, action, field group, reason, optional note, and confirmation.
- `CustomerAccessAuditRepository.record(input): Promise<CustomerAccessAuditRecord>` deletes rows older than 12 months and inserts the new row in one transaction.
- `RecordCustomerAccessUseCase.execute(input)` validates cross-field rules (`other` requires a note; customer support lookup requires confirmation) and awaits persistence.

- [ ] **Step 1: Write failing use-case tests** proving required confirmation/note validation and proving a repository rejection is propagated rather than swallowed.
- [ ] **Step 2: Run the focused test** and observe failure because the use case does not exist.
- [ ] **Step 3: Add the domain contract and application use case** with no database imports.
- [ ] **Step 4: Re-run the focused test** and make it green with the minimal implementation.
- [ ] **Step 5: Add the additive Drizzle table and SQL artifact** with indexes on `(actor_user_id, created_at)`, `(subject_user_id, created_at)`, `(order_id, created_at)`, and `created_at`. Do not add raw-value columns and do not run `db:migrate`.
- [ ] **Step 6: Implement the Drizzle repository and container wiring**. The transaction deletes rows with `created_at < now - interval '12 months'` before inserting.
- [ ] **Step 7: Run the focused use-case test and `pnpm type-check` after clearing `.next`**.

### Task 3: Capability-aware tRPC boundaries and minimized customer DTOs

**Files:**

- Modify: `src/server/trpc.ts`
- Modify: `src/server/trpc.test.ts`
- Modify: `src/server/admin-write-gating.test.ts`
- Modify: `src/server/routers/admin/customers.ts`
- Test: `src/server/routers/admin/customer-access-input.test.ts`

**Interfaces:**

- Produces `customerDirectoryProcedure` for admin/super reads and audited data-access mutations.
- `customers.list/getById/getCount` use that procedure and explicit projections.
- `customers.supportLookup` accepts exact email, `confirmedCustomerRequest: true`, reason and note; it logs before returning the minimal customer and historical order summaries plus the lookup audit id.
- `customers.revealContact` accepts customer id/reason/note; it logs before returning phone and saved shipping addresses only.

- [ ] **Step 1: Extend middleware tests first** so a worker is rejected from `customerDirectoryProcedure` while admin/super are accepted.
- [ ] **Step 2: Add schema tests first** for exact-email validation, mandatory confirmation, allowed reason codes, and `other` note requirements.
- [ ] **Step 3: Run both focused tests** and confirm the new behavior fails for the expected missing exports/schemas.
- [ ] **Step 4: Implement `customerDirectoryProcedure`** by reusing the admin/super role gate without conflating it with write authority.
- [ ] **Step 5: Replace broad customer reads with explicit columns**. Customer order summaries contain only id/order number/status/total/date/item count; no snapshots, notes, payment metadata, or product relation.
- [ ] **Step 6: Implement exact-email support lookup and admin contact reveal**. Await `RecordCustomerAccessUseCase` before returning any protected response.
- [ ] **Step 7: Update the source gate** so ordinary queries remain on `adminProcedure`, customer-directory reads use `customerDirectoryProcedure`, and audited worker-access mutations are explicit named exceptions.
- [ ] **Step 8: Run the focused tests and the existing admin gate test**.

### Task 4: Masked order APIs, historical support gate, reveals, and export audit

**Files:**

- Create: `src/application/customer-access/staff-order-access.service.ts`
- Test: `src/application/customer-access/staff-order-access.service.test.ts`
- Modify: `src/server/routers/admin/orders.ts`
- Modify: `src/application/orders/use-cases/get-order.use-case.ts`
- Modify: `src/application/orders/use-cases/get-order.use-case.test.ts`
- Modify: `src/application/orders/use-cases/list-orders.use-case.ts`
- Modify: `src/application/orders/use-cases/list-orders.use-case.test.ts`

**Interfaces:**

- Default order detail has `shippingAddress: null` and `billingAddress: null`, plus `hasShippingAddress`.
- Worker list rows have `customerEmail: null`; admin and super rows retain email.
- Historical worker access requires a valid recent support-lookup audit id owned by the actor and matching the order customer. Admin/super need no lookup grant.
- `orders.revealDelivery` records access and returns shipping address only.
- `orders.recordExport` rejects workers and records an export event for admin/super.

- [ ] **Step 1: Write failing policy-service tests** for worker active access, worker historical denial, matching lookup-grant access, admin historical access, and audit failure propagation.
- [ ] **Step 2: Write failing DTO tests** proving billing is absent/default-masked and worker list mapping removes email without mutating the admin result.
- [ ] **Step 3: Run the focused tests** and observe failures caused by the missing masking/access behavior.
- [ ] **Step 4: Implement the minimal application service and DTO mappers**.
- [ ] **Step 5: Update order routes** to audit detail opens, enforce worker historical grants, expose the shipping reveal mutation, and add the admin/super export-audit mutation.
- [ ] **Step 6: Run all focused order/access tests and the admin source gate test**.

### Task 5: Staff UI for deliberate reveals and exact-email support

**Files:**

- Modify: `src/app/admin/orders/page.tsx`
- Modify: `src/components/admin/orders/list/OrdersListHeader.tsx`
- Modify: `src/components/admin/orders/list/OrdersTable.tsx`
- Modify: `src/components/admin/orders/OrderDetail.tsx`
- Modify: `src/components/admin/orders/detail/AddressesCard.tsx`
- Modify: `src/components/admin/orders/detail/types.ts`
- Modify: `src/app/admin/customers/page.tsx`
- Modify: `src/components/admin/customers/CustomerDetailDialog.tsx`
- Create: `src/components/admin/customers/WorkerSupportLookup.tsx`
- Create: `src/components/admin/customers/CustomerContactReveal.tsx`
- Modify: `src/components/admin/AdminSidebar.tsx`

**Interfaces:**

- Worker order rows omit email and worker search does not inspect it.
- Order detail renders masked shipping copy until the reveal succeeds; billing has no card.
- Worker customer page is an exact-email form with unchecked confirmation and required reason; it renders only the returned support result and links with the lookup audit id.
- Admin contact reveal has a reason selector and an `other` note; revealed data stays in component-local state and disappears when the dialog closes.
- Export waits for `orders.recordExport` success before creating the CSV and is not rendered for workers.

- [ ] **Step 1: Extract/test any non-trivial form validation or view-model mapping as pure functions first**; do not add source-text or mocked-component assertions.
- [ ] **Step 2: Run each focused test and observe the expected failure**.
- [ ] **Step 3: Implement the worker/admin conditional customer page and sidebar label** while keeping the server as the authority.
- [ ] **Step 4: Implement masked order detail and local-session delivery reveal**.
- [ ] **Step 5: Gate/export through the audited server operation and remove email from worker rendering/search**.
- [ ] **Step 6: Run focused tests, then `pnpm type-check` after removing `.next`**.

### Task 6: Audit review UI and retention-facing copy

**Files:**

- Create: `src/server/routers/admin/access-audit.ts`
- Modify: `src/server/routers/admin/index.ts`
- Create: `src/components/admin/customers/StaffAccessHistory.tsx`
- Modify: `src/components/admin/customers/CustomerDetailDialog.tsx`
- Create: `src/app/admin/access-history/page.tsx`
- Modify: `src/components/admin/AdminSidebar.tsx`
- Test: `src/application/customer-access/access-audit-visibility.test.ts`

**Interfaces:**

- `accessAudit.listForStaff({ staffUserId, limit, offset })` applies the approved viewer matrix before querying.
- Staff-profile history displays action, order/customer reference, reason/note, confirmation, and time; never raw revealed data.
- The self-history page always requests the signed-in actor’s own events.

- [ ] **Step 1: Write failing visibility tests** for every viewer/actor role pair and for an unavailable/deleted actor.
- [ ] **Step 2: Run the focused test** and confirm it fails for missing list authorization.
- [ ] **Step 3: Add repository list methods and the thin audit router** using the pure visibility predicate.
- [ ] **Step 4: Add staff-profile history and self-history UI** with plain-language event labels.
- [ ] **Step 5: Run focused tests and type-check**.

### Task 7: Documentation and full verification

**Files:**

- Modify: `AGENTS.md`
- Modify: `docs/PRELAUNCH-HANDOFF.md` only if the user explicitly asks; otherwise preserve it untouched.

**Interfaces:**

- Documentation states the actual permission tiers, audit retention, support lookup, masking rules, and the schema-application requirement.

- [ ] **Step 1: Update `AGENTS.md`** to remove the obsolete statement that workers read every address/order history and document the new route/procedure traps.
- [ ] **Step 2: Inspect `git diff --check` and `git status --short`**; confirm the handoff remains unmodified and untracked.
- [ ] **Step 3: Run `pnpm test`** and record the exact passing count.
- [ ] **Step 4: Remove `.next`, then run `pnpm type-check`**.
- [ ] **Step 5: Run `pnpm lint`**.
- [ ] **Step 6: Run `pnpm build`**.
- [ ] **Step 7: Run `pnpm test:integration` only after the additive audit table exists in the development schema; never run `pnpm db:migrate`**.
- [ ] **Step 8: Re-read the spec and check every approved rule against code and tests before reporting completion**.
