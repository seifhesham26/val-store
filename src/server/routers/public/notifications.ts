/**
 * Public User Notifications Router
 *
 * Get notifications, mark as read for logged-in users.
 */

import { router, protectedProcedure } from "@/server/trpc";
import { z } from "zod/v4";
import { DrizzleUserNotificationsRepository } from "@/infrastructure/database/repositories/notifications/user-notifications.repository";

const notificationsRepo = new DrizzleUserNotificationsRepository();

export const publicNotificationsRouter = router({
  /**
   * Get notifications for current user
   */
  list: protectedProcedure
    .input(
      z
        .object({
          unreadOnly: z.boolean().optional(),
          limit: z.number().int().positive().max(50).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      return notificationsRepo.findByUser(ctx.user.id, {
        unreadOnly: input?.unreadOnly,
        limit: input?.limit ?? 20,
      });
    }),

  /**
   * Get unread count
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return notificationsRepo.getUnreadCount(ctx.user.id);
  }),

  /**
   * Mark notification as read
   */
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await notificationsRepo.markAsRead(input.id);
      return { success: true };
    }),

  /**
   * Mark all as read
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await notificationsRepo.markAllAsRead(ctx.user.id);
    return { success: true };
  }),

  /**
   * Delete a notification
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await notificationsRepo.delete(input.id);
      return { success: true };
    }),
});
