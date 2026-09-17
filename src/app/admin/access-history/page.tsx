"use client";

import { trpc } from "@/lib/trpc";
import { StaffAccessHistory } from "@/components/admin/customers/StaffAccessHistory";

export default function AccessHistoryPage() {
  const { data: user, isLoading } = trpc.public.user.getSession.useQuery();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My access history</h1>
        <p className="text-muted-foreground">
          Customer and order data you have opened during the last 12 months.
        </p>
      </div>
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      ) : user?.id ? (
        <StaffAccessHistory staffUserId={user.id} />
      ) : null}
    </div>
  );
}
