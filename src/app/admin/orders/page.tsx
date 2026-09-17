"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  OrdersListHeader,
  type OrderFilters,
} from "@/components/admin/orders/list/OrdersListHeader";
import {
  OrdersTable,
  type OrdersTableHandle,
} from "@/components/admin/orders/list/OrdersTable";
import { useAdminWriteAccess } from "@/hooks/use-admin-write-access";
import { canExportOrders } from "@/domain/customer-access/customer-access-policy";

export default function OrdersPage() {
  const [filters, setFilters] = useState<OrderFilters>({
    search: "",
    status: "all",
    refundableOnly: false,
    returnedOnly: false,
  });
  const tableRef = useRef<OrdersTableHandle | null>(null);
  const { role } = useAdminWriteAccess();
  const recordExport = trpc.admin.orders.recordExport.useMutation();
  const canExport = role ? canExportOrders(role) : false;

  const handleExport = useCallback(async () => {
    const orders = tableRef.current?.getOrders();
    if (!orders || orders.length === 0) {
      toast.error("No orders to export");
      return;
    }

    try {
      await recordExport.mutateAsync();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Export authorization failed"
      );
      return;
    }

    const headers = [
      "Order Number",
      "Order ID",
      "Customer",
      "Email",
      "Date",
      "Items",
      "Total",
      "Returned Units",
      "Refunded Amount",
      "Net Total",
      "Return State",
      "Payment Method",
      "Payment Status",
      "Status",
      "Refundable",
    ];

    const rows = orders.map((order) => [
      order.orderNumber ?? "",
      order.id,
      order.customerName ?? "",
      order.customerEmail ?? "",
      new Date(order.createdAt).toISOString().slice(0, 10),
      String(order.totalItems),
      order.totalAmount.toFixed(2),
      String(order.refundedItems),
      order.refundedAmount.toFixed(2),
      order.netAmount.toFixed(2),
      order.fullyRefunded
        ? "Fully returned"
        : order.partiallyRefunded
          ? "Partly returned"
          : "None",
      order.paymentMethod ?? "",
      order.paymentStatus ?? "",
      order.status,
      order.isRefundable ? "Yes" : "No",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Orders exported");
  }, [recordExport]);

  return (
    <div className="space-y-6">
      <OrdersListHeader
        filters={filters}
        onFiltersChange={setFilters}
        onExport={() => void handleExport()}
        canExport={canExport}
        isExporting={recordExport.isPending}
        workerMode={role === "worker"}
      />
      <OrdersTable filters={filters} tableRef={tableRef} />
    </div>
  );
}
