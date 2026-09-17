# Inventory Adjustment Request and Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add worker stock inspections and adjustment requests, admin review, and one concurrency-safe sellable-stock rule across the admin and storefront.

**Architecture:** Keep recorded stock on `product_variants`, store one open inspection per low-stock cycle plus immutable adjustment requests, and derive quarantine from pending damaged/missing requests. A pure domain policy computes sellable stock; infrastructure queries supply its flags, while every stock-changing transaction reconciles the inspection cycle under the same variant lock.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, tRPC v11, Drizzle/PostgreSQL, React Query, Tailwind 4/shadcn, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-15-inventory-adjustment-request-review-design.md`

## Global Constraints

- Workers never change recorded stock directly.
- Request categories are exactly `damaged`, `missing`, and `extra`; quantities are positive integers and direction comes from the category.
- An inspection opens when stock enters 1-20, protects the final 10 units while pending, and never opens at zero.
- `all_fine` releases protection without admin review; damaged/missing requests quarantine the whole variant; extra requests do not.
- Approval applies a signed delta to current locked stock and never an absolute request-time target.
- Manual `isAvailable` remains separate and is never toggled by stock movement.
- Customer copy is exactly **Temporarily unavailable** and **We're confirming availability. Check back soon.**
- Do not say **Restocking soon** unless a real incoming restock exists.
- Preserve multiple pending requests per variant and immutable originals.
- Reuse in-app notifications; add no email or external messaging.
- Do not add OPay, OTP, direct worker stock writes, assignments, or `media_buyer`.
- Do not run `pnpm db:migrate` on the current development database.
- Before every trusted type-check, remove stale `.next` output.

---

## File map

### New files

- `src/domain/inventory/inventory-policy.ts` — pure thresholds, availability state, and cycle-transition rules.
- `src/domain/inventory/inventory-policy.test.ts` — boundary table for 0, 1, 10, 11, 19, 20, and 21 units.
- `src/domain/inventory/inventory-operations.ts` — database-independent request, inspection, reviewer, and sellability records.
- `src/domain/inventory/interfaces/repositories/inventory-requests.repository.interface.ts` — atomic request/review contract.
- `src/infrastructure/database/repositories/inventory/inventory-stock-state.ts` — reusable Drizzle reads and in-transaction inspection reconciliation.
- `src/infrastructure/database/repositories/inventory/inventory-requests.repository.ts` — request, inspection, history, count, and decision persistence.
- `src/infrastructure/database/repositories/inventory/inventory-requests.repository.integration.test.ts` — real-database locking, lifecycle, and idempotency coverage.
- `src/application/inventory/use-cases/submit-adjustment-request.use-case.ts` — worker-only submission and admin notification.
- `src/application/inventory/use-cases/complete-inventory-inspection.use-case.ts` — worker-only green completion.
- `src/application/inventory/use-cases/review-adjustment-request.use-case.ts` — admin/super-only decision.
- `src/application/inventory/use-cases/list-inventory-work.use-case.ts` — read model for requests and inspections.
- `src/application/inventory/use-cases/inventory-work.use-cases.test.ts` — role, validation, and notification unit tests.
- `src/application/notifications/notification.service.test.ts` — inventory-request fan-out and failure-isolation tests.
- `src/components/admin/inventory/RequestsTab.tsx` — grouped pending work and resolved history.
- `src/components/admin/inventory/RequestAdjustmentDialog.tsx` — worker request form.
- `src/components/admin/inventory/ReviewAdjustmentDialog.tsx` — admin approve/correct/reject form.
- `src/components/admin/inventory/InventoryAvailabilityBadge.tsx` — green/red/internal state presentation.
- `src/infrastructure/database/repositories/cart/cart.repository.integration.test.ts` — add/update enforcement against derived sellability.
- `scripts/reset-development-inventory.ts` — explicit stock-only reset for the fake development catalogue.
- `drizzle/0009_inventory_adjustment_requests.sql` — documented out-of-band SQL matching the Drizzle schema.

### Existing files with focused changes

- `src/db/schema.ts`, `src/db/relations.ts` — enums, tables, indexes, relations, and inferred types.
- `src/domain/inventory/interfaces/repositories/inventory.repository.interface.ts` — database-independent log inputs plus sellability reads.
- `src/infrastructure/database/repositories/inventory/inventory.repository.ts` — recorded-stock writes without availability toggles and inspection reconciliation.
- `src/domain/products/interfaces/repositories/product-variant.repository.interface.ts` and `src/infrastructure/database/repositories/products/product-variant.repository.ts` — sellable variant read methods; remove unused stock writers.
- `src/application/products/product.container.ts` and `src/application/products/index.ts` — remove the unused unlogged `UpdateVariantStockUseCase`.
- `src/application/products/use-cases/update-variant-stock.use-case.ts` — delete the unused bypass.
- `src/application/inventory/inventory.container.ts`, `src/application/inventory/index.ts`, `src/application/container.ts` — wire the new repository/use cases.
- `src/server/trpc.ts`, `src/server/admin-write-gating.test.ts` — exact worker-only procedure tier and source-scan assertions.
- `src/server/routers/admin/inventory.ts` — thin request, inspection, count, and review procedures.
- `src/db/schema.ts`, `src/application/notifications/notification.service.ts`, `src/components/notifications/notification-visuals.ts` — `inventory_request` admin notification.
- `src/server/routers/public/products.ts`, `src/lib/cache.ts`, `src/lib/transformers/products.ts` — derived sellable stock in live and cached catalogue responses.
- `src/components/providers/variant-stock-provider.tsx`, `src/hooks/use-variant-stock.ts` — expose stock plus customer availability state.
- `src/components/products/QuickAddBar.tsx`, `src/components/products/ProductDetail.tsx`, `src/components/products/product-detail/ProductActions.tsx`, `src/components/products/product-detail/ProductVariantSelector.tsx` — honest unavailable copy and quantity ceilings.
- `src/infrastructure/database/repositories/cart/cart.repository.ts`, `src/application/cart/use-cases/check-cart-stock.use-case.ts`, `src/application/cart/use-cases/change-cart-item-variant.use-case.ts`, `src/application/cart/use-cases/merge-guest-cart-items.use-case.ts` — cart enforcement and alternatives use sellable stock.
- `src/infrastructure/database/repositories/orders/order.repository.ts` — checkout floor, shipping quarantine, cancellation serialization, and inspection reconciliation.
- `src/infrastructure/database/repositories/orders/order.repository.integration.test.ts` — concurrent checkout/cancellation/return and shipment-block tests.
- `src/application/products/use-cases/add-product-variant.use-case.ts`, `src/infrastructure/database/repositories/products/product.repository.ts` — reconcile opening stock for single and batched variant creation.
- `src/server/routers/admin/variants.ts`, `src/server/utils/revalidate-catalogue.ts` — invalidate live/cached sellability after all relevant writes.
- `src/app/admin/inventory/page.tsx`, `src/components/admin/inventory/AllStockTab.tsx`, `src/components/admin/inventory/LowStockTab.tsx`, `src/components/admin/AdminSidebar.tsx` — role-correct actions, Requests tab, inspection controls, and pending badge.
- `scripts/seed.ts`, `scripts/seed-products.ts`, `scripts/seed-basic.ts`, `content/products.json`, `package.json` — zero-stock fixtures and explicit reset command.
- `AGENTS.md`, `docs/PRELAUNCH-HANDOFF.md` — verified counts, implementation state, and durable handoff after completion.

---

### Task 1: Encode the inventory policy as pure domain logic

**Files:**

- Create: `src/domain/inventory/inventory-policy.ts`
- Create: `src/domain/inventory/inventory-policy.test.ts`
- Create: `src/domain/inventory/inventory-operations.ts`

**Interfaces:**

- Produces: `INSPECTION_TRIGGER_STOCK = 20`, `INSPECTION_PROTECTED_STOCK = 10`.
- Produces: `InventoryAvailabilityState`, `resolveInventoryAvailability()`, `shouldOpenInspection()`, and `shouldCloseInspectionCycle()`.
- Produces: the record/command types used by repositories, use cases, routers, and UI.

- [ ] **Step 1: Write the failing boundary-table tests**

```ts
import { describe, expect, it } from "vitest";
import {
  resolveInventoryAvailability,
  shouldCloseInspectionCycle,
  shouldOpenInspection,
} from "./inventory-policy";

