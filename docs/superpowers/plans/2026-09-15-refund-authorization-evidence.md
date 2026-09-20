# Refund Authorization and Inspection Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fair, evidence-backed customer return workflow with separate physical and financial states, hardcoded refund calculation, admin approval, customer acknowledgment/OTP, carrier discrepancy handling, and verified OPay payouts.

**Architecture:** Keep refund policy in pure domain code and persist immutable return facts, evidence metadata, proposal versions, physical dispositions, payout attempts, and audit timestamps. A return request owns the customer/admin workflow; physical disposition and financial payout are separate state machines. Finalization locks the request, order, lines, and variants, while OPay execution is idempotent and reaches `completed` only after verified provider success. Evidence is private and super-admin-viewable only.

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
- OPay integration, verified webhooks/reconciliation, and idempotent partial refunds are required before launch; do not describe a pending payout as completed.
- WhatsApp is the launch OTP and return-notification channel; SMS is later work.
- Do not add direct worker stock writes, assignments, `media_buyer`, or arbitrary formula editors.
- Keep physical `returnedQuantity` separate from financial `refundedQuantity`; accepted resellable stock may sell while OPay remains pending.
- Customer evidence is exactly two photos; courier and receiving evidence are one continuous video each; all evidence is private and only super-admins can open media.
- Customer packaging is sealed with a declared count; three units per package is guidance, not a hard block. Receiving uses a second-person count verification.
- Partial missing quantities are refunded after verified received quantities are refunded and a three-day investigation has no outcome; all-missing returns use a three-day investigation from claim opening.
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
- `src/application/refunds/refund-payout.service.ts` — payout state machine, OPay idempotency, retries, reconciliation, and fallback gating.
- `src/application/refunds/carrier-claim.service.ts` — package discrepancy classification and three-day investigation clock.
- `src/application/refunds/refund-otp.service.test.ts` — expiry, resend, attempt, and single-use tests.
- `src/application/refunds/refunds.container.ts` — lazy repositories/use cases and provider injection.
- `src/infrastructure/database/repositories/refunds/return-request.repository.ts` — Drizzle persistence and locking.
- `src/infrastructure/database/repositories/refunds/return-request.repository.integration.test.ts` — real-database lifecycle/concurrency tests.
- `src/infrastructure/services/uploadthing-evidence-storage.service.ts` — signed private evidence URLs.
- `src/infrastructure/services/opay-refund.service.ts` — OPay refund adapter and verified-success boundary.
- `src/server/routers/public/returns.ts` — authenticated customer request/proposal/OTP procedures.
- `src/server/routers/admin/returns.ts` — worker reads/evidence and admin review procedures.
- `src/app/admin/returns/page.tsx` — admin return queue.
- `src/components/admin/returns/ReturnQueue.tsx` — grouped request list and pending count.
- `src/components/admin/returns/ReturnReview.tsx` — evidence, inspection, calculation, and approve/reject controls.
- `src/components/admin/returns/ReturnEvidenceViewer.tsx` — authorized image/video viewer.
- `src/components/admin/returns/ReturnDisputePanel.tsx` — customer disagreement, admin review, and super-admin escalation.
- `src/components/account/order-detail/ReturnRequestCard.tsx` — customer request status and action entry point.
- `src/components/account/order-detail/ReturnRequestDialog.tsx` — line/reason request form.
- `src/components/account/order-detail/ReturnEvidenceUpload.tsx` — required pre-pickup photographs.
- `src/components/account/order-detail/ReturnPackageDeclaration.tsx` — sealed-package photos, count, capacity guidance, and confirmation.
- `src/components/account/order-detail/ReturnProposalDialog.tsx` — ten-second acknowledgment and OTP entry.
- `src/hooks/use-read-before-confirm.ts` — visible-page ten-second timer with reset behavior.
- `src/hooks/use-read-before-confirm.test.ts` — timer and reset tests.
- `src/application/refunds/refund-payout.service.test.ts` — OPay pending/failed/retry/fallback and receipt/reference rules.
- `src/application/refunds/carrier-claim.service.test.ts` — partial/all-missing timelines and carrier responsibility.

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

- `return_requests` owns order/customer/review/proposal/acknowledgment, dispute, package, and separate physical/payout status fields.
- `return_request_items` owns requested/received/inspected/approved/restocked/refunded quantities, outcome, fault classification, and item refund.
- `return_evidence` owns private storage key, evidence kind, MIME/size/hash, uploader, validation state, and timestamps.
- `return_package_events` owns customer declaration, courier handoff, receiving count, second verification, and immutable corrections.
- `return_payouts` owns provider, idempotency key, amount, pending/succeeded/failed/unknown state, attempts, fallback method, and proof metadata.
- `return_carrier_claims` owns the claim-opened server timestamp, three-day deadline, carrier outcome, and internal reconciliation.
- `return_otp_challenges` owns only a hash, expiry, attempt count, consumed time, and request id.
- `orders.refundedShippingAmount` stores the already-recorded delivery refund aggregate; it is not policy configuration.

