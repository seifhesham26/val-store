import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminReadOnlyBanner } from "@/components/admin/AdminReadOnlyBanner";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { ThemeProvider } from "next-themes";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserRole, isAdminAreaRole } from "@/server/utils/auth-helpers";

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

  // `isAdminAreaRole`, not `isAdminRole`: a `worker` may open every admin
  // screen and change nothing. Keeping this in sync with `adminProcedure` is
  // the point of both asking the same helper — this gate and the tRPC one
  // drifting apart is how you get a screen that renders and then rejects every
  // action on it.
  if (!isAdminAreaRole(role)) {
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

            {/* Explains, for a read-only `worker`, why saving is unavailable.
                Renders nothing for admin/super_admin. */}
            <AdminReadOnlyBanner />

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
