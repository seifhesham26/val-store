"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  OrdersListHeader,
  type OrderFilters,
} from "@/components/admin/orders/list/OrdersListHeader";
import {
  OrdersTable,
  type OrdersTableHandle,
} from "@/components/admin/orders/list/OrdersTable";

export default function OrdersPage() {
  const [filters, setFilters] = useState<OrderFilters>({
    search: "",
    status: "all",
    refundableOnly: false,
  });
  const tableRef = useRef<OrdersTableHandle | null>(null);

  const handleExport = useCallback(() => {
    const orders = tableRef.current?.getOrders();
    if (!orders || orders.length === 0) {
      toast.error("No orders to export");
      return;
    }

    const headers = [
      "Order ID",
      "Customer",
      "Date",
      "Items",
      "Total",
      "Payment Method",
      "Payment Status",
      "Status",
      "Refundable",
    ];

    const rows = orders.map((order) => [
      order.id,
      order.userId,
      new Date(order.createdAt).toISOString().slice(0, 10),
      String(order.totalItems),
      order.totalAmount.toFixed(2),
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
  }, []);

  return (
    <div className="space-y-6">
      <OrdersListHeader
        filters={filters}
        onFiltersChange={setFilters}
        onExport={handleExport}
      />
      <OrdersTable filters={filters} tableRef={tableRef} />
    </div>
  );
}
