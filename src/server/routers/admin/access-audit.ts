import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { container } from "@/application/container";
import { CustomerAccessDeniedError } from "@/domain/customer-access/customer-access-denied.error";
import { adminProcedure, router } from "@/server/trpc";

const listForStaffSchema = z
  .object({
    staffUserId: z.string().min(1).optional(),
    limit: z.number().int().positive().max(100).default(25),
    offset: z.number().int().min(0).default(0),
  })
  .optional();

export const accessAuditRouter = router({
  listForStaff: adminProcedure
    .input(listForStaffSchema)
    .query(async ({ ctx, input }) => {
      const actorUserId = input?.staffUserId ?? ctx.user.id;
      try {
        return await container.getListStaffAccessAuditUseCase().execute({
          viewerUserId: ctx.user.id,
          viewerRole: ctx.user.role,
          actorUserId,
          limit: input?.limit ?? 25,
          offset: input?.offset ?? 0,
        });
      } catch (error) {
        if (!(error instanceof CustomerAccessDeniedError)) throw error;
        throw new TRPCError({
          code: "FORBIDDEN",
          message: error.message,
        });
      }
    }),
});
