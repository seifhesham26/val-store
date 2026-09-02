"use client";

/**
 * Account Layout
 *
 * Wraps account pages with sidebar navigation.
 * Requires authentication.
 */

import { useSession } from "@/lib/auth-client";
import { redirect } from "next/navigation";
import { AccountSidebar } from "@/components/account/AccountSidebar";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="animate-pulse">
          <div className="h-8 bg-white/[0.06] rounded w-48 mb-8" />
          <div className="flex gap-8">
            <div className="w-64 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-white/[0.06] rounded-lg" />
              ))}
            </div>
            <div className="flex-1 h-96 bg-white/[0.06] rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    redirect("/login?redirect=/account");
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row gap-8">
        <AccountSidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
