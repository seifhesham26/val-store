import { z } from "zod";

import { container } from "@/application/container";
import {
  adminProcedure,
  adminWriteProcedure,
  router,
  staffEvidenceProcedure,
} from "../../trpc";

const id = z.string().uuid();
const returnStatus = z.enum([
  "requested",
  "awaiting_customer_evidence",
  "pickup_authorized",
  "pickup_pending",
  "in_transit",
  "received",
  "count_disputed",
  "inspection_pending",
  "awaiting_customer_confirmation",
  "disputed",
  "customer_action_required",
  "confirmed",
  "recorded",
  "rejected",
  "evidence_exception",
]);
const outcome = z.enum([
  "unworn",
  "worn_resellable",
  "defective",
  "customer_damage",
  "damaged_quarantine",
  "missing_not_received",
]);
const fault = z.enum(["customer", "carrier", "valkyrie", "unresolved"]);

const inspectionInput = z
  .object({
    requestId: id,
    expectedStatus: returnStatus,
    evidenceComplete: z.boolean(),
    auditedMediaException: z.boolean(),
    returnedAllOrder: z.boolean(),
    originalDelivery: z.number().min(0),
    collectionFee: z.number().min(0),
    capturedPayment: z.number().min(0),
    payoutDestination: z.string().trim().max(128).nullable(),
    customerCopy: z.string().trim().min(1).max(2_000),
    lines: z
      .array(
        z
          .object({
            requestItemId: id,
            paidAmount: z.number().min(0),
            receivedQuantity: z.number().int().min(0),
            inspectedQuantity: z.number().int().min(0),
            approvedQuantity: z.number().int().min(0),
            restockedQuantity: z.number().int().min(0),
            outcome,
            fault,
          })
          .strict()
      )
      .min(1),
  })
  .strict();

const actor = (user: { id: string; role: string }) => ({
  id: user.id,
  role: user.role as "worker" | "admin" | "super_admin",
});

/** Staff return queue. Customer contact and addresses are never loaded here. */
export const adminReturnsRouter = router({
  list: adminProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(50) })
        .optional()
    )
    .query(({ input }) =>
      container.getReturnRequestRepository().listWork(input?.limit)
    ),

  getById: adminProcedure
    .input(z.object({ requestId: id }).strict())
    .query(async ({ input }) => {
      const request = await container
        .getReturnRequestRepository()
        .findForStaff(input.requestId);
      if (!request) throw new Error("Return request not found");
      return request;
    }),

  pendingCount: adminProcedure.query(() =>
    container.getReturnRequestRepository().countWork()
  ),

  authorizePickup: adminWriteProcedure
    .input(z.object({ requestId: id }).strict())
    .mutation(async ({ ctx, input }) => {
      const request = await container
        .getAuthorizeReturnPickupUseCase()
        .execute({ actor: actor(ctx.user), requestId: input.requestId });
      await container
        .getNotificationService()
        .returnUpdated({
          userId: request.customerId,
          requestId: request.id,
          status: request.status,
        });
      return request;
    }),

  recordInspection: adminWriteProcedure
    .input(inspectionInput)
    .mutation(async ({ ctx, input }) => {
      const request = await container
        .getRecordReturnInspectionUseCase()
        .execute({ ...input, actor: actor(ctx.user) });
      await container
        .getNotificationService()
        .returnUpdated({
          userId: request.customerId,
          requestId: request.id,
          status: request.status,
        });
      return request;
    }),

  // A proposal is only approved by saving an inspection-derived calculation.
  approveProposal: adminWriteProcedure
    .input(inspectionInput)
    .mutation(async ({ ctx, input }) => {
      const request = await container
        .getRecordReturnInspectionUseCase()
        .execute({ ...input, actor: actor(ctx.user) });
      await container
        .getNotificationService()
        .returnUpdated({
          userId: request.customerId,
          requestId: request.id,
          status: request.status,
        });
      return request;
    }),

  reject: adminWriteProcedure
    .input(
      z
        .object({ requestId: id, reason: z.string().trim().min(1).max(2_000) })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      const request = await container
        .getRejectReturnUseCase()
        .execute({ actor: actor(ctx.user), ...input });
      await container
        .getNotificationService()
        .returnUpdated({
          userId: request.customerId,
          requestId: request.id,
          status: request.status,
        });
      return request;
    }),

  mediaException: adminWriteProcedure
    .input(z.object({ requestId: id, expectedStatus: returnStatus }).strict())
    .mutation(async ({ input }) =>
      container
        .getReturnRequestRepository()
        .transition(input.requestId, input.expectedStatus, "evidence_exception")
    ),

  /** A worker may record observed package facts, but cannot decide an outcome. */
  recordEvidenceIntake: staffEvidenceProcedure
    .input(
      z
        .object({
          requestId: id,
          kind: z.enum(["courier_handoff", "receiving_count", "second_count"]),
          packageCount: z.number().int().positive(),
          itemCount: z.number().int().positive().optional(),
          sealIntact: z.boolean().optional(),
          note: z.string().trim().max(2_000).optional(),
        })
        .strict()
    )
    .mutation(({ ctx, input }) =>
      container
        .getRecordPackageEventUseCase()
        .execute({
          actor: actor(ctx.user),
          requestId: input.requestId,
          event: input,
        })
    ),
});
