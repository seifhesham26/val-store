"use client";

/**
 * Notifications Page (Account)
 *
 * The bell's "View all notifications" link pointed here and 404'd — the route
 * did not exist. The bell shows the ten most recent in a dropdown; this is the
 * full list, with read/unread filtering and per-item delete.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsLoading } from "@/components/account/notifications/NotificationsLoading";
import { NotificationsEmpty } from "@/components/account/notifications/NotificationsEmpty";
import { NotificationsList } from "@/components/account/notifications/NotificationsList";

/** The router caps `limit` at 50. */
const PAGE_LIMIT = 50;

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const utils = trpc.useUtils();

  const { data: notifications = [], isLoading } =
    trpc.public.notifications.list.useQuery({
      limit: PAGE_LIMIT,
      unreadOnly,
    });

  const { data: unreadCount = 0 } =
    trpc.public.notifications.unreadCount.useQuery();

  // Every mutation touches both the list and the bell's badge, so they are
  // invalidated together rather than leaving the badge counting deleted rows.
  const refresh = () => {
    utils.public.notifications.list.invalidate();
    utils.public.notifications.unreadCount.invalidate();
  };

  const markAsRead = trpc.public.notifications.markAsRead.useMutation({
    onSuccess: refresh,
    onError: (err) => toast.error(err.message),
  });

  const markAllAsRead = trpc.public.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("All notifications marked as read");
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = trpc.public.notifications.delete.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Notification deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <NotificationsLoading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Notifications</h2>
          <p className="text-gray-400">
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "Updates on your orders and saved items."}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
            className="border-white/10 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white"
          >
            <Check className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b border-white/10 pb-4">
        {(
          [
            { label: "All", value: false },
            { label: "Unread", value: true },
          ] as const
        ).map((tab) => (
          <button
            key={tab.label}
            onClick={() => setUnreadOnly(tab.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              unreadOnly === tab.value
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
            {tab.value && unreadCount > 0 && (
              <span className="ml-2 text-xs text-val-accent">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {notifications.length === 0 ? (
        <NotificationsEmpty unreadOnly={unreadOnly} />
      ) : (
        <NotificationsList
          notifications={notifications}
          onMarkRead={(id) => markAsRead.mutate({ id })}
          onDelete={(id) => remove.mutate({ id })}
        />
      )}

      {notifications.length === PAGE_LIMIT && (
        <p className="py-2 text-center text-sm text-gray-500">
          Showing your {PAGE_LIMIT} most recent notifications.
        </p>
      )}
    </div>
  );
}
