import { z } from "zod";

export const WORKER_SUPPORT_REASONS = [
  "order_status",
  "delivery_problem",
  "return_exchange",
  "other",
] as const;

export const CUSTOMER_REVEAL_REASONS = [
  "customer_support",
  "delivery_issue",
  "account_correction",
  "other",
] as const;

function requireOtherNote(
  value: { reason: string; reasonNote?: string },
  ctx: z.RefinementCtx
) {
  if (value.reason === "other" && !value.reasonNote?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["reasonNote"],
      message: "A short note is required when the reason is other",
    });
  }
}

export const workerSupportLookupSchema = z
  .object({
    email: z.string().trim().email().toLowerCase(),
    confirmedCustomerRequest: z.literal(true),
    reason: z.enum(WORKER_SUPPORT_REASONS),
    reasonNote: z.string().trim().max(500).optional(),
  })
  .superRefine(requireOtherNote);

export const customerContactRevealSchema = z
  .object({
    customerId: z.string().min(1),
    reason: z.enum(CUSTOMER_REVEAL_REASONS),
    reasonNote: z.string().trim().max(500).optional(),
  })
  .superRefine(requireOtherNote);
