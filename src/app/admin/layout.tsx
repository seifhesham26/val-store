import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { ThemeProvider } from "next-themes";

/**
 * Admin Layout - Provides admin UI structure with sidebar, header, and tRPC context
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
