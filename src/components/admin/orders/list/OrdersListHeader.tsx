"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileDown, RotateCcw, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { ORDER_STATUSES } from "@/domain/orders/value-objects/order-status.value-object";

export interface OrderFilters {
  search: string;
  status: string | "all";
  refundableOnly: boolean;
  returnedOnly: boolean;
}

interface OrdersListHeaderProps {
  filters: OrderFilters;
  onFiltersChange: (filters: OrderFilters) => void;
  onExport: () => void;
}

export function OrdersListHeader({
  filters,
  onFiltersChange,
  onExport,
}: OrdersListHeaderProps) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.refundableOnly ||
    filters.returnedOnly;

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
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order number or customer..."
            className="pl-10"
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(status) => onFiltersChange({ ...filters, status })}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ORDER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Refundable = money was captured and not yet returned. Deliberately
            not a status: a cancelled order that was paid is still refundable. */}
        <Button
          variant={filters.refundableOnly ? "default" : "outline"}
          onClick={() =>
            onFiltersChange({
              ...filters,
              refundableOnly: !filters.refundableOnly,
            })
          }
          aria-pressed={filters.refundableOnly}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Refundable
        </Button>

        {/* Returned = at least one unit has come back. Independent of status:
            a partly returned order is still delivered. */}
        <Button
          variant={filters.returnedOnly ? "default" : "outline"}
          onClick={() =>
            onFiltersChange({
              ...filters,
              returnedOnly: !filters.returnedOnly,
            })
          }
          aria-pressed={filters.returnedOnly}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Has returns
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={() =>
              onFiltersChange({
                search: "",
                status: "all",
                refundableOnly: false,
                returnedOnly: false,
              })
            }
          >
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        )}

        <Button
          variant="outline"
          onClick={() => {
            onExport();
            toast.success("Orders exported");
          }}
        >
          <FileDown className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    </>
  );
}
