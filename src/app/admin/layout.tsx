import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { ThemeProvider } from "next-themes";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserRole } from "@/server/utils/auth-helpers";

/**
 * Admin Layout - Provides admin UI structure with sidebar, header, and tRPC context
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login?error=unauthorized");
  }

  const role = await getUserRole(session.user.id);

  if (role !== "admin" && role !== "super_admin") {
    redirect("/login?error=unauthorized");
  }

  return (
    <TRPCProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        storageKey="admin-theme"
        enableSystem={false}
      >
        <div className="fixed inset-0 flex bg-background text-foreground">
          {/* Sidebar */}
          <AdminSidebar />

          {/* Main Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Header */}
            <AdminHeader />

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto bg-muted/10 p-6">
              {children}
            </main>
          </div>
        </div>
      </ThemeProvider>
    </TRPCProvider>
  );
}
