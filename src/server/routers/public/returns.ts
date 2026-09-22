import { z } from "zod";

import { container } from "@/application/container";
import { router, protectedProcedure } from "../../trpc";

const id = z.string().uuid();
const proposalInput = z
  .object({ requestId: id, proposalVersion: z.number().int().positive() })
  .strict();

/** Customer-scoped return workflow. All financial values stay server-owned. */
export const returnsRouter = router({
  create: protectedProcedure
    .input(
      z
        .object({
          orderId: id,
          reason: z.enum([
            "change_of_mind",
            "defective",
            "wrong_item",
            "not_as_described",
            "late_delivery",
          ]),
          customerNote: z.string().trim().max(2_000).optional(),
          pickupMethod: z.enum(["courier", "in_store"]),
          lines: z
            .array(
              z
                .object({
                  orderItemId: id,
                  quantity: z.number().int().positive(),
                })
                .strict()
            )
            .min(1),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      const request = await container.getCreateReturnRequestUseCase().execute({
        ...input,
        userId: ctx.user.id,
      });
      await container.getNotificationService().returnRequested({
        requestId: request.id,
        orderNumber: null,
        itemCount: request.items.length,
      });
      return request;
    }),

  getById: protectedProcedure
    .input(z.object({ requestId: id }).strict())
    .query(async ({ ctx, input }) => {
      const repository = container.getReturnRequestRepository();
      const request = await repository.findForCustomer(
        input.requestId,
        ctx.user.id
      );
      if (!request) throw new Error("Return request not found");
      if (
        request.proposal &&
        (request.status === "awaiting_customer_confirmation" ||
          request.status === "customer_action_required")
      ) {
        const proposalOpenedAt = await repository.markProposalOpened({
          requestId: request.id,
          customerId: ctx.user.id,
          proposalVersion: request.proposalVersion,
        });
        return { ...request, proposalOpenedAt };
      }
      return request;
    }),

  listForOrder: protectedProcedure
    .input(z.object({ orderId: id }).strict())
    .query(({ ctx, input }) =>
      container
        .getReturnRequestRepository()
        .listForOrder(input.orderId, ctx.user.id)
    ),

  acknowledge: protectedProcedure
    .input(proposalInput)
    .mutation(({ ctx, input }) =>
      container.getAcknowledgeReturnProposalUseCase().execute({
        ...input,
        userId: ctx.user.id,
      })
    ),

  requestOtp: protectedProcedure
    .input(proposalInput)
    .mutation(({ ctx, input }) =>
      container.getRequestReturnOtpUseCase().execute({
        ...input,
        userId: ctx.user.id,
      })
    ),

  confirmOtp: protectedProcedure
    .input(
      proposalInput.extend({
        challengeId: id,
        code: z.string().regex(/^\d{6}$/, "Enter the six-digit code"),
      })
    )
    .mutation(({ ctx, input }) =>
      container.getConfirmReturnOtpUseCase().execute({
        ...input,
        userId: ctx.user.id,
      })
    ),
});
