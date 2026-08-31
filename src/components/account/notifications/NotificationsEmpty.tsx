import { Bell } from "lucide-react";

export function NotificationsEmpty({ unreadOnly }: { unreadOnly: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-zinc-900 px-6 py-16 text-center">
      <div className="rounded-full bg-white/[0.06] p-4">
        <Bell className="h-8 w-8 text-gray-500" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">
        {unreadOnly ? "Nothing unread" : "No notifications yet"}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-gray-400">
        {unreadOnly
          ? "You are all caught up. Switch to All to see the ones you have already read."
          : "Order updates and alerts about your saved items will show up here."}
      </p>
    </div>
  );
}