- [ ] **Step 1: Define exact enums and tables**

Use statuses `requested`, `awaiting_customer_evidence`, `pickup_authorized`, `pickup_pending`, `in_transit`, `received`, `count_disputed`, `inspection_pending`, `awaiting_customer_confirmation`, `disputed`, `customer_action_required`, `confirmed`, `recorded`, `rejected`, and `evidence_exception`. Track physical disposition, payout, evidence review, and carrier claim separately. Use reasons `change_of_mind`, `defective`, `wrong_item`, `not_as_described`, and `late_delivery`. Use item outcomes `unworn`, `worn_resellable`, `defective`, `customer_damage`, `damaged_quarantine`, and `missing_not_received`.

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
- `recordPackageEvent(input)` appends customer, courier, receiving, second-count, and correction events without overwriting earlier counts.
- `openCarrierClaim(input)` starts the server-clock three-calendar-day investigation deadline; `resolveCarrierClaim(input)` records the carrier outcome without changing a completed customer refund.

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

- [ ] **Step 6: Add package/count and carrier-claim tests**

Cover the three-unit package guidance, customer-declared count, courier handoff
count, receiving count, second-person verification, immutable corrections,
open/damaged seals, partial/all-missing quantities, the three-calendar-day
clock, and the rule that later carrier outcomes never claw back a completed
customer refund.

- [ ] **Step 7: Commit**

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
- Create: `src/application/refunds/use-cases/submit-return-dispute.use-case.ts`
- Create: `src/application/refunds/use-cases/review-return-dispute.use-case.ts`
- Create: `src/application/refunds/use-cases/record-package-event.use-case.ts`
- Create: `src/application/refunds/use-cases/open-carrier-claim.use-case.ts`
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
- `SubmitReturnDisputeUseCase.execute({ userId, requestId, reason })` pauses payout and quarantine release; one admin review may issue a new proposal, then super-admin is the final escalation.
- `RecordPackageEventUseCase.execute({ actor, requestId, event })` records observed facts only; workers cannot classify fault or approve money.

- [ ] **Step 1: Write use-case role and state tests**

Assert customers can create/read only their own requests, workers can upload/record intake evidence but cannot approve/reject, admins/super admins can review, and stale requests return conflicts rather than overwriting newer proposals.

- [ ] **Step 2: Implement request creation and pickup authorization**

Validate order ownership, delivered/eligible status, 14/30-day window, remaining refundable quantity, and one request line per order item. Notify admins after durable creation; notification failure must not roll back the request.

- [ ] **Step 3: Implement inspection/proposal calculation**

Require the receiving video unless an audited media exception is supplied. Persist line outcomes and the complete itemized calculation. Reject customer-caused outcomes with collection due and no refund; do not call the order repository yet.

- [ ] **Step 4: Implement acknowledgment and finalization orchestration**

Persist `readStartedAt`, enforce the ten-second server interval, require acknowledgment before OTP, and pass the stored proposal—not client-supplied amounts—to `finalize()`.

- [ ] **Step 5: Implement disputes, inactivity, and cancellation rules**

Allow a customer to submit a detailed disagreement instead of accepting. Keep
the item quarantined and payout paused; permit one admin review and then
super-admin escalation. Move untouched proposals to `customer_action_required`
after seven days with reminders and no automatic refund, rejection, or restock.
Before courier dispatch, an admin may cancel with proof of the customer request;
after dispatch charge actual incurred delivery cost; after receipt route to
inspection/dispute.

- [ ] **Step 6: Run focused use-case tests and commit**

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
- Middleware authorizes the customer for customer photos and worker/admin/super-admin for handoff/receiving video; `onUploadComplete` records metadata through the application use case. Actual media viewing is super-admin-only; ordinary admins receive structured evidence findings and validation state.
- `UploadThingEvidenceStorage.getSignedUrl(storageKey)` calls `UTApi.generateSignedURL()`; routers never return permanent public URLs.

- [ ] **Step 1: Add failing authorization tests**

Cover wrong customer, unrelated request id, worker upload of customer evidence, customer upload of receiving evidence, wrong MIME/kind, and evidence upload after the request is rejected/recorded.

- [ ] **Step 2: Implement private routes and metadata recording**

