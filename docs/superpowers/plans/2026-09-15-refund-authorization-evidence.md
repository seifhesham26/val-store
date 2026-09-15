# Refund Authorization and Inspection Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a customer return request, evidence-backed inspection, hardcoded refund calculation, customer acknowledgment/OTP gate, and admin authorization around the existing partial-return model without moving provider money before OPay exists.

**Architecture:** Keep refund policy in pure domain code and persist only return facts, evidence metadata, calculated amounts, and audit timestamps. A return request owns the customer/admin workflow; finalization delegates to one transaction that locks the request, order, order lines, and variants before recording the approved return and any restock. UploadThing stores private evidence files and the API returns short-lived signed URLs only after request-scoped authorization.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, tRPC v11, Drizzle/PostgreSQL, React Query, UploadThing, Tailwind 4/shadcn, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-15-refund-authorization-evidence-design.md`

## Global Constraints

- Refund policy is hardcoded in application code; do not add a refund settings table or editable refund controls.
- Use 14 days for normal returns and 30 days for defective/wrong returns; code may not shorten those windows.
- Unworn/try-on change-of-mind refunds are 100% of actual paid item value; worn-but-resellable change-of-mind goodwill is 70%.
- Defective, wrong, or misdescribed items refund 100% of actual paid item value plus applicable original delivery; customer-caused change-of-mind damage is rejected.
- Change-of-mind keeps the original outbound delivery fee and Valkyrie pays one return pickup; rejected customer-caused returns keep that fee and charge collection.
- Coupon discounts are allocated proportionally; refund totals never exceed captured payment and coupons are not restored.
- Every customer-facing outcome requires a server-enforced ten-second read gate and acknowledgment; positive refunds additionally require a one-minute, single-use, five-attempt OTP.
- Resending an OTP invalidates the previous challenge; proposal changes invalidate acknowledgment and OTP.
- Customer condition/package photos precede pickup; receiving staff records an unboxing/inspection video before the final outcome.
- Workers may fulfil and upload evidence but cannot approve/reject a refund; admins and super admins approve/reject.
- Rejected outcomes require acknowledgment but no OTP and never change stock.
- Do not add OPay calls, provider-side money movement, direct worker stock writes, assignments, `media_buyer`, or arbitrary formula editors.
- Use `pnpm db:push` for additive schema work only when executing the plan. Never run `pnpm db:migrate` on the current development database.
- Remove stale `.next` before trusting `pnpm type-check`.

---

## File map

### New files

- `src/domain/refunds/refund-policy.ts` — hardcoded windows, percentages, fee rules, and pure calculation.
- `src/domain/refunds/refund-policy.test.ts` — complete policy boundary table and rounding cases.
- `src/domain/refunds/return-request.ts` — return reasons, outcomes, statuses, transitions, and database-independent records.
- `src/domain/refunds/return-request.test.ts` — transition and invariant tests.
- `src/domain/refunds/interfaces/return-request.repository.interface.ts` — request/evidence/proposal/finalization contract.
- `src/application/refunds/use-cases/create-return-request.use-case.ts` — customer-owned request creation.
- `src/application/refunds/use-cases/authorize-return-pickup.use-case.ts` — admin eligibility decision.
- `src/application/refunds/use-cases/record-return-inspection.use-case.ts` — staff inspection and proposal calculation.
- `src/application/refunds/use-cases/acknowledge-return-proposal.use-case.ts` — server-enforced read gate.
- `src/application/refunds/use-cases/request-return-otp.use-case.ts` — challenge creation and provider boundary.
- `src/application/refunds/use-cases/confirm-return-otp.use-case.ts` — single-use verification and finalization.
- `src/application/refunds/use-cases/reject-return.use-case.ts` — admin rejection with evidence/reason.
- `src/application/refunds/refund-otp.service.ts` — hashed challenge lifecycle and provider interface.
- `src/application/refunds/refund-otp.service.test.ts` — expiry, resend, attempt, and single-use tests.
- `src/application/refunds/refunds.container.ts` — lazy repositories/use cases and provider injection.
- `src/infrastructure/database/repositories/refunds/return-request.repository.ts` — Drizzle persistence and locking.
- `src/infrastructure/database/repositories/refunds/return-request.repository.integration.test.ts` — real-database lifecycle/concurrency tests.
- `src/infrastructure/services/uploadthing-evidence-storage.service.ts` — signed private evidence URLs.
- `src/server/routers/public/returns.ts` — authenticated customer request/proposal/OTP procedures.
- `src/server/routers/admin/returns.ts` — worker reads/evidence and admin review procedures.
- `src/app/admin/returns/page.tsx` — admin return queue.
- `src/components/admin/returns/ReturnQueue.tsx` — grouped request list and pending count.
- `src/components/admin/returns/ReturnReview.tsx` — evidence, inspection, calculation, and approve/reject controls.
- `src/components/admin/returns/ReturnEvidenceViewer.tsx` — authorized image/video viewer.
- `src/components/account/order-detail/ReturnRequestCard.tsx` — customer request status and action entry point.
- `src/components/account/order-detail/ReturnRequestDialog.tsx` — line/reason request form.
- `src/components/account/order-detail/ReturnEvidenceUpload.tsx` — required pre-pickup photographs.
- `src/components/account/order-detail/ReturnProposalDialog.tsx` — ten-second acknowledgment and OTP entry.
- `src/hooks/use-read-before-confirm.ts` — visible-page ten-second timer with reset behavior.
- `src/hooks/use-read-before-confirm.test.ts` — timer and reset tests.

### Existing files with focused changes

- `src/db/schema.ts`, `src/db/relations.ts` — return status/reason/outcome/evidence enums, request tables, OTP table, and `orders.refundedShippingAmount`.
- `src/domain/orders/entities/order.entity.ts` — include refunded delivery in derived totals and expose shipping refund bounds.
- `src/domain/orders/interfaces/repositories/order.repository.interface.ts` — authorized return input with shipping refund and request idempotency.
- `src/infrastructure/database/repositories/orders/order.repository.ts` — lock order/lines, guard shipping and quantities, and record the approved return atomically.
- `src/application/orders/use-cases/refund-order.use-case.ts` — reduce to the internal authorized-recording adapter; no caller may submit an unapproved refund.
- `src/application/orders/order.container.ts`, `src/application/container.ts` — wire refund request module and shared order dependencies.
- `src/server/routers/public/index.ts`, `src/server/routers/admin/index.ts` — mount return routers.
- `src/server/routers/admin/orders.ts` — remove direct line-based `refund` mutation and retain cancellation/status behavior.
- `src/server/admin-write-gating.test.ts` — assert worker-readable return queries and admin-only review mutations.
- `src/lib/uploadthing.ts`, `src/components/ui/upload.tsx` — private customer-photo and receiving-video routes/helpers.
- `src/application/notifications/notification.service.ts`, `src/db/schema.ts`, `src/components/notifications/notification-visuals.ts` — return-request admin/customer notification types.
- `src/components/account/order-detail/OrderDetailHeader.tsx`, `OrderItems.tsx`, `OrderSummaryCard.tsx` — return entry point and refund/proposal display.
- `src/app/(main)/account/orders/[id]/page.tsx` — supply the return request read model.
- `src/components/admin/orders/OrderDetail.tsx`, `src/components/admin/orders/detail/CloseOrderDialog.tsx`, `UpdateStatusCard.tsx` — remove the refund bypass and link staff to the return queue/detail.
- `src/server/routers/public/orders.ts` — include request summaries without leaking other customers’ data.
- `docs/REFUNDS.md`, `docs/PRELAUNCH-HANDOFF.md` — verification counts, implemented boundaries, and external blockers.

---

### Task 1: Encode the hardcoded policy as pure domain logic

**Files:**

- Create: `src/domain/refunds/refund-policy.ts`
- Test: `src/domain/refunds/refund-policy.test.ts`

**Interfaces:**

- Produces `REFUND_POLICY`, `ReturnReason`, `InspectionOutcome`, `RefundCalculationInput`, `RefundCalculation`, and `calculateRefund()`.
- `calculateRefund()` accepts paid item amounts, item outcomes, original delivery, whether the whole order is returned, and the carrier collection fee. It returns item refund, delivery refund, customer collection due, total refund, and disposition.

- [ ] **Step 1: Write the failing policy tests**

```ts
it.each([
  ["change_of_mind", "unworn", 1000, 1000],
  ["change_of_mind", "worn_resellable", 1000, 700],
  ["defective", "defective", 1000, 1000],
])("calculates the approved item amount", (reason, outcome, paid, expected) => {
  expect(
    calculateRefund({
      reason,
      items: [{ paidAmount: paid, outcome }],
      originalDelivery: 80,
      returnedAllOrder: true,
      collectionFee: 60,
    }).itemRefund
  ).toBe(expected);
});

