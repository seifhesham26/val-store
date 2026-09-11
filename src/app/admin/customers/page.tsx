"use client";

/**
 * Admin Customers Page
 *
 * List all customers with order stats and view details.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { CustomersHeader } from "@/components/admin/customers/CustomersHeader";
import { CustomersSearch } from "@/components/admin/customers/CustomersSearch";
import { CustomersTable } from "@/components/admin/customers/CustomersTable";
import { CustomerDetailDialog } from "@/components/admin/customers/CustomerDetailDialog";
import { useAdminWriteAccess } from "@/hooks/use-admin-write-access";

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );

  const { data, isLoading } = trpc.admin.customers.list.useQuery({
    search: search || undefined,
    limit: 100,
  });
  const { data: session } = trpc.public.user.getSession.useQuery();
  const { role } = useAdminWriteAccess();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-10 w-64 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const { customers = [], total = 0 } = data ?? {};

  return (
    <div className="p-6">
      <CustomersHeader total={total} />
      <CustomersSearch value={search} onChange={setSearch} />
      <CustomersTable
        customers={customers}
        onViewCustomer={setSelectedCustomerId}
        canEditRoles={role === "super_admin"}
        currentUserId={session?.id ?? null}
      />
      <CustomerDetailDialog
        customerId={selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
      />
    </div>
  );
}
