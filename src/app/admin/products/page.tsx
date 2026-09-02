"use client";

import { useState, useRef, useCallback } from "react";
import {
  ProductsListHeader,
  type ProductFilters,
} from "@/components/admin/products/list/ProductsListHeader";
import {
  ProductsTable,
  type ProductsTableHandle,
} from "@/components/admin/products/list/ProductsTable";
import { toast } from "sonner";

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ProductFilters>({});
  const tableRef = useRef<ProductsTableHandle>(null);

  const handleExport = useCallback(() => {
    const products = tableRef.current?.getProducts();
    if (!products || products.length === 0) {
      toast.error("No products to export");
      return;
    }

    // Build CSV
    const headers = [
      "Name",
      "Slug",
      "Base Price",
      "Current Price",
      "Stock",
      "Status",
      "On Sale",
      "Discount %",
    ];

    const rows = products.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      p.slug,
      p.basePrice.toFixed(2),
      p.currentPrice.toFixed(2),
      p.stock,
      p.isActive ? "Active" : "Hidden",
      p.isOnSale ? "Yes" : "No",
      p.discountPercentage,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    // Trigger download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `products-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${products.length} products`);
  }, []);

  return (
    <div className="space-y-6">
      <ProductsListHeader
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        onExport={handleExport}
      />
      <ProductsTable ref={tableRef} filters={filters} search={search} />
    </div>
  );
}