Use hardcoded limits appropriate for the evidence types (two images before pickup, one receiving video). Store key, MIME type, size, uploader, and timestamp; do not store file bytes or public URLs in PostgreSQL.

- [ ] **Step 3: Implement signed access**

Authorize every evidence viewer against the request and require `super_admin` before generating a short-lived signed URL. Log every view/download. A missing/corrupt media record becomes `evidence_exception`, never an automatic rejection; super-admin review is mandatory for disputes, count discrepancies, and carrier-fault exceptions.

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

Require exactly two customer photos before pickup scheduling: the product condition,
and the safely resealed package/label with the declared package count. Compress
photos in the browser, preserve the original upload metadata, and show upload
progress. Give the customer 48 hours to provide them; an upload failure keeps the
request pending and offers retry rather than rejection. After pickup authorization,
give seven days to hand the parcel to the courier or bring it in-store; expiry
releases the pending physical reservation and allows a later fresh attempt.

The package declaration recommends three units per package but does not force one
package. The customer confirms the package count and seal; the website never asks
for a wallet destination or bank details.

- [ ] **Step 4: Implement proposal read gate and OTP**

Render per-line quantities and outcomes, item amount, original-delivery treatment,
return/collection fee responsibility, physical disposition, payout destination and
status, and any carrier claim. Start the visible timer only after the server records
proposal-open; enforce ten seconds on the server, reset it on every immutable
proposal version change, and require acknowledgment before OTP. Positive refunds
use the verified account phone, while rejected outcomes still require the read gate
but no OTP. A dispute action keeps payout paused and asks for a detailed reason.

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

Group pending work by request/order and by the separate physical, evidence,
payout, and carrier-claim statuses. Show the unresolved count beside Returns in
the staff sidebar, with in-app notification mirroring, and keep the count query
bounded. Include customer-action-required, count-disputed, evidence-exception,
and carrier-claim work; do not expose a refund-settings editor.

- [ ] **Step 3: Implement inspection/review screen**

Show structured facts to workers/admins and actual private media only to
super-admins through audited short-lived signed URLs. The review screen includes
the timeline, package declarations and counts, returned lines, condition outcome,
calculated item refund, delivery treatment, collection fee, payout state, carrier
claim clock, and exact customer-facing copy. Require staff to record facts and
video findings; only admins/super-admins classify fault and approve/reject.

Support in-store returns for every payment method, free to the customer, with OTP
and receipt; if the receipt is missing, allow admin/super-admin verification using
two matching order details. Offer free in-store pickup of a rejected item, or
WhatsApp customer confirmation of the actual collection fee for shipping it back.
Hold rejected items for 14 days, send a second reminder, and never auto-dispose;
super-admin decides the eventual disposition.

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

- `RefundOtpProvider.send({ phone, code, requestId })` is the only delivery boundary. The launch implementation targets WhatsApp; SMS remains a later provider.
- `RefundOtpService.request()` creates a one-minute challenge, hashes the code with a server secret, invalidates earlier challenges, and calls the provider.
- `RefundOtpService.verify()` atomically checks expiry/attempts, increments failed attempts, consumes a correct code, and returns a confirmation id.

- [ ] **Step 1: Write lifecycle tests**

Cover correct code, wrong code increments, fifth wrong code locks the challenge, sixth attempt fails, expiry at 60 seconds, resend invalidating the first code, replay after success, and provider failure leaving the request awaiting OTP.

- [ ] **Step 2: Implement hashed, single-use challenges**

Use a keyed server-side hash; never persist or log the code. Use the database clock for expiry and guarded updates for attempts. Keep `OTP_TTL_SECONDS = 60` and `OTP_MAX_ATTEMPTS = 5` in code constants.

- [ ] **Step 3: Make WhatsApp readiness explicit**

Return a typed `PROVIDER_UNAVAILABLE` error when WhatsApp is not configured or delivery is not verified. Never mark a request confirmed or recorded merely because the provider is unavailable. Launch readiness remains blocked until WhatsApp OTP delivery and OPay refund execution are live and tested.

- [ ] **Step 4: Run focused tests and commit**

Run: `pnpm vitest run src/application/refunds/refund-otp.service.test.ts`

```bash
git add src/application/refunds src/application/interfaces/refund-otp-provider.interface.ts
git commit -m "feat(refunds): Add customer OTP authorization boundary"
```

### Task 9: Connect final confirmation to the existing return and notification model

**Files:**