it("refunds original delivery only for a full merchant-fault return", () => {
  expect(
    calculateRefund({
      reason: "defective",
      items: [{ paidAmount: 450, outcome: "defective" }],
      originalDelivery: 80,
      returnedAllOrder: true,
      collectionFee: 60,
    }).deliveryRefund
  ).toBe(80);
});

it("rejects customer-caused damage and charges collection", () => {
  expect(
    calculateRefund({
      reason: "change_of_mind",
      items: [{ paidAmount: 1000, outcome: "customer_damage" }],
      originalDelivery: 80,
      returnedAllOrder: false,
      collectionFee: 60,
    })
  ).toMatchObject({
    disposition: "rejected",
    totalRefund: 0,
    customerCollectionDue: 60,
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run src/domain/refunds/refund-policy.test.ts`

Expected: FAIL because the policy module and calculation do not exist.

- [ ] **Step 3: Implement the minimal pure calculation**

Use `Math.round(value * 100) / 100` for money. Scale the already coupon-adjusted line amount; do not recalculate list prices. Apply 70% only to `worn_resellable` change-of-mind lines. Apply original delivery only when the return is full and merchant-fault. Set customer collection due only for rejected customer-caused outcomes.

- [ ] **Step 4: Run focused tests and add rounding/branch cases**

Run: `pnpm vitest run src/domain/refunds/refund-policy.test.ts`

Add cases for zero delivery, multiple lines, partial defect, mixed outcomes, two-decimal rounding, and the captured-payment cap. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/refunds/refund-policy.ts src/domain/refunds/refund-policy.test.ts
git commit -m "feat(refunds): Add hardcoded refund policy"
```

### Task 2: Add operational return and evidence records

**Files:**

- Modify: `src/db/schema.ts`, `src/db/relations.ts`
- Modify: `src/domain/orders/entities/order.entity.ts`
- Modify: `src/domain/orders/interfaces/repositories/order.repository.interface.ts`
- Test: `src/db/schema.test.ts` only if existing schema tests cover new enums

**Interfaces:**

- `return_requests` owns order/customer/status/review/proposal/acknowledgment fields.
- `return_request_items` owns requested/inspected/approved/restocked quantities, outcome, and item refund.
- `return_evidence` owns private storage key, evidence kind, MIME/size, uploader, and timestamps.
- `return_otp_challenges` owns only a hash, expiry, attempt count, consumed time, and request id.
- `orders.refundedShippingAmount` stores the already-recorded delivery refund aggregate; it is not policy configuration.

- [ ] **Step 1: Define exact enums and tables**

Use statuses `requested`, `awaiting_customer_evidence`, `pickup_authorized`, `in_transit`, `received`, `awaiting_customer_confirmation`, `confirmed`, `recorded`, `rejected`, and `evidence_exception`. Use reasons `change_of_mind`, `defective`, `wrong_item`, `not_as_described`, and `late_delivery`. Use item outcomes `unworn`, `worn_resellable`, `defective`, `customer_damage`, and `rejected`.

Every foreign key is indexed. Add a unique `(request_id, order_item_id)` constraint. Store money as `decimal(10,2)` strings, file keys rather than public URLs, and no plaintext OTP.

- [ ] **Step 2: Extend order money projection**

Add `refundedShippingAmount` to the order row/entity with a zero default. Make `refundedAmount()` return item refund plus this aggregate, and make the repository hydrate it. Existing rows remain valid with zero.

- [ ] **Step 3: Apply the additive schema through the approved workflow**

Run: `pnpm db:push`

Do not run `pnpm db:migrate`. Confirm the generated SQL is additive and contains no refund-policy settings table.

- [ ] **Step 4: Run static verification**

Run: `pnpm lint` and `pnpm type-check` after clearing `.next`. Expected: PASS after any generated-type updates.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/relations.ts src/domain/orders/entities/order.entity.ts src/domain/orders/interfaces/repositories/order.repository.interface.ts
git commit -m "feat(refunds): Add return request records"
```

### Task 3: Implement request persistence and locking

**Files:**

- Create: `src/domain/refunds/return-request.ts`
- Create: `src/domain/refunds/return-request.test.ts`
- Create: `src/domain/refunds/interfaces/return-request.repository.interface.ts`
- Create: `src/infrastructure/database/repositories/refunds/return-request.repository.ts`
- Create: `src/infrastructure/database/repositories/refunds/return-request.repository.integration.test.ts`
- Modify: `src/infrastructure/database/repositories/orders/order.repository.ts`

**Interfaces:**

- `ReturnRequestRepositoryInterface.create(input)` returns a request and lines.
- `findForCustomer(requestId, userId)` and `listForOrder(orderId, userId)` enforce ownership at the repository boundary.
- `listWork()` returns pending requests and evidence states without customer contact fields.
- `attachEvidence(input)` accepts only an authorized request, evidence kind, and storage metadata.
- `recordInspection(input)` and `saveProposal(input)` are guarded by the current status and reviewer role supplied by the use case.
- `finalize(input)` locks the request and order, verifies the confirmed proposal, records the approved return once, and marks the request `recorded`.

- [ ] **Step 1: Write transition and stale-state tests**

Cover `requested → awaiting_customer_evidence → pickup_authorized → in_transit → received → awaiting_customer_confirmation → confirmed → recorded`, rejection from every pre-recorded review state, and rejection of evidence/proposal/confirmation calls from the wrong state.

- [ ] **Step 2: Write integration tests for duplicate finalization**

Start two transactions against one request. Both attempt `finalize()`. The row lock and guarded status update must let exactly one record the return; the other returns a conflict without incrementing `order_items.refunded_quantity` or `orders.refunded_shipping_amount`.

- [ ] **Step 3: Implement repository queries and evidence metadata**

Use explicit projections. Customer reads filter by `user_id`; staff reads omit customer email/address fields. Evidence rows expose storage keys only internally.

- [ ] **Step 4: Extract the order return transaction**

Refactor the current line-return transaction into an internal helper that accepts `{ orderId, lines, shippingRefund, requestId, reason }`, locks the order before reading refundable quantities, locks variant rows in sorted order, guarded-increments line quantities, and increments shipping refund only within `shippingCost - refundedShippingAmount`. It must be idempotent by request id.

- [ ] **Step 5: Run repository tests**

Run: `pnpm vitest run src/domain/refunds src/infrastructure/database/repositories/refunds/return-request.repository.integration.test.ts src/infrastructure/database/repositories/orders/order.repository.test.ts`

Expected: unit tests pass; integration tests run only when `DATABASE_URL` is available and otherwise are reported as environment-blocked.

- [ ] **Step 6: Commit**

```bash
git add src/domain/refunds src/infrastructure/database/repositories/refunds src/infrastructure/database/repositories/orders/order.repository.ts
git commit -m "feat(refunds): Add locked return request persistence"
```

### Task 4: Add refund application use cases and dependency injection

**Files:**

- Create: `src/application/refunds/use-cases/create-return-request.use-case.ts`
- Create: `src/application/refunds/use-cases/authorize-return-pickup.use-case.ts`
- Create: `src/application/refunds/use-cases/record-return-inspection.use-case.ts`
- Create: `src/application/refunds/use-cases/acknowledge-return-proposal.use-case.ts`
- Create: `src/application/refunds/use-cases/request-return-otp.use-case.ts`
- Create: `src/application/refunds/use-cases/confirm-return-otp.use-case.ts`
- Create: `src/application/refunds/use-cases/reject-return.use-case.ts`
- Create: `src/application/refunds/refund-otp.service.ts`
- Create: `src/application/refunds/refunds.container.ts`
- Modify: `src/application/container.ts`, `src/application/orders/order.container.ts`
- Test: `src/application/refunds/refund-workflow.use-cases.test.ts`

**Interfaces:**

- Customer use cases accept the authenticated `userId`; staff use cases accept `{ id, role }` and reject workers for final review.
- `CreateReturnRequestUseCase.execute({ userId, orderId, lines, reason, note })` creates only a request and never touches stock or payment.
- `RecordReturnInspectionUseCase.execute({ actor, requestId, lines, evidenceComplete })` calculates and stores the proposal using `calculateRefund()`.
- `AcknowledgeReturnProposalUseCase.execute({ userId, requestId, readStartedAt })` records acknowledgment only when server time is at least ten seconds after the stored read start.
- `ConfirmReturnOtpUseCase.execute({ userId, requestId, challengeId, code })` verifies the challenge and calls repository finalization exactly once.

- [ ] **Step 1: Write use-case role and state tests**

Assert customers can create/read only their own requests, workers can upload/record intake evidence but cannot approve/reject, admins/super admins can review, and stale requests return conflicts rather than overwriting newer proposals.

- [ ] **Step 2: Implement request creation and pickup authorization**

Validate order ownership, delivered/eligible status, 14/30-day window, remaining refundable quantity, and one request line per order item. Notify admins after durable creation; notification failure must not roll back the request.

- [ ] **Step 3: Implement inspection/proposal calculation**

Require the receiving video unless an audited media exception is supplied. Persist line outcomes and the complete itemized calculation. Reject customer-caused outcomes with collection due and no refund; do not call the order repository yet.

- [ ] **Step 4: Implement acknowledgment and finalization orchestration**

Persist `readStartedAt`, enforce the ten-second server interval, require acknowledgment before OTP, and pass the stored proposal—not client-supplied amounts—to `finalize()`.

- [ ] **Step 5: Run focused use-case tests and commit**

Run: `pnpm vitest run src/application/refunds`

```bash
git add src/application/refunds src/application/container.ts src/application/orders/order.container.ts
git commit -m "feat(refunds): Add request workflow use cases"
```

### Task 5: Add private inspection evidence storage

**Files:**

- Modify: `src/lib/uploadthing.ts`, `src/components/ui/upload.tsx`
- Create: `src/infrastructure/services/uploadthing-evidence-storage.service.ts`
- Modify: `src/application/interfaces/file-upload.interface.ts` only if a signed-URL method is needed by the existing interface
- Test: `src/infrastructure/services/uploadthing-evidence-storage.service.test.ts`

**Interfaces:**

- Add private `returnCustomerEvidence` image route accepting exactly the request id and kind as validated input.
- Add private `returnReceivingEvidence` video route accepting exactly one request id and kind.
- Middleware authorizes the customer for customer photos and worker/admin/super-admin for receiving video; `onUploadComplete` records metadata through the application use case.
- `UploadThingEvidenceStorage.getSignedUrl(storageKey)` calls `UTApi.generateSignedURL()`; routers never return permanent public URLs.

- [ ] **Step 1: Add failing authorization tests**

Cover wrong customer, unrelated request id, worker upload of customer evidence, customer upload of receiving evidence, wrong MIME/kind, and evidence upload after the request is rejected/recorded.

- [ ] **Step 2: Implement private routes and metadata recording**

Use hardcoded limits appropriate for the evidence types (two images before pickup, one receiving video). Store key, MIME type, size, uploader, and timestamp; do not store file bytes or public URLs in PostgreSQL.

- [ ] **Step 3: Implement signed access**

Authorize every evidence viewer against the request before generating a short-lived signed URL. A missing/corrupt media record becomes `evidence_exception`, never an automatic rejection.

- [ ] **Step 4: Run focused tests and commit**

Run: `pnpm vitest run src/infrastructure/services/uploadthing-evidence-storage.service.test.ts`

```bash
git add src/lib/uploadthing.ts src/components/ui/upload.tsx src/infrastructure/services/uploadthing-evidence-storage.service.ts
git commit -m "feat(refunds): Protect inspection evidence uploads"
```

### Task 6: Add customer return request and confirmation UI

**Files:**

- Create: `src/server/routers/public/returns.ts`
- Create: `src/components/account/order-detail/ReturnRequestCard.tsx`
- Create: `src/components/account/order-detail/ReturnRequestDialog.tsx`
- Create: `src/components/account/order-detail/ReturnEvidenceUpload.tsx`
- Create: `src/components/account/order-detail/ReturnProposalDialog.tsx`
- Create: `src/hooks/use-read-before-confirm.ts`
- Create: `src/hooks/use-read-before-confirm.test.ts`
- Modify: `src/server/routers/public/index.ts`, `src/server/routers/public/orders.ts`, `src/app/(main)/account/orders/[id]/page.tsx`, `src/components/account/order-detail/OrderSummaryCard.tsx`

**Interfaces:**

- `public.returns.create`, `getById`, `listForOrder`, `acknowledge`, `requestOtp`, and `confirmOtp` are all `protectedProcedure` calls. UploadThing's authorized completion callback records evidence metadata; there is no client-trusted evidence-attachment mutation.
- The customer UI uses server-returned proposal values and never calculates a refund amount from editable client fields.

- [ ] **Step 1: Write router ownership tests**

Assert another customer cannot read, upload evidence to, acknowledge, request OTP for, or confirm a request they do not own. Assert client-supplied amount/fee fields are rejected because they are absent from the input schema.

- [ ] **Step 2: Implement request card/dialog**

Show only eligible lines and the 14/30-day deadline. Explain try-on versus worn condition, customer-caused rejection, delivery responsibility, and that initial submission does not refund money.

- [ ] **Step 3: Implement evidence upload**

Require the product-condition photo and resealed-package/label photo before pickup scheduling. If upload fails, keep the request pending and offer retry; do not silently mark it rejected.

- [ ] **Step 4: Implement proposal read gate and OTP**

Render line amount, delivery amount, collection responsibility, total, destination, and inspection outcome. Start the visible ten-second timer on opening; reset it if the dialog closes, proposal data changes, or the page reloads. Enable acknowledgment only after the timer and call the server acknowledgment before requesting OTP.

- [ ] **Step 5: Run UI tests and commit**

Run: `pnpm vitest run src/hooks/use-read-before-confirm.test.ts src/server/routers/public`

```bash
git add src/server/routers/public 'src/app/(main)/account/orders/[id]/page.tsx' src/components/account/order-detail src/hooks/use-read-before-confirm.ts src/hooks/use-read-before-confirm.test.ts
git commit -m "feat(refunds): Add customer return confirmation flow"
```

### Task 7: Add admin queue, inspection review, and notifications

**Files:**

- Create: `src/server/routers/admin/returns.ts`
- Create: `src/app/admin/returns/page.tsx`
- Create: `src/components/admin/returns/ReturnQueue.tsx`
- Create: `src/components/admin/returns/ReturnReview.tsx`
- Create: `src/components/admin/returns/ReturnEvidenceViewer.tsx`
- Modify: `src/server/routers/admin/index.ts`, `src/server/routers/admin/orders.ts`, `src/server/admin-write-gating.test.ts`
- Modify: `src/components/admin/AdminSidebar.tsx`, `src/components/admin/orders/OrderDetail.tsx`, `src/components/admin/orders/detail/CloseOrderDialog.tsx`, `src/components/admin/orders/detail/UpdateStatusCard.tsx`
- Modify: `src/application/notifications/notification.service.ts`, `src/db/schema.ts`, `src/components/notifications/notification-visuals.ts`

**Interfaces:**

- `admin.returns.list`/`getById` use `adminProcedure`; worker responses omit customer contact/address data.
- `authorizePickup`, `recordInspection`, `approveProposal`, `reject`, and `mediaException` use `adminWriteProcedure` except worker-only evidence intake, which uses a dedicated role check allowing worker/admin/super-admin.
- Add one `return_request` admin notification and one `return_update` customer notification; use the existing in-app notification repository and failure isolation.

- [ ] **Step 1: Write authorization-gating tests**

Extend the source-scan test to require admin-only mutations and worker-readable queue/evidence procedures. Add unit tests proving a worker cannot approve a proposal even when the client sends an admin-looking input.

- [ ] **Step 2: Implement admin queue and sidebar count**

Group pending work by request/order, show unresolved count beside Returns, and keep the count query bounded. Do not expose a refund-settings editor.

- [ ] **Step 3: Implement inspection/review screen**

Show evidence, timeline, returned lines, condition outcome, calculated item refund, delivery treatment, collection fee, and exact customer-facing copy. Final approve/reject controls are visible only to admins/super admins.

- [ ] **Step 4: Remove the direct refund bypass**

Delete the `admin.orders.refund` mutation and the refund branch from `CloseOrderDialog`. The old order screen may link to the return request queue, but it must not accept arbitrary returned/restocked lines from a staff click.

- [ ] **Step 5: Run authorization/UI tests and commit**

Run: `pnpm vitest run src/server/admin-write-gating.test.ts src/application/notifications/notification.service.test.ts`

```bash
git add src/server/routers/admin src/app/admin/returns src/components/admin src/application/notifications src/db/schema.ts src/components/notifications
git commit -m "feat(refunds): Add admin inspection review queue"
```

### Task 8: Implement the hardcoded OTP challenge boundary

**Files:**

- Modify: `src/application/refunds/refund-otp.service.ts`, `src/application/refunds/use-cases/request-return-otp.use-case.ts`, `src/application/refunds/use-cases/confirm-return-otp.use-case.ts`
- Create: `src/application/interfaces/refund-otp-provider.interface.ts`
- Test: `src/application/refunds/refund-otp.service.test.ts`

**Interfaces:**

- `RefundOtpProvider.send({ phone, code, requestId })` is the only delivery boundary. No provider implementation is fabricated while the provider is externally blocked.
- `RefundOtpService.request()` creates a one-minute challenge, hashes the code with a server secret, invalidates earlier challenges, and calls the provider.
- `RefundOtpService.verify()` atomically checks expiry/attempts, increments failed attempts, consumes a correct code, and returns a confirmation id.

- [ ] **Step 1: Write lifecycle tests**

Cover correct code, wrong code increments, fifth wrong code locks the challenge, sixth attempt fails, expiry at 60 seconds, resend invalidating the first code, replay after success, and provider failure leaving the request awaiting OTP.

- [ ] **Step 2: Implement hashed, single-use challenges**

Use a keyed server-side hash; never persist or log the code. Use the database clock for expiry and guarded updates for attempts. Keep `OTP_TTL_SECONDS = 60` and `OTP_MAX_ATTEMPTS = 5` in code constants.

- [ ] **Step 3: Make provider absence explicit**

Return a typed `PROVIDER_UNAVAILABLE` error when no configured provider exists. Never mark a request confirmed or recorded merely because the provider is unavailable.

- [ ] **Step 4: Run focused tests and commit**

Run: `pnpm vitest run src/application/refunds/refund-otp.service.test.ts`

```bash
git add src/application/refunds src/application/interfaces/refund-otp-provider.interface.ts
git commit -m "feat(refunds): Add customer OTP authorization boundary"
```

### Task 9: Connect final confirmation to the existing return and notification model

**Files:**

- Modify: `src/application/orders/use-cases/refund-order.use-case.ts`, `src/application/orders/order.container.ts`, `src/application/notifications/notification.service.ts`
- Modify: `src/components/admin/orders/detail/PaymentCard.tsx`, `src/components/account/order-detail/OrderSummaryCard.tsx`, `src/server/routers/public/orders.ts`
- Test: `src/application/orders/use-cases/refund-order.use-case.test.ts`, `src/infrastructure/database/repositories/orders/order.repository.integration.test.ts`

**Interfaces:**

- The only production path to record a return is `ConfirmReturnOtpUseCase → ReturnRequestRepository.finalize()`.
- Finalization passes stored approved lines and stored shipping refund; it does not trust customer/admin client totals.
- Existing `refundedQuantity` remains the per-line fact; `refundedShippingAmount` is the delivery aggregate; all customer/admin totals derive from those plus recorded request facts.

- [ ] **Step 1: Write finalization race tests**

Race two confirmations, race a cancellation against finalization, retry a timed-out finalization, and attempt a stale proposal after inspection data changed. Exactly one request may record and no line or delivery amount may be refunded twice.

- [ ] **Step 2: Implement idempotent finalization and status updates**

Lock request/order/lines in deterministic order, verify the OTP confirmation belongs to the request and customer, call the locked return transaction, mark `recorded`, update payment status only when the whole order is returned, and emit the customer notification after durability.

- [ ] **Step 3: Update customer/admin totals and copy**

Display item refund, delivery refund, and total separately. Until OPay exists, say the refund is recorded/awaiting provider execution; do not claim the card or wallet has been credited.

- [ ] **Step 4: Run order and notification tests and commit**

Run: `pnpm vitest run src/application/orders/use-cases/refund-order.use-case.test.ts src/infrastructure/database/repositories/orders/order.repository.integration.test.ts src/application/notifications/notification.service.test.ts`

```bash
git add src/application/orders src/application/notifications src/components/admin/orders/detail/PaymentCard.tsx src/components/account/order-detail/OrderSummaryCard.tsx src/server/routers/public/orders.ts
git commit -m "feat(refunds): Finalize authorized returns safely"
```

### Task 10: Full verification and durable handoff

**Files:**

- Modify: `docs/REFUNDS.md`, `docs/PRELAUNCH-HANDOFF.md`, `AGENTS.md` only for verified baseline/counts

- [ ] **Step 1: Run the focused suite**

Run: `pnpm vitest run src/domain/refunds src/application/refunds src/server/admin-write-gating.test.ts`

Expected: all focused tests pass. Record any provider/database skips explicitly.

- [ ] **Step 2: Run the full local verification**

```bash
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

Do not run `pnpm db:migrate`. Run `pnpm test:integration` only when the configured database is intentionally available and record its exact result.

- [ ] **Step 3: Review policy and security boundaries**

Confirm no refund policy constants are read from `site_settings` or any new table, no worker mutation can approve a refund, no evidence URL is returned without authorization, no plaintext OTP appears in logs/database, and no provider-money claim appears in UI copy.

- [ ] **Step 4: Update the handoff**

Record the implementation commit range, exact test counts, schema state, remaining OPay/OTP-provider blocker, and the distinction between implemented workflow, provider-blocked money movement, and later identity/messaging work. Keep inventory adjustment work in its own phase record.

- [ ] **Step 5: Commit the verification record**

```bash
git add docs/REFUNDS.md docs/PRELAUNCH-HANDOFF.md AGENTS.md
git commit -m "docs(prelaunch): Record refund verification"
```

## Plan self-review

- Policy, condition outcomes, delivery rules, coupon allocation, hardcoded-only constraint, acknowledgment, OTP, evidence, roles, provider block, and stale-request handling each have an implementation task.
- No task creates a refund settings table or runs `pnpm db:migrate`.
- `refundValue` remains item-only while the new `refundedShippingAmount` aggregate makes delivery refunds visible and bounded.
- The direct admin refund mutation is removed before the final workflow is exposed.
- Provider money movement remains explicitly blocked; recording a confirmed return is not described as a successful electronic payment.
