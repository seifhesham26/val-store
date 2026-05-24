"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, FileDown } from "lucide-react";
import { toast } from "sonner";

export function OrdersListHeader() {
  return (
    <>
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">
          Manage and track customer orders
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order number or customer..."
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => toast.info("Advanced filters are coming soon.")}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.info("Order export functionality is under development.")
          }
        >
          <FileDown className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    </>
  );
}