describe("resolveInventoryAvailability", () => {
  it.each([
    [20, 10],
    [19, 9],
    [11, 1],
    [10, 0],
    [1, 0],
    [0, 0],
  ])("protects the floor at %i recorded units", (stockQuantity, expected) => {
    expect(
      resolveInventoryAvailability({
        stockQuantity,
        isAvailable: true,
        hasPendingInspection: stockQuantity > 0,
        hasPendingFlaw: false,
      }).sellableStock
    ).toBe(expected);
  });

  it("quarantines a flaw and preserves manual unavailability", () => {
    expect(
      resolveInventoryAvailability({
        stockQuantity: 30,
        isAvailable: true,
        hasPendingInspection: false,
        hasPendingFlaw: true,
      })
    ).toMatchObject({ sellableStock: 0, state: "quarantined" });
    expect(
      resolveInventoryAvailability({
        stockQuantity: 30,
        isAvailable: false,
        hasPendingInspection: false,
        hasPendingFlaw: false,
      })
    ).toMatchObject({ sellableStock: 0, state: "manually_unavailable" });
  });
});

describe("inspection cycles", () => {
  it.each([
    [21, 20],
    [0, 15],
  ])("opens on entry from %i to %i", (previousStock, stockQuantity) => {
    expect(
      shouldOpenInspection({
        previousStock,
        stockQuantity,
        hasOpenCycle: false,
      })
    ).toBe(true);
  });

  it.each([0, 21])(
    "closes outside the low-stock range at %i",
    (stockQuantity) => {
      expect(shouldCloseInspectionCycle(stockQuantity)).toBe(true);
    }
  );
});
```

- [ ] **Step 2: Run the policy test and verify it fails**

Run: `rtk pnpm vitest run src/domain/inventory/inventory-policy.test.ts`

Expected: FAIL because `inventory-policy.ts` does not exist.

- [ ] **Step 3: Implement the pure policy and stable types**

```ts
export const INSPECTION_TRIGGER_STOCK = 20;
export const INSPECTION_PROTECTED_STOCK = 10;

export type InventoryAvailabilityState =
  | "available"
  | "out_of_stock"
  | "manually_unavailable"
  | "inspection_pending"
  | "quarantined";

