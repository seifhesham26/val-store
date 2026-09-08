"use client";

/**
 * User Notifications Bell
 *
 * Bell icon with unread count badge and dropdown for logged-in users.
 */

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  notificationIcon,
  notificationColor,
} from "@/components/notifications/notification-visuals";
import { cachePatch, runOptimistic } from "@/lib/optimistic-patches";
import { showRetryToast } from "@/lib/optimistic-toast";
import type { AppRouter } from "@/server";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export function UserNotificationsBell() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const { data: notifications = [], isLoading } =
    trpc.public.notifications.list.useQuery(
      { limit: 10 },
      { enabled: open && !!session?.user }
    );
  const { data: unreadCount = 0 } =
    trpc.public.notifications.unreadCount.useQuery(undefined, {
      enabled: !!session?.user,
    });

  const utils = trpc.useUtils();

  const listInput = { limit: 10 } as const;

  /** The dropdown's ten most recent, patched in place. */
  const listPatch = (
    patch: (
      rows: RouterOutputs["public"]["notifications"]["list"] | undefined
    ) => RouterOutputs["public"]["notifications"]["list"] | undefined
  ) =>
    cachePatch({
      cancel: () => utils.public.notifications.list.cancel(listInput),
      read: () => utils.public.notifications.list.getData(listInput),
      write: (data) => utils.public.notifications.list.setData(listInput, data),
      invalidate: () => utils.public.notifications.list.invalidate(),
      patch,
    });

  /** The badge. */
  const countPatch = (next: (current: number) => number) =>
    cachePatch({
      cancel: () => utils.public.notifications.unreadCount.cancel(),
      read: () => utils.public.notifications.unreadCount.getData(),
      write: (data) =>
        utils.public.notifications.unreadCount.setData(undefined, data),
      invalidate: () => utils.public.notifications.unreadCount.invalidate(),
      patch: (current) => (current === undefined ? current : next(current)),
    });

  function retryMarkAsRead(id: string) {
    markAsReadMutation.mutate({ id });
  }

  const markAsReadMutation = trpc.public.notifications.markAsRead.useMutation({
    onMutate: ({ id }) =>
      runOptimistic([
        listPatch((rows) =>
          rows?.map((row) => (row.id === id ? { ...row, isRead: true } : row))
        ),
        countPatch((current) => Math.max(0, current - 1)),
      ]),
    onError: (_err, variables, handle) => {
      handle?.rollback();
      showRetryToast("Couldn't mark that as read.", () =>
        retryMarkAsRead(variables.id)
      );
    },
    onSettled: (_data, _err, _variables, handle) => {
      handle?.settle();
    },
  });

  function retryMarkAllAsRead() {
    markAllAsReadMutation.mutate();
  }

  const markAllAsReadMutation =
    trpc.public.notifications.markAllAsRead.useMutation({
      onMutate: () =>
        runOptimistic([
          listPatch((rows) => rows?.map((row) => ({ ...row, isRead: true }))),
          countPatch(() => 0),
        ]),
      onError: (_err, _variables, handle) => {
        handle?.rollback();
        showRetryToast("Couldn't mark them all as read.", retryMarkAllAsRead);
      },
      onSettled: (_data, _err, _variables, handle) => {
        handle?.settle();
      },
    });

  // Don't show if not logged in
  if (!session?.user) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="text-gray-300 hover:text-val-accent transition-colors relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 bg-zinc-900 border-white/10 text-white"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <span className="font-semibold text-white">Notifications</span>
          {unreadCount > 0 && (
            <button
              className="text-xs text-val-accent hover:text-val-accent-light transition-colors flex items-center gap-1"
              onClick={() => markAllAsReadMutation.mutate()}
            >
              <Check className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="bg-white/10" />
        {isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <Spinner className="size-5 text-gray-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-400">
            No notifications yet
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => {
              const Icon = notificationIcon(n.notificationType);
              const colorClass = notificationColor(n.notificationType);

              return (
                <DropdownMenuItem
                  key={n.id}
                  className={`flex gap-3 p-3 cursor-pointer hover:!bg-white/[0.06] focus:!bg-white/[0.06] ${
                    !n.isRead ? "bg-white/[0.04]" : ""
                  }`}
                  asChild
                >
                  <Link
                    href={n.productSlug ? `/products/${n.productSlug}` : "#"}
                    onClick={() => {
                      if (!n.isRead) {
                        markAsReadMutation.mutate({ id: n.id });
                      }
                    }}
                  >
                    <div className={`p-2 rounded-full ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm truncate ${
                          !n.isRead ? "font-medium text-white" : "text-gray-300"
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {n.message}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-white/10" />
            <div className="p-2">
              <Link
                href="/account/notifications"
                className="text-sm text-val-accent hover:text-val-accent-light transition-colors block text-center"
              >
                View all notifications
              </Link>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