- Modify: `src/application/orders/use-cases/refund-order.use-case.ts`, `src/application/orders/order.container.ts`, `src/application/notifications/notification.service.ts`
- Create: `src/application/refunds/refund-payout.service.ts`
- Create: `src/infrastructure/services/opay-refund.service.ts`
- Modify: `src/components/admin/orders/detail/PaymentCard.tsx`, `src/components/account/order-detail/OrderSummaryCard.tsx`, `src/server/routers/public/orders.ts`
- Test: `src/application/orders/use-cases/refund-order.use-case.test.ts`, `src/application/refunds/refund-payout.service.test.ts`, `src/infrastructure/database/repositories/orders/order.repository.integration.test.ts`

**Interfaces:**

- The only production path to record a return is `ConfirmReturnOtpUseCase → ReturnRequestRepository.finalize()`.
- Finalization passes stored approved lines and stored shipping refund; it does not trust customer/admin client totals.
- Physical `returnedQuantity`/disposition is recorded independently from financial `refundedQuantity`/payout state. Accepted resellable stock can sell while OPay remains pending.
- OPay payout state is `pending`, `succeeded`, `failed`, or `unknown`; only verified provider success reaches `completed`.
- A timeout or unknown response is reconciled, never sent as a fresh payout. Only a definitive failure permits up to three retries in 24 hours with the same idempotency key. Confirmed failure enables a new proposal plus OTP for cash or manually agreed e-wallet fallback.
- Existing `refundedQuantity` remains the per-line financial fact; `refundedShippingAmount` is the delivery aggregate; all customer/admin totals derive from recorded facts.

- [ ] **Step 1: Write finalization race tests**

Race two confirmations, race a cancellation against finalization, retry a timed-out finalization, and attempt a stale proposal after inspection data changed. Exactly one request may record and no line or delivery amount may be refunded twice.

- [ ] **Step 2: Implement idempotent finalization and physical disposition**

Lock request/order/lines in deterministic order, verify the OTP confirmation
belongs to the request and customer, record received/accepted/restock/quarantine/
missing facts, and emit the customer notification after durability. Keep physical
disposition separate from payout: resellable items become sellable after the
accepted return is recorded, damaged items remain quarantined, and missing items
are never restocked. Do not mark a financial payout complete here.

- [ ] **Step 3: Implement OPay payout boundary and fallback**

Create a provider adapter that accepts only the original payment reference and
stored approved amount. Persist an idempotency key and payout attempt before the
call; mark success only from a verified response/webhook. Keep unknown status
locked for reconciliation. After confirmed failure, create a fresh proposal for
cash/e-wallet fallback with a new ten-second read and OTP. Never accept wallet
details through the public website; attach the successful e-wallet screenshot or
in-store cash receipt when available.

For COD that was never delivered, there is no captured payment to refund. For
COD already collected, cash may be handed over in-store or by an authorized
worker who runs the cash registry; the worker may not change the approved amount
or outcome, and the receipt is required to close the payout. An online/manual
fallback may link to the verified order even when the customer has no receipt.
Wallet fallback remains an offline admin/customer agreement because of monthly
limits, and its private screenshot must prove provider, success, exact amount,
date, and masked recipient.

- [ ] **Step 4: Update customer/admin totals and copy**

Display item refund, delivery refund, collection fee, physical disposition,
payout method/status, and carrier-claim status separately. Say `pending` until
provider success; never claim money was credited early. Send the final
WhatsApp/in-app summary with received/missing quantities and any open claim.

Apply the cancellation rule explicitly: before dispatch an admin may release a
customer-requested cancellation, after dispatch charge the actual incurred
courier fee, and after receipt route it to inspection rather than cancellation.

For package discrepancies, verify customer declaration, courier handoff count,
receiving count, and a second receiving count before assigning fault. Refund
verified received quantities first; start the three-calendar-day investigation
clock for missing remainder (or all-missing claim), refund the unresolved amount
after the deadline if there is no outcome, and never claw back a completed customer
refund after a later carrier decision.

- [ ] **Step 5: Run order, payout, and notification tests and commit**

Run: `pnpm vitest run src/application/orders/use-cases/refund-order.use-case.test.ts src/infrastructure/database/repositories/orders/order.repository.integration.test.ts src/application/notifications/notification.service.test.ts`

```bash
git add src/application/orders src/application/refunds src/application/notifications src/infrastructure/services/opay-refund.service.ts src/components/admin/orders/detail/PaymentCard.tsx src/components/account/order-detail/OrderSummaryCard.tsx src/server/routers/public/orders.ts
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
- Provider execution is an external launch prerequisite: the implementation may
  record physical disposition and a pending payout, but only a verified OPay
  success may be called completed. Provider credentials, webhook behavior, and
  WhatsApp delivery remain externally blocked until provisioned and tested.
