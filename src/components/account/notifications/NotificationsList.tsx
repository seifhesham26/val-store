"use client";

import Link from "next/link";
import { Trash2, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  notificationIcon,
  notificationColor,
} from "@/components/notifications/notification-visuals";
import { AppRouter } from "@/server";
import { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Notification = RouterOutputs["public"]["notifications"]["list"][number];

interface NotificationsListProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export function NotificationsList({
  notifications,
  onMarkRead,
  onDelete,
}: NotificationsListProps) {
  return (
    <div className="space-y-3">
      {notifications.map((n) => {
        const Icon = notificationIcon(n.notificationType);
        const colorClass = notificationColor(n.notificationType);
        // Only a notification that names a product has somewhere to go. The
        // rest are read in place rather than being dead links to "#".
        const href = n.productSlug ? `/products/${n.productSlug}` : null;

        const body = (
          <>
            <div className={`shrink-0 rounded-full p-2.5 ${colorClass}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p
                className={`text-sm ${
                  n.isRead ? "text-gray-300" : "font-medium text-white"
                }`}
              >
                {n.title}
              </p>
              <p className="text-sm text-gray-500">{n.message}</p>
              <p className="text-xs text-gray-600">
                {formatDistanceToNow(new Date(n.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </>
        );

        return (
          <div
            key={n.id}
            className={`flex items-start gap-4 rounded-lg border p-5 transition-colors ${
              n.isRead
                ? "border-white/10 bg-zinc-900"
                : "border-val-accent/30 bg-white/[0.04]"
            }`}
          >
            {href ? (
              <Link
                href={href}
                onClick={() => !n.isRead && onMarkRead(n.id)}
                className="flex min-w-0 flex-1 items-start gap-4"
              >
                {body}
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 items-start gap-4">{body}</div>
            )}

            <div className="flex shrink-0 items-center gap-1">
              {!n.isRead && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Mark as read"
                  onClick={() => onMarkRead(n.id)}
                  className="h-8 w-8 text-gray-400 hover:bg-white/10 hover:text-white"
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                title="Delete"
                onClick={() => onDelete(n.id)}
                className="h-8 w-8 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