export function resolveInventoryAvailability(input: {
  stockQuantity: number;
  isAvailable: boolean;
  hasPendingInspection: boolean;
  hasPendingFlaw: boolean;
}): { sellableStock: number; state: InventoryAvailabilityState } {
  if (input.hasPendingFlaw) return { sellableStock: 0, state: "quarantined" };
  if (!input.isAvailable)
    return { sellableStock: 0, state: "manually_unavailable" };
  if (input.stockQuantity <= 0)
    return { sellableStock: 0, state: "out_of_stock" };
  if (input.hasPendingInspection) {
    return {
      sellableStock: Math.max(
        0,
        input.stockQuantity - INSPECTION_PROTECTED_STOCK
      ),
      state: "inspection_pending",
    };
  }
  return { sellableStock: input.stockQuantity, state: "available" };
}
```

Define `InventoryInspectionRecord`, `InventoryAdjustmentRequestRecord`, `VariantSellability`, `InventoryActorSnapshot`, `CreateAdjustmentRequestCommand`, and `ReviewAdjustmentRequestCommand` in `inventory-operations.ts`. Keep them free of Drizzle imports.

- [ ] **Step 4: Run the policy tests**

Run: `rtk pnpm vitest run src/domain/inventory/inventory-policy.test.ts`

Expected: PASS for every threshold, quarantine, manual-availability, open-cycle, and close-cycle case.

- [ ] **Step 5: Commit the policy**

```bash
rtk git add src/domain/inventory/inventory-policy.ts src/domain/inventory/inventory-policy.test.ts src/domain/inventory/inventory-operations.ts
rtk git commit -m "feat(inventory): Define sellable-stock and inspection policy"
```

---

### Task 2: Add the inspection and immutable request schema

**Files:**

- Modify: `src/db/schema.ts:65-85,346-375,755-825,1074-1115`
- Modify: `src/db/relations.ts:1-30,64-75,285-295`
- Create: `drizzle/0009_inventory_adjustment_requests.sql`
- Test: `src/infrastructure/database/repositories/inventory/inventory-requests.repository.integration.test.ts`

**Interfaces:**

- Consumes: category/status types from Task 1.
- Produces: `inventoryInspections`, `inventoryAdjustmentRequests`, and their inferred insert/select types.
- Produces: one-open-cycle-per-variant database invariant.
- Produces: the `inventory_request` admin-notification enum value used in Task 4.

- [ ] **Step 1: Add a failing integration assertion for the open-cycle invariant and nullable history references**

Create the integration test with a real variant fixture and assert that two rows with `cycleEndedAt: null` for the same variant violate the unique partial index, while completed historical rows coexist. Also assert deleting the worker or variant sets request/inspection references to null without deleting their snapshot rows.

- [ ] **Step 2: Run the focused integration test and verify it fails**

Run: `rtk pnpm vitest run src/infrastructure/database/repositories/inventory/inventory-requests.repository.integration.test.ts`

Expected: FAIL because the new tables are absent.

- [ ] **Step 3: Add the Drizzle enums and tables**

Use these exact enum values:

```ts
export const inventoryAdjustmentCategoryEnum = pgEnum(
  "inventory_adjustment_category",
  ["damaged", "missing", "extra"]
);
export const inventoryAdjustmentStatusEnum = pgEnum(
  "inventory_adjustment_status",
  ["pending", "approved", "rejected"]
);
export const inventoryInspectionStatusEnum = pgEnum(
  "inventory_inspection_status",
  ["pending", "all_fine", "flaw_reported"]
);
```

`inventory_inspections` must have nullable `variant_id ON DELETE SET NULL`, immutable product/SKU/size/color snapshots, `trigger_stock`, status, nullable completer id/name, `completed_at`, `cycle_ended_at`, and `created_at`. Add a unique partial index on `variant_id WHERE cycle_ended_at IS NULL AND variant_id IS NOT NULL`.

`inventory_adjustment_requests` must have nullable variant, inspection, requester, reviewer, and inventory-log references using `ON DELETE SET NULL`; all snapshots; category; positive requested quantity; required explanation; stock-at-request; status; nullable approved quantity and decision explanation; requester/reviewer name snapshots; reviewed time; and creation time. Add indexes for `(status, created_at)`, `(variant_id, status)`, requester, reviewer, and inspection.

Append `inventory_request` to `notificationTypeEnum` and include the matching
`ALTER TYPE ... ADD VALUE IF NOT EXISTS` statement in `0009`.

Enforce positive requested quantity and positive-or-null approved quantity with SQL `CHECK` constraints. Do not cascade-delete history.

- [ ] **Step 4: Add relations and the out-of-band SQL file**

Mirror the schema exactly in `drizzle/0009_inventory_adjustment_requests.sql`. Begin it with the same warning used by `0008_customer_data_access_audit.sql`: day-to-day schema uses `pnpm db:push`, the migration journal does not include this file, and `pnpm db:migrate` must not be assumed to apply it.

- [ ] **Step 5: Apply the schema using the approved development workflow**

Run: `rtk pnpm db:push`

Expected: the two new tables, enums, checks, foreign keys, and indexes are applied. Do **not** run `pnpm db:migrate`.

- [ ] **Step 6: Re-run the focused integration assertion**

Run: `rtk pnpm vitest run src/infrastructure/database/repositories/inventory/inventory-requests.repository.integration.test.ts`

Expected: PASS for the schema invariants added in Step 1.

- [ ] **Step 7: Commit the schema**

```bash
rtk git add src/db/schema.ts src/db/relations.ts drizzle/0009_inventory_adjustment_requests.sql src/infrastructure/database/repositories/inventory/inventory-requests.repository.integration.test.ts
rtk git commit -m "feat(inventory): Add inspection and adjustment request records"
```

---

### Task 3: Build transactional stock-state primitives

**Files:**

- Create: `src/infrastructure/database/repositories/inventory/inventory-stock-state.ts`
- Modify: `src/domain/inventory/interfaces/repositories/inventory.repository.interface.ts`
- Modify: `src/infrastructure/database/repositories/inventory/inventory.repository.ts`
- Modify: `src/infrastructure/database/repositories/inventory/inventory-requests.repository.integration.test.ts`
- Delete: `src/application/products/use-cases/update-variant-stock.use-case.ts`
- Modify: `src/domain/products/interfaces/repositories/product-variant.repository.interface.ts`
- Modify: `src/infrastructure/database/repositories/products/product-variant.repository.ts`
- Modify: `src/application/products/product.container.ts`
- Modify: `src/application/products/index.ts`

**Interfaces:**

- Consumes: `resolveInventoryAvailability()` and the new tables.
- Produces: `readVariantSellability(executor, variantIds)`, `lockVariantStockState(tx, variantId)`, and `reconcileLowStockCycle(tx, input)`.
- Produces: `InventoryRepositoryInterface.getVariantSellability(variantIds): Promise<VariantSellability[]>`.

- [ ] **Step 1: Extend the integration test with inspection reconciliation cases**

Cover 21→20 opens one cycle, 20→19 does not duplicate it, `all_fine` remains the active completed cycle through stock 1, stock 0 closes it, and 0→15 creates a new cycle. Add a case proving an ordinary stock write never changes `isAvailable`.

- [ ] **Step 2: Run the repository integration test and verify the new cases fail**

Run: `rtk pnpm vitest run src/infrastructure/database/repositories/inventory/inventory-requests.repository.integration.test.ts`

Expected: FAIL because reconciliation and sellability helpers are missing.

- [ ] **Step 3: Implement the shared transactional helpers**

`lockVariantStockState()` must lock `product_variants` first, then read the open inspection and pending damaged/missing request while the lock is held. Return:

```ts
interface LockedVariantStockState {
  id: string;
  productId: string;
  sku: string;
  size: string | null;
  color: string | null;
  productName: string;
  stockQuantity: number;
  isAvailable: boolean;
  openInspectionId: string | null;
  pendingInspection: boolean;
  pendingFlaw: boolean;
  sellableStock: number;
  availabilityState: InventoryAvailabilityState;
}
```

`reconcileLowStockCycle()` receives previous and new stock plus the locked variant snapshots. It closes the active cycle at 0 or above 20, opens one at 1-20 only when none is active, and relies on the partial unique index as the final concurrency guard.

- [ ] **Step 4: Make the safe admin adjustment reconcile without toggling availability**

Change `adjustStockWithLog()` so its transaction:

1. locks and snapshots the variant;
2. writes only `stockQuantity` and `updatedAt`;
3. writes exactly one inventory log;
4. reconciles the cycle;
5. returns previous/new quantity plus whether sellability changed.

Remove `isAvailable: newQuantity > 0` from both stock-writing methods. Replace the interface’s Drizzle `NewInventoryLog` dependency with a domain-owned `InventoryLogInput` type.

- [ ] **Step 5: Remove every unused unlogged stock bypass**

Delete `UpdateVariantStockUseCase`, its container getter/export, `ProductVariantRepositoryInterface.updateStock`, `ProductVariantRepositoryInterface.adjustStock`, and their implementations. Delete `InventoryRepositoryInterface.updateVariantStock` and `getVariantStock`; make `adjustStockWithLog` perform all validation from its locked read.

- [ ] **Step 6: Implement batched sellability reads**

`readVariantSellability()` must query requested variants once, use `EXISTS`/grouped predicates for the active pending inspection and pending flaw, and feed each row into `resolveInventoryAvailability()`. Missing ids are omitted. `getVariantSellability()` delegates to it without exposing Drizzle types through the domain interface.

- [ ] **Step 7: Run focused unit and integration tests**

Run: `rtk pnpm vitest run src/domain/inventory/inventory-policy.test.ts src/application/inventory/use-cases/adjust-stock.use-case.test.ts src/infrastructure/database/repositories/inventory/inventory-requests.repository.integration.test.ts`

Expected: PASS; update the adjustment use-case mock to the new atomic interface and assert manual availability is untouched.

- [ ] **Step 8: Commit the transactional foundation**

```bash
rtk git add src/domain/inventory/interfaces/repositories/inventory.repository.interface.ts src/infrastructure/database/repositories/inventory src/domain/products/interfaces/repositories/product-variant.repository.interface.ts src/infrastructure/database/repositories/products/product-variant.repository.ts src/application/products
rtk git commit -m "refactor(inventory): Centralize transactional stock state"
```

---

### Task 4: Implement worker requests, green inspections, and admin decisions

**Files:**

- Create: `src/domain/inventory/interfaces/repositories/inventory-requests.repository.interface.ts`
- Create: `src/infrastructure/database/repositories/inventory/inventory-requests.repository.ts`
- Create: `src/application/inventory/use-cases/submit-adjustment-request.use-case.ts`
- Create: `src/application/inventory/use-cases/complete-inventory-inspection.use-case.ts`
- Create: `src/application/inventory/use-cases/review-adjustment-request.use-case.ts`
- Create: `src/application/inventory/use-cases/list-inventory-work.use-case.ts`
- Create: `src/application/inventory/use-cases/inventory-work.use-cases.test.ts`
- Modify: `src/application/inventory/inventory.container.ts`
- Modify: `src/application/inventory/index.ts`
- Modify: `src/application/container.ts`
- Modify: `src/application/notifications/notification.service.ts`
- Create: `src/application/notifications/notification.service.test.ts`
- Modify: `src/components/notifications/notification-visuals.ts`

**Interfaces:**

- Produces: `submit()`, `completeAllFine()`, `review()`, `listWork()`, and `countPending()` repository operations.
- Produces: `SubmitAdjustmentRequestUseCase.execute()`, `CompleteInventoryInspectionUseCase.execute()`, `ReviewAdjustmentRequestUseCase.execute()`, and `ListInventoryWorkUseCase.execute()`.
- Produces: `NotificationService.inventoryAdjustmentRequested()`.

- [ ] **Step 1: Write failing use-case tests for authorization and validation**

Test these exact rules:

- only role `worker` may submit or complete all-fine;
- only `admin`/`super_admin` may review;
- request explanation must remain non-empty after trim and be at most 500 characters;
- quantities are positive integers;
- corrected approval and rejection require a decision explanation;
- ordinary approval may omit the decision explanation;
- submission calls the notification service only after repository success;
- notification failure does not roll back or reject the saved request.

- [ ] **Step 2: Run the use-case tests and verify they fail**

Run: `rtk pnpm vitest run src/application/inventory/use-cases/inventory-work.use-cases.test.ts`

Expected: FAIL because the use cases do not exist.

- [ ] **Step 3: Define the repository contract and implement submission**

`submit()` must start a transaction, lock the variant, reject deleted/unavailable ids, store snapshots and current stock, link an optional open inspection, and set that inspection to `flaw_reported` for damaged/missing. Because quarantine is derived from the pending row, inserting that row while holding the variant lock establishes quarantine atomically against checkout.

- [ ] **Step 4: Implement all-fine completion**

`completeAllFine()` locks the variant, updates only an open `pending` inspection using a guarded `WHERE status = 'pending' AND cycle_ended_at IS NULL`, stores the worker snapshot/time, and returns a conflict when another worker already completed it. It changes no stock and writes no inventory log.

- [ ] **Step 5: Implement admin review**

`review()` locks the variant and guarded pending request. For approval, derive `delta = approvedQuantity` for extra and `-approvedQuantity` for damaged/missing, reject a negative result, update recorded stock, insert one inventory log, link its id, record reviewer snapshots, resolve the request, and reconcile the low-stock cycle in one transaction. Rejection changes no stock and records the required explanation. A null/deleted variant permits rejection but returns `variant_deleted` for approval.

- [ ] **Step 6: Implement grouped reads and pending count**

`listWork()` returns pending inspections, pending requests grouped/sorted by variant, then resolved history newest-first. `countPending()` counts unresolved inspections plus pending requests; it is a work-item count, not a distinct-variant count.

- [ ] **Step 7: Add the admin notification type**

Append `inventory_request` to `notificationTypeEnum`. Implement:

```ts
async inventoryAdjustmentRequested(input: {
  requestId: string;
  sku: string;
  category: "damaged" | "missing" | "extra";
  quantity: number;
}): Promise<void>
```

Fan out only to admin/super-admin ids with title `Inventory request awaiting review`, include SKU/category/quantity in the message, and preserve the service’s swallow-and-log failure contract. Map the new type to `Warehouse` or `ClipboardCheck` in notification visuals.

- [ ] **Step 8: Run use-case and notification tests**

Run: `rtk pnpm vitest run src/application/inventory/use-cases/inventory-work.use-cases.test.ts src/application/notifications/notification.service.test.ts`

Expected: PASS for authorization, validation, atomic-result mapping, and non-fatal notification behavior.

- [ ] **Step 9: Commit the application workflow**

```bash
rtk git add src/domain/inventory src/infrastructure/database/repositories/inventory src/application/inventory src/application/container.ts src/application/notifications src/db/schema.ts src/components/notifications/notification-visuals.ts
rtk git commit -m "feat(inventory): Add worker requests and admin review"
```

---

### Task 5: Expose the workflow through exact tRPC capabilities

**Files:**

- Modify: `src/server/trpc.ts:200-270`
- Modify: `src/server/admin-write-gating.test.ts`
- Modify: `src/server/routers/admin/inventory.ts`
- Modify: `src/server/utils/revalidate-catalogue.ts`

**Interfaces:**

- Consumes: Task 4 use cases.
- Produces: `workerProcedure` and `admin.inventory.{listWork,pendingCount,submitRequest,completeInspection,reviewRequest}`.

- [ ] **Step 1: Extend the source-scan tests before adding routes**

Add a `WORKER_ONLY_MUTATIONS` set containing `inventory.ts::submitRequest` and `inventory.ts::completeInspection`. Assert both use `workerProcedure`. Continue requiring `reviewRequest` and `adjustStock` to use `adminWriteProcedure`, and all inventory queries to use `adminProcedure`.

- [ ] **Step 2: Run the gating test and verify it fails**

Run: `rtk pnpm vitest run src/server/admin-write-gating.test.ts`

Expected: FAIL because `workerProcedure` and the named mutations do not exist.

- [ ] **Step 3: Add `workerProcedure`**

Build it from the existing authenticated/admin-area middleware but require `ctx.user.role === "worker"`. Return tRPC `FORBIDDEN` for admin, super-admin, customer, or missing role. Export it beside the existing capability-specific procedures.

Update the test's procedure-discovery regular expression to include
`workerProcedure`; otherwise the source scan would silently omit the new
worker-only mutations.

- [ ] **Step 4: Add thin inventory procedures**

Use these inputs:

```ts
submitRequest: {
  variantId: string;
  inspectionId?: string;
  category: "damaged" | "missing" | "extra";
  quantity: number;
  explanation: string;
}
completeInspection: { inspectionId: string }
reviewRequest: {
  requestId: string;
  decision: "approved" | "rejected";
  approvedQuantity?: number;
  explanation?: string;
}
```

Use UUID schemas, integer positive quantities, trimmed explanation `min(1).max(500)`, and container use cases only. Remove the module-scope `inventoryRepo` and resolve it/use cases in handlers. Call `revalidateCatalogue()` after adjustment, all-fine completion, flaw submission, and review; extra submission needs only request/count invalidation.

- [ ] **Step 5: Run router/gating tests**

Run: `rtk pnpm vitest run src/server/admin-write-gating.test.ts src/application/inventory/use-cases/inventory-work.use-cases.test.ts`

Expected: PASS with worker-only submissions, worker-readable queries, and admin-only decisions.

- [ ] **Step 6: Commit the API boundary**

```bash
rtk git add src/server/trpc.ts src/server/admin-write-gating.test.ts src/server/routers/admin/inventory.ts src/server/utils/revalidate-catalogue.ts
rtk git commit -m "feat(inventory): Expose role-scoped review procedures"
```

---

### Task 6: Use sellable stock in public catalogue and live scrolling data

**Files:**

- Modify: `src/domain/products/interfaces/repositories/product-variant.repository.interface.ts`
- Modify: `src/infrastructure/database/repositories/products/product-variant.repository.ts`
- Modify: `src/server/routers/public/products.ts`
- Modify: `src/server/routers/public/products.integration.test.ts`
- Modify: `src/lib/cache.ts`
- Modify: `src/lib/transformers/products.ts`
- Modify: `src/components/providers/variant-stock-provider.tsx`
- Modify: `src/hooks/use-variant-stock.ts`
- Modify: `src/lib/variant-stock-registry.test.ts`

**Interfaces:**

- Produces: `SellableProductVariant` with `variant`, `sellableStock`, and `availabilityState`.
- Changes live payload to `{ stock: Record<string, number>, states: Record<string, InventoryAvailabilityState> }`.
- Extends `VariantStockLookup` with `state(variantId): InventoryAvailabilityState | null`.

- [ ] **Step 1: Write failing public-product integration cases**

Insert variants representing ordinary stock, pending inspection, green inspection, pending missing request, pending extra request, manual unavailability, and zero stock. Assert `getStock` returns 1 at recorded 11 during pending inspection, 11 after all-fine, 0 under flaw quarantine, unchanged trusted stock for extra, and 0 for manual/zero states.

- [ ] **Step 2: Run the public-products integration test and verify it fails**

Run: `rtk pnpm vitest run src/server/routers/public/products.integration.test.ts`

Expected: FAIL because public reads still expose raw stock.

- [ ] **Step 3: Add sellable repository read methods**

Add `findSellableByIds`, `findSellableByProduct`, and `findSellableByProducts` to the product-variant repository contract. Implement them with one query per call using the same pending-inspection/pending-flaw predicates as `readVariantSellability()`. Keep existing raw methods for staff editing and product persistence.

- [ ] **Step 4: Switch every cached and uncached catalogue response**

Use sellable methods in `withCardData`, featured products, product-by-slug, and related products. Set card `inStock` from `sellableStock > 0`; set detail `availableStock` from `sellableStock`; preserve manually available zero-stock variants so the UI can display the option as temporarily unavailable rather than silently removing its size.

- [ ] **Step 5: Extend the live stock provider**

Keep one unioned polling query. `get()` returns sellable stock, and new `state()` returns the server state. Unknown ids remain `null`. Continue the 60-second browsing poll and window-focus refresh; do not add per-card requests.

- [ ] **Step 6: Run catalogue and registry tests**

Run: `rtk pnpm vitest run src/server/routers/public/products.integration.test.ts src/lib/variant-stock-registry.test.ts`

Expected: PASS with one shared scrolling query and derived availability values.

- [ ] **Step 7: Commit catalogue sellability**

```bash
rtk git add src/domain/products/interfaces/repositories/product-variant.repository.interface.ts src/infrastructure/database/repositories/products/product-variant.repository.ts src/server/routers/public/products.ts src/server/routers/public/products.integration.test.ts src/lib/cache.ts src/lib/transformers/products.ts src/components/providers/variant-stock-provider.tsx src/hooks/use-variant-stock.ts src/lib/variant-stock-registry.test.ts
rtk git commit -m "feat(storefront): Publish derived variant availability"
```

---

### Task 7: Enforce the same ceiling in cart controls and cart writes

**Files:**

- Modify: `src/infrastructure/database/repositories/cart/cart.repository.ts`
- Create: `src/infrastructure/database/repositories/cart/cart.repository.integration.test.ts`
- Modify: `src/application/cart/use-cases/check-cart-stock.use-case.ts`
- Modify: `src/application/cart/use-cases/check-cart-stock.use-case.test.ts`
- Modify: `src/application/cart/use-cases/change-cart-item-variant.use-case.ts`
- Modify: `src/application/cart/use-cases/merge-guest-cart-items.use-case.ts`
- Modify: `src/components/products/QuickAddBar.tsx`
- Modify: `src/components/products/ProductDetail.tsx`
- Modify: `src/components/products/product-detail/ProductActions.tsx`
- Modify: `src/components/products/product-detail/ProductVariantSelector.tsx`
- Modify: `src/lib/cart-stock-limit.test.ts`

**Interfaces:**

- Consumes: sellable repository methods and `VariantStockLookup.state()`.
- Produces: cart entities whose `maxStock` is the current sellable ceiling.
- Produces: customer-facing temporary-unavailability state distinct from genuine zero stock.

- [ ] **Step 1: Write failing cart unit and integration cases**

Test add and quantity-update at recorded 11/pending inspection: quantity 1 succeeds, quantity 2 fails. Test a pending flaw rejects all adds, an extra request does not reduce trusted stock, and a reduction remains allowed when an existing cart line is above the new ceiling. Update `CheckCartStockUseCase` fixtures to assert alternatives use sellable rather than recorded stock.

- [ ] **Step 2: Run the cart tests and verify they fail**

Run: `rtk pnpm vitest run src/application/cart/use-cases/check-cart-stock.use-case.test.ts src/infrastructure/database/repositories/cart/cart.repository.integration.test.ts src/lib/cart-stock-limit.test.ts`

Expected: FAIL because cart paths still use `stockQuantity`.

- [ ] **Step 3: Replace raw cart stock reads**

In `addItem`, `assertWithinStock`, `mapToEntity`, variant changes, guest merge, and stock reconciliation, use the shared sellability read or `findSellable...` repository method. For products without a selected variant, sum sellable stock, not recorded stock. Preserve the existing rule that reductions are allowed and checkout revalidates.

- [ ] **Step 4: Update quick add and the product page**

Use `stock.get()` for remaining capacity and `stock.state()` for wording. Disabled quick-add chips and product actions show `Temporarily unavailable` for `inspection_pending`/`quarantined`, while genuine `out_of_stock` still shows `Out of stock`. The `+` button remains disabled at `quantity >= maxQuantity`; at recorded 11/pending inspection its ceiling is exactly 1.

- [ ] **Step 5: Add the approved supporting copy**

Pass an `availabilityState` prop into `ProductActions`. For protected/quarantined states render:

```tsx
<p>We're confirming availability. Check back soon.</p>
```

Do not render `Restocking soon`. Keep internal reasons out of customer UI.

- [ ] **Step 6: Run all focused cart and product-control tests**

Run: `rtk pnpm vitest run src/application/cart/use-cases/check-cart-stock.use-case.test.ts src/infrastructure/database/repositories/cart/cart.repository.integration.test.ts src/lib/cart-stock-limit.test.ts`

Expected: PASS for server writes, reconciliation, alternatives, and the protected-floor arithmetic.

- [ ] **Step 7: Commit cart and controls**

```bash
rtk git add src/infrastructure/database/repositories/cart src/application/cart src/components/products src/lib/cart-stock-limit.test.ts
rtk git commit -m "feat(storefront): Enforce protected inventory in cart flows"
```

---

### Task 8: Make checkout, cancellation, returns, and shipping race-safe

**Files:**

- Modify: `src/infrastructure/database/repositories/orders/order.repository.ts:390-470,600-940`
- Modify: `src/infrastructure/database/repositories/orders/order.repository.integration.test.ts`
- Modify: `src/domain/orders/interfaces/repositories/order.repository.interface.ts`
- Modify: `src/application/orders/use-cases/update-order-status.use-case.ts`
- Modify: `src/components/admin/orders/OrderDetail.tsx`
- Modify: `src/components/admin/orders/detail/UpdateStatusCard.tsx`
- Modify: `src/server/routers/public/checkout.ts`
- Modify: `src/server/routers/admin/orders.ts`
- Modify: `src/server/routers/public/cart.ts`
- Modify: `src/server/routers/public/orders.ts`
- Modify: `src/app/api/webhook/stripe/route.ts`
- Modify: `src/application/orders/use-cases/cancel-expired-checkouts.use-case.ts`

**Interfaces:**

- Consumes: `lockVariantStockState()` and `reconcileLowStockCycle()`.
- Produces: checkout validation against sellable stock and `InventoryQuarantineError` for shipping.

- [ ] **Step 1: Add failing concurrency and shipment tests**

Add integration cases for:

- recorded 11/pending inspection: an order for 1 succeeds and reaches 10; an order for 2 fails;
- three concurrent orders for 3 from recorded 19 serialize to 10 and all succeed;
- a fourth order fails once sellable stock is zero;
- a pending damaged/missing request blocks transition to shipped;
- deciding that request permits shipping again;
- two concurrent cancellations credit each ordered unit once;
- concurrent returns against the same line credit only the guarded returned/restocked quantity once;
- cancellation and return racing on the same line cannot both credit the unit.

- [ ] **Step 2: Run the order integration tests and verify the new cases fail**

Run: `rtk pnpm vitest run src/infrastructure/database/repositories/orders/order.repository.integration.test.ts`

Expected: FAIL on protected-floor, shipping-quarantine, and cancellation serialization cases.

- [ ] **Step 3: Enforce sellability in order creation**

Keep stable variant lock ordering. After each variant lock, read pending inspection/flaw state inside the same transaction and compare `item.quantity` to `sellableStock`, not recorded stock. Update the stock and sale log as today, then reconcile the low-stock cycle before moving to the next variant.

- [ ] **Step 4: Guard cancellation from stale concurrent reads**

Lock the order row at the start of the cancellation transaction and require its status still permits cancellation before updating/restocking. Make the status update conditional on the expected current status; if no row updates, throw a reload/conflict error before any stock credit. Keep stable variant lock ordering and reconcile each stock increase.

- [ ] **Step 5: Serialize cancellation versus return**

Lock the order row before reading refundable quantities in both paths. Keep the existing guarded `order_items.refunded_quantity` increment, and calculate restock from the locked/current row values. This ensures cancellation and return cannot both credit the same remaining unit.

- [ ] **Step 6: Block shipping under quarantine**

Before `paid -> shipped`, query whether any order item’s variant has a pending damaged/missing request. Throw `InventoryQuarantineError` containing safe SKU/product labels, not worker explanations. Map it to a clear admin error and show a red notice in order detail; do not expose it to customer APIs as a quality allegation.

- [ ] **Step 7: Re-run order integration tests**

Run: `rtk pnpm vitest run src/infrastructure/database/repositories/orders/order.repository.integration.test.ts`

Expected: PASS with exact final stock/log counts under every concurrent case.

- [ ] **Step 8: Invalidate cached catalogue data from every order-side writer**

Call `revalidateCatalogue()` after successful COD/card order creation, admin
cancellation, and admin return. For the existing fire-and-forget expired-order
cleanup in the cart, customer-order, and admin-order routers, revalidate in the
settled callback only when `CancelExpiredCheckoutsResult.cancelled > 0`.
Revalidate after Stripe expiry cancellation in the webhook. A checkout-session
creation failure needs no invalidation because its create/cancel pair leaves no
net stock or open inspection cycle.

- [ ] **Step 9: Commit order integrity changes**

```bash
rtk git add src/infrastructure/database/repositories/orders/order.repository.ts src/infrastructure/database/repositories/orders/order.repository.integration.test.ts src/domain/orders/interfaces/repositories/order.repository.interface.ts src/application/orders/use-cases/update-order-status.use-case.ts src/application/orders/use-cases/cancel-expired-checkouts.use-case.ts src/components/admin/orders src/server/routers/public/checkout.ts src/server/routers/admin/orders.ts src/server/routers/public/cart.ts src/server/routers/public/orders.ts src/app/api/webhook/stripe/route.ts
rtk git commit -m "fix(orders): Serialize stock credits and honor quarantine"
```

---

### Task 9: Reconcile variant creation and every admin stock write

**Files:**

- Modify: `src/application/products/use-cases/add-product-variant.use-case.ts`
- Modify: `src/application/products/product.container.ts`
- Modify: `src/infrastructure/database/repositories/products/product-variant.repository.ts`
- Modify: `src/infrastructure/database/repositories/products/product.repository.ts`
- Modify: `src/server/routers/admin/products.ts`
- Modify: `src/server/routers/admin/variants.ts`
- Modify: `src/server/routers/admin/inventory.ts`
- Modify: `src/application/inventory/use-cases/adjust-stock.use-case.ts`
- Modify: `src/application/inventory/use-cases/adjust-stock.use-case.test.ts`
- Modify: `src/infrastructure/database/repositories/inventory/inventory-requests.repository.integration.test.ts`

**Interfaces:**

- Consumes: `reconcileLowStockCycle()`.
- Produces: opening-stock inspection behavior for both single-variant and product-with-variants creation.

- [ ] **Step 1: Add failing creation and manual-adjustment cases**

Test opening stock 0 creates no inspection, 1-20 creates one pending inspection, and 21 creates none for both single variant creation and batched product creation. Test admin adjustment 21→20 opens an inspection, 20→19 does not duplicate it, and 10→25 closes the cycle without changing manual availability.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `rtk pnpm vitest run src/application/inventory/use-cases/adjust-stock.use-case.test.ts src/infrastructure/database/repositories/inventory/inventory-requests.repository.integration.test.ts`

Expected: FAIL on opening-stock reconciliation.

- [ ] **Step 3: Reconcile single and batched creation transactions**

After inserting each variant, call reconciliation with `previousStock: 0` and its opening stock in the same transaction. Product creation already inserts product/variants atomically; keep inspection inserts in that transaction. Extend `AddProductVariantUseCase` dependencies only as needed to reach the transaction-safe repository method; do not emit an opening-stock inventory log.

- [ ] **Step 4: Make catalogue invalidation complete**

Call `revalidateCatalogue()` after `admin.inventory.adjustStock` and every variant/product mutation whose opening stock or manual availability changes sellability. Keep request routes from Task 5 invalidating only when sellability changes.

- [ ] **Step 5: Run focused tests**

Run: `rtk pnpm vitest run src/application/inventory/use-cases/adjust-stock.use-case.test.ts src/infrastructure/database/repositories/inventory/inventory-requests.repository.integration.test.ts src/server/admin-write-gating.test.ts`

Expected: PASS with one inspection per cycle and no unlogged stock-write route.

- [ ] **Step 6: Commit stock-writer coverage**

```bash
rtk git add src/application/products src/infrastructure/database/repositories/products src/server/routers/admin/products.ts src/server/routers/admin/variants.ts src/server/routers/admin/inventory.ts src/application/inventory
rtk git commit -m "feat(inventory): Reconcile every stock-changing path"
```

---

### Task 10: Build the staff request, inspection, and review interface

**Files:**

- Create: `src/components/admin/inventory/RequestsTab.tsx`
- Create: `src/components/admin/inventory/RequestAdjustmentDialog.tsx`
- Create: `src/components/admin/inventory/ReviewAdjustmentDialog.tsx`
- Create: `src/components/admin/inventory/InventoryAvailabilityBadge.tsx`
- Modify: `src/app/admin/inventory/page.tsx`
- Modify: `src/components/admin/inventory/AllStockTab.tsx`
- Modify: `src/components/admin/inventory/LowStockTab.tsx`
- Modify: `src/components/admin/inventory/InventoryHeader.tsx`
- Modify: `src/components/admin/AdminSidebar.tsx`

**Interfaces:**

- Consumes: `admin.inventory.listWork`, `pendingCount`, `submitRequest`, `completeInspection`, and `reviewRequest`.
- Produces: worker/admin role-correct actions and pending-count cache invalidation.

- [x] **Step 1: Add the Requests tab and query state**

Fetch list work and pending count. Render pending inspections first, pending requests grouped by variant second, and resolved history last. Add the Requests tab count and an empty state. Keep all staff able to read every row.
Change the existing Low Stock query/display threshold from 10 to the approved
inspection threshold of 20; the protected floor remains 10.

- [x] **Step 2: Implement role-correct inventory actions**

Use `useAdminWriteAccess()`:

- worker rows show **Request adjustment** and pending inspection actions;
- admin/super rows show the existing **Adjust stock** action;
- only admin/super request rows show review controls;
- role-loading state disables controls without reshuffling the table.

Do not render a direct edit icon to workers.

- [x] **Step 3: Implement the worker request dialog**

Require category, positive integer quantity, and concrete explanation. Accept an optional inspection id when launched from pending inspection. On success close, toast, and invalidate `listWork`, `pendingCount`, `listVariants`, `getLowStock`, `getLogs`, public `getStock`, and cart stock queries.

- [x] **Step 4: Implement green all-fine completion**

Use a deliberate confirmation action labelled **Checked all units — everything is fine**. On success show green state immediately through optimistic React Query cache update, then invalidate the authoritative queries. Roll back the optimistic cache and show the server error on conflict.

- [x] **Step 5: Implement admin review**

Show original quantity/explanation, requester snapshot, request-time stock, current stock, projected result, and sibling pending requests. Approval defaults to the requested quantity. A changed quantity reveals and requires explanation; rejection always requires explanation. Disable repeated submission while pending.

- [x] **Step 6: Add internal status styling**

`InventoryAvailabilityBadge` maps `all_fine` to muted emerald/green, flaw/quarantine to destructive red, pending inspection to amber, and ordinary availability to neutral styling. Use paired background/foreground classes that work in the light admin theme.

- [x] **Step 7: Add the sidebar count**

Query `pendingCount` from `AdminSidebar` with a 30-second refetch interval and window-focus refresh. Render a compact badge beside Inventory for counts above zero. Mutations invalidate the same key so the submitting browser updates immediately; polling handles another staff session without realtime infrastructure.

- [ ] **Step 8: Manually smoke-test all three roles**

Run: `rtk pnpm dev`

Verify worker can see/request/green-complete but cannot directly adjust/review; admin can adjust/review but cannot submit worker requests; super admin matches admin; multiple same-variant requests group together; corrected approval/rejection requires explanations; sidebar/tab counts update; green/red states and customer-neutral wording are correct.

- [ ] **Step 9: Commit the staff interface**

```bash
rtk git add src/app/admin/inventory/page.tsx src/components/admin/inventory src/components/admin/AdminSidebar.tsx
rtk git commit -m "feat(admin): Add inventory request and inspection workspace"
```

---

### Task 11: Zero fake inventory safely

**Files:**

- Modify: `scripts/seed.ts`
- Modify: `scripts/seed-products.ts`
- Modify: `scripts/seed-basic.ts`
- Modify: `content/products.json`
- Create: `scripts/reset-development-inventory.ts`
- Modify: `package.json`

**Interfaces:**

- Produces: `pnpm inventory:reset-development` as an explicit development-only stock reset.

- [x] **Step 1: Add a dry-run mode to the reset script first**

The script must refuse to run when `NODE_ENV === "production"`. Default behavior prints variant id, SKU, current stock, and projected zero without writing. Require `--apply` for the transaction that sets only `stock_quantity = 0` and `updated_at`; do not change `is_available`, delete users/orders, or run migrations.

- [x] **Step 2: Add zero-stock seed assertions**

Extract or export the generated variant rows where necessary and add a script-level test or validation that every seeded `stockQuantity` is zero. `scripts/seed.ts` already uses zero and should remain so.

- [x] **Step 3: Remove fictional stock from catalogue fixtures**

Remove `stockPerSize` from `content/products.json` and `ProductSeed`. Make `seed-products.ts` insert zero. Change all `seed-basic.ts` variant quantities to zero and update its summary; leave `isAvailable` true where a future real restock should make the variant sellable.

- [x] **Step 4: Exercise the reset safely**

Run: `rtk pnpm inventory:reset-development`

Expected: dry-run output only and no database change.

Run: `rtk pnpm inventory:reset-development -- --apply`

Expected: current fake variant stock becomes zero, manual availability remains unchanged, and no inspection is created because the reset is explicitly fixture maintenance rather than an operational stock movement.

- [x] **Step 5: Verify zero-stock behavior**

Run: `rtk pnpm vitest run src/domain/inventory/inventory-policy.test.ts src/infrastructure/database/repositories/inventory/inventory-requests.repository.integration.test.ts`

Expected: PASS, including zero creates no inspection.

- [x] **Step 6: Commit development-data changes**

```bash
rtk git add scripts/seed.ts scripts/seed-products.ts scripts/seed-basic.ts scripts/reset-development-inventory.ts content/products.json package.json
rtk git commit -m "chore(seed): Reset fictional inventory to zero"
```

---

### Task 12: Complete regression verification and durable handoff

**Files:**

- Modify: `AGENTS.md`
- Modify: `docs/PRELAUNCH-HANDOFF.md`
- Modify: `docs/superpowers/plans/2026-09-15-inventory-adjustment-request-review.md` (record actual verification results only)

**Interfaces:**

- Consumes: every prior task.
- Produces: verified repository baseline and an implementation handoff that distinguishes shipped, approved-unbuilt, and externally blocked work.

- [x] **Step 1: Run focused inventory/storefront/order suites together**

Run:

```bash
rtk pnpm vitest run src/domain/inventory/inventory-policy.test.ts src/application/inventory/use-cases/adjust-stock.use-case.test.ts src/application/inventory/use-cases/inventory-work.use-cases.test.ts src/application/notifications/notification.service.test.ts src/server/admin-write-gating.test.ts src/server/routers/public/products.integration.test.ts src/infrastructure/database/repositories/inventory/inventory-requests.repository.integration.test.ts src/infrastructure/database/repositories/cart/cart.repository.integration.test.ts src/infrastructure/database/repositories/orders/order.repository.integration.test.ts src/application/cart/use-cases/check-cart-stock.use-case.test.ts src/lib/cart-stock-limit.test.ts src/lib/variant-stock-registry.test.ts
```

Expected: PASS with no skipped concurrency cases.

- [x] **Step 2: Run the complete static and unit-test baseline**

Run:

```bash
rtk pnpm lint
rtk powershell -NoProfile -Command "Remove-Item -Recurse -Force -LiteralPath '.next'"
rtk pnpm type-check
rtk pnpm test
```

Expected: lint has 0 problems, type-check succeeds from a clean `.next`, and every unit test passes.

- [x] **Step 3: Run the complete database integration suite**

Run: `rtk pnpm test:integration`

Expected: all database integration files pass against the development database after `db:push`; do not run `db:migrate`.

- [x] **Step 4: Run the production build**

Run: `rtk pnpm build`

Expected: successful production build with admin inventory and storefront product routes included.

- [ ] **Step 5: Perform the browser smoke test**

With worker, admin, and super-admin accounts, exercise the complete flow and the 20/10 thresholds. In a second browser/session, verify pending sidebar counts appear within 30 seconds. Confirm stale product pages and simultaneous checkout attempts cannot cross the server floor. Confirm quarantined order lines block shipping and the block clears after review.

- [x] **Step 6: Update durable documentation with measured results**

Record the new exact test/file counts, migration state, implemented inventory behavior, remaining external blockers, and the commit range. Mark this phase implemented only after every required check passes. Keep refund OTP/OPay, identity/messaging, media buyer/leads, and production cutover in their existing states.

- [x] **Step 7: Review the complete branch diff**

Run:

```bash
git status --short
git diff --check
git diff 7c4c778..HEAD --stat
git log --oneline 7c4c778..HEAD
```

Expected: only inventory-phase files are changed, no whitespace errors, and commits follow the planned boundaries.

- [x] **Step 8: Commit the final verification record**

```bash
rtk git add AGENTS.md docs/PRELAUNCH-HANDOFF.md docs/superpowers/plans/2026-09-15-inventory-adjustment-request-review.md
rtk git commit -m "docs(prelaunch): Record inventory review implementation"
```
