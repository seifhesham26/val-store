/**
 * Admin Notifications Router
 *
 * Get notifications, mark as read, manage alerts.
 */

import { router, adminProcedure } from "@/server/trpc";
import { z } from "zod/v4";
import { DrizzleNotificationsRepository } from "@/infrastructure/database/repositories/notifications/notifications.repository";

const notificationsRepo = new DrizzleNotificationsRepository();

export const adminNotificationsRouter = router({
  /**
   * Get notifications for current admin user
   */
  list: adminProcedure
    .input(
      z
        .object({
          unreadOnly: z.boolean().optional(),
          limit: z.number().int().positive().max(100).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      return notificationsRepo.findByAdminUser(ctx.user.id, {
        unreadOnly: input?.unreadOnly,
        limit: input?.limit ?? 20,
      });
    }),

  /**
   * Get unread count
   */
  unreadCount: adminProcedure.query(async ({ ctx }) => {
    return notificationsRepo.getUnreadCount(ctx.user.id);
  }),

  /**
   * Mark notification as read
   */
  markAsRead: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await notificationsRepo.markAsRead(input.id);
      return { success: true };
    }),

  /**
   * Mark all as read
   */
  markAllAsRead: adminProcedure.mutation(async ({ ctx }) => {
    await notificationsRepo.markAllAsRead(ctx.user.id);
    return { success: true };
  }),

  /**
   * Delete a notification
   */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await notificationsRepo.delete(input.id);
      return { success: true };
    }),

  /**
   * Clear all notifications
   */
  clearAll: adminProcedure.mutation(async ({ ctx }) => {
    await notificationsRepo.deleteAll(ctx.user.id);
    return { success: true };
  }),
});
